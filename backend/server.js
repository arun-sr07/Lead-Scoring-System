require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const OpenAI = require('openai');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Groq AI client (OpenAI-compatible)
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

// ===== ROUTES =====

// POST /offer - Create new offer
app.post('/offer', (req, res) => {
  try {
    const { name, value_props, ideal_use_cases } = req.body;
    
    if (!name || !value_props || !ideal_use_cases) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO offers (name, value_props, ideal_use_cases)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
      name,
      JSON.stringify(value_props),
      JSON.stringify(ideal_use_cases)
    );

    const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      ...offer,
      value_props: JSON.parse(offer.value_props),
      ideal_use_cases: JSON.parse(offer.ideal_use_cases)
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /leads/upload - Upload CSV of leads
app.post('/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const stmt = db.prepare(`
      INSERT INTO leads (name, role, company, industry, location, linkedin_bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const record of records) {
      stmt.run(
        record.name || '',
        record.role || '',
        record.company || '',
        record.industry || '',
        record.location || '',
        record.linkedin_bio || ''
      );
      count++;
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ message: 'Leads uploaded successfully', count });
  } catch (error) {
    console.error('Error uploading leads:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Rule-based scoring function
function calculateRuleScore(lead) {
  let score = 0;

  // Role relevance (max 20)
  const roleLower = (lead.role || '').toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('cto') || roleLower.includes('founder') || 
      roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('head')) {
    score += 20; // Decision maker
  } else if (roleLower.includes('manager') || roleLower.includes('lead')) {
    score += 10; // Influencer
  }

  // Industry match (max 20) - simplified, adjust based on your ICP
  const industryLower = (lead.industry || '').toLowerCase();
  if (industryLower.includes('tech') || industryLower.includes('software') || industryLower.includes('saas')) {
    score += 20; // Exact ICP match
  } else if (industryLower.includes('finance') || industryLower.includes('healthcare')) {
    score += 10; // Adjacent
  }

  // Data completeness (max 10)
  const fields = [lead.name, lead.role, lead.company, lead.industry, lead.location, lead.linkedin_bio];
  if (fields.every(f => f && f.trim())) {
    score += 10;
  }

  return Math.min(score, 50);
}

// AI-based scoring with Groq
async function calculateAIScore(lead, offer) {
  try {
    const prompt = `You are a B2B lead qualification expert. Analyze this lead against the offer.

Offer: ${offer.name}
Value Props: ${JSON.parse(offer.value_props).join(', ')}
Ideal Use Cases: ${JSON.parse(offer.ideal_use_cases).join(', ')}

Lead:
- Name: ${lead.name}
- Role: ${lead.role}
- Company: ${lead.company}
- Industry: ${lead.industry}
- Location: ${lead.location}
- LinkedIn Bio: ${lead.linkedin_bio}

Classify this lead's intent as High, Medium, or Low. Respond ONLY with valid JSON in this exact format:
{"intent":"High","reasoning":"Your 1-2 sentence explanation here"}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 150
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Fallback: extract intent from text
      const intentMatch = responseText.match(/\b(High|Medium|Low)\b/i);
      parsed = {
        intent: intentMatch ? intentMatch[1] : 'Medium',
        reasoning: responseText
      };
    }

    // Map intent to points
    const intentPoints = {
      'High': 50,
      'Medium': 30,
      'Low': 10
    };

    const intent = parsed.intent || 'Medium';
    const aiPoints = intentPoints[intent] || 30;

    return {
      intent,
      reasoning: parsed.reasoning || 'AI analysis completed',
      aiPoints
    };
  } catch (error) {
    console.error('AI scoring error:', error);
    return {
      intent: 'Medium',
      reasoning: 'AI unavailable, defaulted to Medium',
      aiPoints: 30
    };
  }
}

// POST /score - Score all leads
app.post('/score', async (req, res) => {
  try {
    const leads = db.prepare('SELECT * FROM leads').all();
    const offer = db.prepare('SELECT * FROM offers ORDER BY id DESC LIMIT 1').get();

    if (!offer) {
      return res.status(400).json({ error: 'No offer found. Please create an offer first.' });
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads found. Please upload leads first.' });
    }

    const results = [];
    const insertStmt = db.prepare(`
      INSERT INTO results (lead_id, offer_id, intent, score, reasoning)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const lead of leads) {
      const ruleScore = calculateRuleScore(lead);
      const { intent, reasoning, aiPoints } = await calculateAIScore(lead, offer);
      const finalScore = Math.min(ruleScore + aiPoints, 100);

      insertStmt.run(lead.id, offer.id, intent, finalScore, reasoning);

      results.push({
        lead_id: lead.id,
        name: lead.name,
        role: lead.role,
        company: lead.company,
        intent,
        score: finalScore,
        reasoning
      });
    }

    res.json({ message: 'Scoring completed', count: results.length, results });
  } catch (error) {
    console.error('Error scoring leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /results - Get all results
app.get('/results', (req, res) => {
  try {
    const results = db.prepare(`
      SELECT 
        r.id,
        l.name,
        l.role,
        l.company,
        r.intent,
        r.score,
        r.reasoning,
        r.created_at
      FROM results r
      JOIN leads l ON r.lead_id = l.id
      ORDER BY r.score DESC
    `).all();

    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /results/export - Export results as CSV
app.get('/results/export', (req, res) => {
  try {
    const results = db.prepare(`
      SELECT 
        l.name,
        l.role,
        l.company,
        l.industry,
        l.location,
        r.intent,
        r.score,
        r.reasoning
      FROM results r
      JOIN leads l ON r.lead_id = l.id
      ORDER BY r.score DESC
    `).all();

    if (results.length === 0) {
      return res.status(404).json({ error: 'No results found' });
    }

    // Generate CSV
    const headers = Object.keys(results[0]).join(',');
    const rows = results.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=lead_scores.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_PATH || './data.db'}`);
  console.log(`🤖 AI Model: ${GROQ_MODEL}`);
});
