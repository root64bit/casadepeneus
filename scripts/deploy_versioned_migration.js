import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

dotenv.config();

const required = [
  "DATABASE_URL",
  "BACKUP_OUTPUT_DIR",
  "MIGRATION_FILE",
  "MIGRATION_VERSION",
  "MIGRATION_NAME",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required.`);
}

const manifestPath = path.join(
  process.env.BACKUP_OUTPUT_DIR,
  "pre-012-manifest.json",
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const file of manifest.files) {
  const bytes = fs.readFileSync(
    path.join(process.env.BACKUP_OUTPUT_DIR, file.name),
  );
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== file.sha256) {
    throw new Error(`Backup checksum mismatch: ${file.name}`);
  }
}
if (manifest.systemMode !== "MIGRATION") {
  throw new Error("Deployment backup must be captured in MIGRATION mode.");
}

const originalSql = fs.readFileSync(process.env.MIGRATION_FILE, "utf8");
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
  const mode = await client.query(`
    SELECT setting_value
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE'
    FOR UPDATE
  `);
  if (mode.rows[0]?.setting_value !== "MIGRATION") {
    throw new Error("Deployment is restricted to MIGRATION mode.");
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
      process.env.MIGRATION_VERSION,
      process.env.MIGRATION_NAME,
      "-- Applied by deploy_versioned_migration.js with verified backup.",
    ],
  );

  const afterMode = await client.query(`
    SELECT setting_value
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE'
  `);
  if (afterMode.rows[0]?.setting_value !== "MIGRATION") {
    throw new Error("System mode changed during deployment.");
  }

  await client.query("COMMIT");
  console.log(
    JSON.stringify(
      {
        deployment: "PASS",
        version: process.env.MIGRATION_VERSION,
        name: process.env.MIGRATION_NAME,
        backupManifest: manifestPath,
        systemMode: "MIGRATION",
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
