import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function applyMigration003() {
  console.log("Connecting to production pooler...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728180000_003_articles_and_reference_data.sql', 'utf8');
    console.log("Applying Migration 003 (Articles & Reference Data)...");
    await client.query(sql);
    console.log("MIGRATION 003 APPLIED SUCCESSFULLY!");

    // Verify Product Families
    const resFamilies = await client.query("SELECT code, name FROM public.product_families ORDER BY code;");
    console.log("Families created:", resFamilies.rows);

    // Verify Tax Codes
    const resTax = await client.query("SELECT code, rate FROM public.tax_codes;");
    console.log("Tax codes created:", resTax.rows);

    // Verify Units of Measure
    const resUom = await client.query("SELECT abbreviation, name FROM public.units_of_measure;");
    console.log("UOM created:", resUom.rows);

    // Verify Brands
    const resBrands = await client.query("SELECT count(*) FROM public.brands;");
    console.log("Brands count:", resBrands.rows[0].count);

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 003:", err);
    await client.end().catch(() => {});
  }
}

applyMigration003();
