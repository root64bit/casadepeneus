import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function applyMigration007a() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728230000_007a_document_engine_closure.sql', 'utf8');
    console.log("Applying Migration 007a (Corrective Commercial Document Engine Closure)...");
    await client.query(sql);
    console.log("MIGRATION 007a APPLIED SUCCESSFULLY!");

    // Verify Helper Functions
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'private' AND routine_name LIKE 'create_%';");
    console.log("Helper RPCs created:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 007a:", err);
    await client.end().catch(() => {});
  }
}

applyMigration007a();
