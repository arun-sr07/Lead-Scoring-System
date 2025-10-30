import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await sql`
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
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No results found' });
    }

    const headers = Object.keys(result.rows[0]).join(',');
    const rows = result.rows.map(row => 
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
}
