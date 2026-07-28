import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function auditPreWP09() {
  console.log("Connecting to production pooler for Pre-WP09 Audit...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Audit Deployed Tables
    const resTables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'private', 'migration', 'audit') 
      ORDER BY table_schema, table_name;
    `);
    console.log("=== Deployed Production Tables Count ===", resTables.rows.length);

    // 2. Audit System Mode
    const resMode = await client.query("SELECT setting_key, setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE';");
    console.log("System Mode:", resMode.rows[0]);

    // 3. Check existing payment tables
    const resPay = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('payments', 'payment_allocations', 'payment_methods', 'payment_receipts');");
    console.log("Existing payment tables count:", resPay.rows.length);

    // 4. Verify Ledger & Document Objects
    const resLedger = await client.query("SELECT count(*) FROM public.ledger_entries;");
    const resDocs = await client.query("SELECT count(*) FROM public.documents;");
    console.log("Active documents count:", resDocs.rows[0].count);
    console.log("Active ledger entries count:", resLedger.rows[0].count);

    await client.end();
  } catch (err) {
    console.error("ERROR running pre-WP09 audit:", err);
    await client.end().catch(() => {});
  }
}

auditPreWP09();
