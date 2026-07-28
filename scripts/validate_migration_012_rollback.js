import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const migrationPath =
  "supabase/migrations/20260728280000_012_frontend_operational_api.sql";
const originalSql = fs.readFileSync(migrationPath, "utf8");
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
    SELECT p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'require_operational_mode',
        'create_operational_product',
        'post_operational_stock_movement',
        'create_and_confirm_customer_sale',
        'create_and_confirm_customer_payment'
      )
    ORDER BY p.proname
  `);

  const publicPrivileges = await client.query(`
    SELECT p.proname AS function_name,
           has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN (
        'confirm_customer_document',
        'confirm_supplier_document',
        'confirm_customer_payment',
        'confirm_supplier_payment',
        'allocate_payment'
      )
    ORDER BY p.proname
  `);

  const modeGuard = await client.query(`
    SELECT setting_value
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE'
  `);

  console.log(
    JSON.stringify(
      {
        validation: "PASS",
        functions: functions.rows,
        privateFunctions: publicPrivileges.rows,
        systemMode: modeGuard.rows[0]?.setting_value,
        transactionOutcome: "ROLLBACK",
      },
      null,
      2,
    ),
  );
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
