import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error('DATABASE_URL missing in .env');

async function main() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260811160000_038_update_operational_document.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('--- APPLYING MIGRATION 038 TO SUPABASE ---');
  await client.query(sql);

  console.log('✅ Migration 038 applied successfully!');
  await client.end();
}

main().catch(console.error);
