import { sql } from '@vercel/postgres';
import formidable from 'formidable';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const form = formidable({ multiples: false });
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(file.filepath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let count = 0;
    for (const record of records) {
      await sql`
        INSERT INTO leads (name, role, company, industry, location, linkedin_bio)
        VALUES (
          ${record.name || ''},
          ${record.role || ''},
          ${record.company || ''},
          ${record.industry || ''},
          ${record.location || ''},
          ${record.linkedin_bio || ''}
        )
      `;
      count++;
    }

    // Clean up
    fs.unlinkSync(file.filepath);

    res.json({ message: 'Leads uploaded successfully', count });
  } catch (error) {
    console.error('Error uploading leads:', error);
    res.status(500).json({ error: error.message });
  }
}
