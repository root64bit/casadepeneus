import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260812160000_043_financial_integrity_credit_notes_and_accounts.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8')
  .replace(/^\s*BEGIN;\s*/i, '')
  .replace(/\s*COMMIT;\s*$/i, '');

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(migrationSql);
  await client.query('ROLLBACK');
  console.log('Migration 043 validated successfully and rolled back.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
