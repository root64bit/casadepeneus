import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function applyMigration002() {
  console.log("Connecting to production pooler...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    // Verify Roles Count
    const resRoles = await client.query("SELECT code, name FROM public.roles ORDER BY code;");
    console.log("Roles count:", resRoles.rows.length);
    console.log("Roles deployed:", resRoles.rows.map(r => r.code));

    // Verify Permissions Count
    const resPerms = await client.query("SELECT count(*) FROM public.permissions;");
    console.log("Permissions count:", resPerms.rows[0].count);

    // Verify Admin Role Permissions
    const resAdminPerms = await client.query("SELECT count(*) FROM public.role_permissions WHERE role_id = '10000000-0000-0000-0000-000000000001';");
    console.log("ADMIN permissions count:", resAdminPerms.rows[0].count);

    await client.end();
  } catch (err) {
    console.error("ERROR checking migration 002:", err);
    await client.end().catch(() => {});
  }
}

applyMigration002();
