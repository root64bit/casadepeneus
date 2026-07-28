import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.database_url || "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function auditPreWP08() {
  console.log("Connecting to production pooler for Pre-WP08 Audit...");
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

    // 3. Check commercial document tables
    const resDocs = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('documents', 'document_lines', 'document_types', 'ledger_entries');");
    console.log("Existing commercial document tables count:", resDocs.rows.length);

    await client.end();
  } catch (err) {
    console.error("ERROR running pre-WP08 audit:", err);
    await client.end().catch(() => {});
  }
}

auditPreWP08();
