import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const dbUrl = "postgresql://postgres:casadepeneus@db.bkbcgndzsfylwsinxwbb.supabase.co:5432/postgres";

async function applyMigration() {
  const sql = fs.readFileSync('./supabase/migrations/20260728162000_001_core_schemas_and_company_config.sql', 'utf8');
  console.log("Connecting to Postgres...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    console.log("Executing Migration 001...");
    await client.query(sql);
    console.log("SUCCESS! Migration 001 applied!");

    // Check system_settings
    const res = await client.query("SELECT * FROM public.system_settings;");
    console.log("system_settings rows:", res.rows);

    // Check companies
    const resComp = await client.query("SELECT id, name, tax_number FROM public.companies;");
    console.log("companies rows:", resComp.rows);

    // Check branches
    const resBranch = await client.query("SELECT id, name, code FROM public.branches;");
    console.log("branches rows:", resBranch.rows);

    // Check warehouses
    const resWh = await client.query("SELECT id, name, code FROM public.warehouses;");
    console.log("warehouses rows:", resWh.rows);

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration:", err);
    await client.end().catch(() => {});
  }
}

applyMigration();
