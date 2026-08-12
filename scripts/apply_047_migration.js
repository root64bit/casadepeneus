import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing in .env');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const file = path.join(process.cwd(), 'supabase', 'migrations', '20260812203000_047_stock_guide_documents.sql');
  await client.query('BEGIN');
  await client.query(fs.readFileSync(file, 'utf8'));
  await client.query('COMMIT');
  console.log('Migration 047 applied successfully.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
