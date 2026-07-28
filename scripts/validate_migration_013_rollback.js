import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const originalSql = fs.readFileSync(
  "supabase/migrations/20260728290000_013_master_data_and_synthetic_test_controls.sql",
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
           has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_operational_customer',
        'create_operational_supplier'
      )
    ORDER BY p.proname
  `);
  if (
    functions.rowCount !== 2 ||
    functions.rows.some((row) => row.public_execute)
  ) {
    throw new Error("Migration 013 privilege verification failed.");
  }

  let defaultGuardRejected = false;
  await client.query("SAVEPOINT guard_check");
  try {
    await client.query("SELECT public.require_operational_mode()");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT guard_check");
    if (error.message.includes("OPERATIONAL_MODE_REQUIRED")) {
      defaultGuardRejected = true;
    } else {
      throw error;
    }
  }
  await client.query("RELEASE SAVEPOINT guard_check");
  if (!defaultGuardRejected) {
    throw new Error("MIGRATION mode guard did not reject a normal session.");
  }

  console.log(
    JSON.stringify(
      {
        validation: "PASS",
        functions: functions.rows,
        normalMigrationModeSessionRejected: defaultGuardRejected,
        outcome: "ROLLBACK",
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
