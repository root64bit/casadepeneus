import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function applyMigration005() {
  console.log("Connecting to production pooler...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");
    const sql = fs.readFileSync('./supabase/migrations/20260728200000_005_legacy_article_and_stock_migration_staging.sql', 'utf8');
    console.log("Applying Migration 005 (Legacy Article & Stock Migration Staging Pipeline)...");
    await client.query(sql);
    console.log("MIGRATION 005 APPLIED SUCCESSFULLY!");

    // Verify Migration Schema Tables
    const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'migration';");
    console.log("Migration tables created:", resTables.rows.map(t => t.table_name));

    // Verify Transformation RPC Functions
    const resFuncs = await client.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'migration';");
    console.log("Migration functions created:", resFuncs.rows.map(f => f.routine_name));

    await client.end();
  } catch (err) {
    console.error("ERROR executing migration 005:", err);
    await client.end().catch(() => {});
  }
}

applyMigration005();
