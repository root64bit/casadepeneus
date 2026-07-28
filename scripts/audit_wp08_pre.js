import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function auditPreWP08() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const resTables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'private', 'migration', 'audit') 
      ORDER BY table_schema, table_name;
    `);
    console.log("=== Deployed Production Tables Count ===", resTables.rows.length);

    const resMode = await client.query("SELECT setting_key, setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE';");
    console.log("System Mode:", resMode.rows[0]);

    await client.end();
  } catch (err) {
    console.error("ERROR running pre-WP08 audit:", err);
    await client.end().catch(() => {});
  }
}

auditPreWP08();
