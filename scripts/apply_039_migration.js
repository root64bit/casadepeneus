import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260811220000_039_document_editing_and_party_admin.sql');
    await client.query(fs.readFileSync(migrationPath, 'utf8'));
    console.log('Migration 039 applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
