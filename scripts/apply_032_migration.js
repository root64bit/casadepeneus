import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function applyMigration() {
  const filePath = path.resolve('supabase/migrations/20260804230000_032_fix_user_profiles_rls_insert_policy.sql');
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`Connecting to project database (${connStr.split('@')[1]})...`);
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to project database! Executing migration 032...");
    await client.query(sql);
    console.log("SUCCESS: Migration 032 applied! user_profiles, user_roles, branch_access, and warehouse_access RLS policies & permissions updated.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end().catch(() => {});
  }
}

applyMigration();
