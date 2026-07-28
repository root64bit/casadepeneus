import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.database_url;

async function applyMigration007() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728220000_007_sales_and_purchase_documents.sql', 'utf8');
    console.log("Applying Migration 007 (Sales and Purchase Documents Engine)...");
    await client.query(sql);
    console.log("MIGRATION 007 APPLIED SUCCESSFULLY!");

    // Verify Document Types
    const resTypes = await client.query("SELECT code, name, direction, affects_stock FROM public.document_types ORDER BY code;");
    console.log("Document Types created:", resTypes.rows.length);
    console.table(resTypes.rows);

    // Verify Confirmation RPCs
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('confirm_customer_document', 'confirm_supplier_document', 'reverse_confirmed_document');");
    console.log("Confirmation & Reversal RPCs created:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 007:", err);
    await client.end().catch(() => {});
  }
}

applyMigration007();
