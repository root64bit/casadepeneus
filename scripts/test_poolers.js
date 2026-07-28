import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const regions = [
  "aws-0-eu-central-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-us-west-1.pooler.supabase.com",
  "aws-0-sa-east-1.pooler.supabase.com",
  "aws-0-ap-southeast-1.pooler.supabase.com",
  "aws-0-eu-west-1.pooler.supabase.com"
];

const pass = "casadepeneus";
const projectRef = "bkbcgndzsfylwsinxwbb";

async function testPoolers() {
  for (const region of regions) {
    const connStr = `postgres://postgres.${projectRef}:${pass}@${region}:6543/postgres`;
    console.log("Testing:", region);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000
    });
    try {
      await client.connect();
      console.log("SUCCESS! Connected to pooler region:", region);
      const sql = fs.readFileSync('./supabase/migrations/20260728162000_001_core_schemas_and_company_config.sql', 'utf8');
      console.log("Executing migration SQL...");
      await client.query(sql);
      console.log("MIGRATION 001 APPLIED SUCCESSFULLY!");

      const res = await client.query("SELECT * FROM public.system_settings;");
      console.log("system_settings rows:", res.rows);

      const resComp = await client.query("SELECT id, name, tax_number FROM public.companies;");
      console.log("companies rows:", resComp.rows);

      const resWh = await client.query("SELECT id, name, code FROM public.warehouses;");
      console.log("warehouses rows:", resWh.rows);

      await client.end();
      return;
    } catch (err) {
      console.log("Failed region", region, ":", err.message);
      await client.end().catch(() => {});
    }
  }
}

testPoolers();
