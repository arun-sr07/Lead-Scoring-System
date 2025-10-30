import { sql } from '@vercel/postgres';

function calculateRuleScore(lead) {
  let score = 0;

  const roleLower = (lead.role || '').toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('cto') || roleLower.includes('founder') || 
      roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('head')) {
    score += 20;
  } else if (roleLower.includes('manager') || roleLower.includes('lead')) {
    score += 10;
  }

  const industryLower = (lead.industry || '').toLowerCase();
  if (industryLower.includes('tech') || industryLower.includes('software') || industryLower.includes('saas')) {
    score += 20;
  } else if (industryLower.includes('finance') || industryLower.includes('healthcare')) {
    score += 10;
  }

  const fields = [lead.name, lead.role, lead.company, lead.industry, lead.location, lead.linkedin_bio];
  if (fields.every(f => f && f.trim())) {
    score += 10;
  }

  return Math.min(score, 50);
}

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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        max_tokens: 150
      })
    });

    const data = await response.json();
    const responseText = data.choices[0].message.content.trim();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const intentMatch = responseText.match(/\b(High|Medium|Low)\b/i);
      parsed = {
        intent: intentMatch ? intentMatch[1] : 'Medium',
        reasoning: responseText
      };
    }

    const intentPoints = { 'High': 50, 'Medium': 30, 'Low': 10 };
    const intent = parsed.intent || 'Medium';
    const aiPoints = intentPoints[intent] || 30;

    return { intent, reasoning: parsed.reasoning || 'AI analysis completed', aiPoints };
  } catch (error) {
    console.error('AI scoring error:', error);
    return { intent: 'Medium', reasoning: 'AI unavailable, defaulted to Medium', aiPoints: 30 };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const leadsResult = await sql`SELECT * FROM leads`;
    const leads = leadsResult.rows;

    const offerResult = await sql`SELECT * FROM offers ORDER BY id DESC LIMIT 1`;
    const offer = offerResult.rows[0];

    if (!offer) {
      return res.status(400).json({ error: 'No offer found. Please create an offer first.' });
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads found. Please upload leads first.' });
    }

    const results = [];

    for (const lead of leads) {
      const ruleScore = calculateRuleScore(lead);
      const { intent, reasoning, aiPoints } = await calculateAIScore(lead, offer);
      const finalScore = Math.min(ruleScore + aiPoints, 100);

      await sql`
        INSERT INTO results (lead_id, offer_id, intent, score, reasoning)
        VALUES (${lead.id}, ${offer.id}, ${intent}, ${finalScore}, ${reasoning})
      `;

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
}
