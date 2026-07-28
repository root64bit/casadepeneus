import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function applyMigration() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('./supabase/migrations/20260728170000_002_auth_rbac_and_rls_foundation.sql', 'utf8');
    await client.query(sql);
    console.log("Migration 002 applied!");
    await client.end();
  } catch (err) {
    console.error("ERROR:", err);
    await client.end().catch(() => {});
  }
}

applyMigration();
