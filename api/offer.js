import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, value_props, ideal_use_cases } = req.body;

    if (!name || !value_props || !ideal_use_cases) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert offer
    const result = await sql`
      INSERT INTO offers (name, value_props, ideal_use_cases)
      VALUES (${name}, ${JSON.stringify(value_props)}, ${JSON.stringify(ideal_use_cases)})
      RETURNING *
    `;

    const offer = result.rows[0];
    
    res.json({
      ...offer,
      value_props: JSON.parse(offer.value_props),
      ideal_use_cases: JSON.parse(offer.ideal_use_cases)
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: error.message });
  }
}
