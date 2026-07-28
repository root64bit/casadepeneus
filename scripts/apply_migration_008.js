import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.database_url;

async function applyMigration008() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728240000_008_payments_allocations_and_current_accounts.sql', 'utf8');
    console.log("Applying Migration 008 (Payments, Allocations & Current Accounts)...");
    await client.query(sql);
    console.log("MIGRATION 008 APPLIED SUCCESSFULLY!");

    // Verify Payment Methods
    const resMethods = await client.query("SELECT code, name, method_type FROM public.payment_methods ORDER BY display_order;");
    console.log("Payment Methods created:", resMethods.rows.length);
    console.table(resMethods.rows);

    // Verify Confirmation & Allocation RPCs
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'private' AND routine_name LIKE '%payment%' OR routine_name LIKE '%balance%';");
    console.log("Payment & Balance RPCs created:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 008:", err);
    await client.end().catch(() => {});
  }
}

applyMigration008();
