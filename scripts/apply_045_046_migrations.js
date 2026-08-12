import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');

const migrations = [
  '20260812193000_045_cashier_negative_stock_guides.sql',
  '20260812194000_046_document_date_editing.sql',
];

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  for (const migration of migrations) {
    await client.query(fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', migration), 'utf8'));
    console.log(`${migration} applied successfully.`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
