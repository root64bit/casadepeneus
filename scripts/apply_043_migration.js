import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(fs.readFileSync(path.join(
    process.cwd(),
    'supabase/migrations/20260812160000_043_financial_integrity_credit_notes_and_accounts.sql',
  ), 'utf8'));
  console.log('Migration 043 applied successfully.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
