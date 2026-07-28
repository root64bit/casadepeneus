import pkg from 'pg';
const { Client } = pkg;

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function auditPreWP07() {
  console.log("Connecting to production pooler for Pre-WP07 Audit...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Audit Tables in all schemas
    const resTables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'private', 'migration', 'audit') 
      ORDER BY table_schema, table_name;
    `);
    console.log("=== Deployed Production Tables ===");
    console.table(resTables.rows);

    // 2. Audit System Settings Mode
    const resMode = await client.query("SELECT setting_key, setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE';");
    console.log("System Mode:", resMode.rows[0]);

    // 3. Check if customer/supplier tables exist
    const resCust = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('customers', 'suppliers', 'payment_terms');");
    console.log("Existing customer/supplier/payment_terms tables count:", resCust.rows.length);

    await client.end();
  } catch (err) {
    console.error("ERROR running pre-WP07 audit:", err);
    await client.end().catch(() => {});
  }
}

auditPreWP07();
