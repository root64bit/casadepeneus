import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function applyMigration006() {
  console.log("Connecting to production pooler...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728210000_006_customers_suppliers_and_contact_migration.sql', 'utf8');
    console.log("Applying Migration 006 (Customers, Suppliers & Contact Migration Foundation)...");
    await client.query(sql);
    console.log("MIGRATION 006 APPLIED SUCCESSFULLY!");

    // Verify Payment Terms
    const resTerms = await client.query("SELECT code, name, payment_days FROM public.payment_terms;");
    console.log("Payment terms created:", resTerms.rows);

    // Verify Customer and Supplier Tables Exist
    const resCust = await client.query("SELECT count(*) FROM public.customers;");
    const resSupp = await client.query("SELECT count(*) FROM public.suppliers;");
    console.log("Customers count:", resCust.rows[0].count);
    console.log("Suppliers count:", resSupp.rows[0].count);

    // Verify Migration Functions
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'migration' AND routine_name LIKE '%customer%' OR routine_name LIKE '%supplier%';");
    console.log("Contact migration functions created:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 006:", err);
    await client.end().catch(() => {});
  }
}

applyMigration006();
