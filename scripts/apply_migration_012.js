import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const backupDirectory =
  process.env.BACKUP_OUTPUT_DIR ??
  "C:\\tmp\\casadepeneus-wp11-20260728-1848";
const manifestPath = path.join(backupDirectory, "pre-012-manifest.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error("Verified pre-012 backup manifest is required.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const file of manifest.files) {
  const filePath = path.join(backupDirectory, file.name);
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
  if (digest !== file.sha256) {
    throw new Error(`Backup checksum mismatch: ${file.name}`);
  }
}
if (manifest.systemMode !== "MIGRATION") {
  throw new Error("Pre-012 backup was not captured in MIGRATION mode.");
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

  const beforeMode = await client.query(`
    SELECT setting_value
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE'
    FOR UPDATE
  `);
  if (beforeMode.rows[0]?.setting_value !== "MIGRATION") {
    throw new Error("Migration 012 may only be deployed while mode is MIGRATION.");
  }

  await client.query(sql);
  await client.query(
    `
      INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
      VALUES ($1, $2, ARRAY[$3]::TEXT[])
      ON CONFLICT (version) DO UPDATE
      SET name = EXCLUDED.name, statements = EXCLUDED.statements
    `,
    [
      "20260728280000",
      "012_frontend_operational_api",
      "-- Applied from repository migration with verified pre-012 backup.",
    ],
  );

  const verification = await client.query(`
    SELECT
      (
        SELECT setting_value = 'MIGRATION'
        FROM public.system_settings
        WHERE setting_key = 'SYSTEM_MODE'
      ) AS mode_preserved,
      (
        SELECT count(*) = 5
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
      ) AS functions_present,
      (
        SELECT bool_and(
          NOT has_function_privilege('public', p.oid, 'EXECUTE')
        )
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
      ) AS public_execute_revoked
  `);

  const checks = verification.rows[0];
  if (
    !checks.mode_preserved ||
    !checks.functions_present ||
    !checks.public_execute_revoked
  ) {
    throw new Error("Migration 012 post-deployment verification failed.");
  }

  await client.query("COMMIT");
  console.log(
    JSON.stringify(
      {
        deployment: "PASS",
        migration: "20260728280000_012_frontend_operational_api",
        backupManifest: manifestPath,
        mode: "MIGRATION",
        verification: checks,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
