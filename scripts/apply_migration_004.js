import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function applyMigration004() {
  console.log("Connecting to production pooler...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728190000_004_stock_engine.sql', 'utf8');
    console.log("Applying Migration 004 (Stock Engine & Balance Posting)...");
    await client.query(sql);
    console.log("MIGRATION 004 APPLIED SUCCESSFULLY!");

    // Verify Stock Movement Reasons
    const resReasons = await client.query("SELECT code, description FROM public.stock_movement_reasons;");
    console.log("Reasons created:", resReasons.rows);

    // Verify RPC Function Exists
    const resFunc = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_name = 'post_stock_movement';");
    console.log("RPC function exists:", resFunc.rows.length > 0);

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 004:", err);
    await client.end().catch(() => {});
  }
}

applyMigration004();
