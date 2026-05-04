import { createPool } from '@vercel/postgres';
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

  // Create a pool manually to be more resilient to connection string formats
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL
  });

  try {
    const form = formidable({ multiples: false, uploadDir: '/tmp', keepExtensions: true });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileRaw = files.file;
    const file = Array.isArray(fileRaw) ? fileRaw[0] : fileRaw;

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
    // Use a single client from the pool for the entire loop for better performance
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      for (const record of records) {
        await client.query(
          'INSERT INTO leads (name, role, company, industry, location, linkedin_bio) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            record.name || '',
            record.role || '',
            record.company || '',
            record.industry || '',
            record.location || '',
            record.linkedin_bio || ''
          ]
        );
        count++;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    try { fs.unlinkSync(file.filepath); } catch (_) {}

    res.json({ message: 'Leads uploaded successfully', count });
  } catch (error) {
    console.error('Error uploading leads:', error);
    res.status(500).json({ error: error.message });
  }
}
