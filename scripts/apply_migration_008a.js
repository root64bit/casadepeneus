import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;

async function applyMigration008a() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728250000_008a_payments_engine_closure.sql', 'utf8');
    console.log("Applying Migration 008a (Payments Engine Closure & Hardening)...");
    await client.query(sql);
    console.log("MIGRATION 008a APPLIED SUCCESSFULLY!");

    // Verify RPCs
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema IN ('private', 'migration') AND routine_name LIKE '%receipt%' OR routine_name LIKE '%allocate%' OR routine_name LIKE '%reconcile%';");
    console.log("RPCs verified:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 008a:", err);
    await client.end().catch(() => {});
  }
}

applyMigration008a();
