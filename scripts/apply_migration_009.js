import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;

async function applyMigration009() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728260000_009_legacy_raw_staging_completion.sql', 'utf8');
    console.log("Applying Migration 009 (Legacy Raw Staging Schema Completion)...");
    await client.query(sql);
    console.log("MIGRATION 009 APPLIED SUCCESSFULLY!");

    // Verify Staging Tables
    const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'migration';");
    console.log("Migration Schema Tables Verified (Count):", resTables.rows.length);
    console.table(resTables.rows);

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 009:", err);
    await client.end().catch(() => {});
  }
}

applyMigration009();
