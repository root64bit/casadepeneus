import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;

async function applyMigration010() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728270000_010_legacy_transformation_and_mapping_engine.sql', 'utf8');
    console.log("Applying Migration 010 (Legacy Transformation & Mapping Engine)...");
    await client.query(sql);
    console.log("MIGRATION 010 APPLIED SUCCESSFULLY!");

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 010:", err);
    await client.end().catch(() => {});
  }
}

applyMigration010();
