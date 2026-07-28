import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const originalSql = fs.readFileSync(
  "supabase/migrations/20260728300000_014_supplier_operational_api.sql",
  "utf8",
);
const sql = originalSql
  .replace(/^\s*BEGIN;\s*/i, "")
  .replace(/\s*COMMIT;\s*$/i, "");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);

  const functions = await client.query(`
    SELECT p.proname,
           has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_and_confirm_supplier_invoice',
        'create_and_confirm_supplier_payment'
      )
    ORDER BY p.proname
  `);
  if (
    functions.rowCount !== 2
    || functions.rows.some((row) => row.public_execute || !row.authenticated_execute)
  ) {
    throw new Error("Migration 014 privilege verification failed.");
  }

  const rolePermissions = await client.query(`
    SELECT r.code AS role_code, array_agg(p.code ORDER BY p.code) AS permissions
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.code IN ('PURCHASING_OP', 'ACCOUNTING_OP')
    GROUP BY r.code
    ORDER BY r.code
  `);
  const purchasing = rolePermissions.rows.find((row) => row.role_code === "PURCHASING_OP");
  const accounting = rolePermissions.rows.find((row) => row.role_code === "ACCOUNTING_OP");
  if (
    !purchasing?.permissions.includes("purchases.invoice.confirm")
    || !accounting?.permissions.includes("payments.pay_supplier")
    || !accounting?.permissions.includes("payments.allocate_supplier")
  ) {
    throw new Error("Migration 014 role mapping verification failed.");
  }

  const mode = await client.query(`
    SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'
  `);
  if (mode.rows[0]?.setting_value !== "MIGRATION") {
    throw new Error("System mode changed during validation.");
  }

  console.log(JSON.stringify({
    validation: "PASS",
    functions: functions.rows,
    roleMappings: rolePermissions.rows,
    systemMode: "MIGRATION",
    outcome: "ROLLBACK",
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
