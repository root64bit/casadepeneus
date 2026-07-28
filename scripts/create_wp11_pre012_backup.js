import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const outputDirectory =
  process.env.BACKUP_OUTPUT_DIR ??
  "C:\\tmp\\casadepeneus-wp11-20260728-1848";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const queryRows = async (sql, params = []) => (await client.query(sql, params)).rows;
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const tables = await queryRows(`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'private', 'migration', 'audit')
    ORDER BY schemaname, tablename
  `);

  const data = {
    metadata: {
      createdAt: new Date().toISOString(),
      backupType: "READ_ONLY_APPLICATION_SCHEMA_LOGICAL_BACKUP",
      schemas: ["public", "private", "migration", "audit"],
      systemMode: (
        await queryRows(`
          SELECT setting_value
          FROM public.system_settings
          WHERE setting_key = 'SYSTEM_MODE'
        `)
      )[0]?.setting_value,
    },
    tables: {},
  };

  for (const table of tables) {
    const key = `${table.schemaname}.${table.tablename}`;
    data.tables[key] = await queryRows(
      `SELECT * FROM ${quoteIdentifier(table.schemaname)}.${quoteIdentifier(table.tablename)}`,
    );
  }

  const schemaMetadata = {
    columns: await queryRows(`
      SELECT table_schema, table_name, ordinal_position, column_name,
             data_type, udt_schema, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema IN ('public', 'private', 'migration', 'audit')
      ORDER BY table_schema, table_name, ordinal_position
    `),
    constraints: await queryRows(`
      SELECT n.nspname AS schema_name, c.relname AS table_name,
             con.conname AS constraint_name,
             pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'private', 'migration', 'audit')
      ORDER BY n.nspname, c.relname, con.conname
    `),
    indexes: await queryRows(`
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname IN ('public', 'private', 'migration', 'audit')
      ORDER BY schemaname, tablename, indexname
    `),
    policies: await queryRows(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd,
             qual, with_check
      FROM pg_policies
      WHERE schemaname IN ('public', 'private', 'migration', 'audit')
      ORDER BY schemaname, tablename, policyname
    `),
    functions: await queryRows(`
      SELECT n.nspname AS schema_name, p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments,
             pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'private', 'migration', 'audit')
      ORDER BY n.nspname, p.proname, arguments
    `),
  };

  await client.query("ROLLBACK");

  fs.mkdirSync(outputDirectory, { recursive: true });
  const dataPath = path.join(outputDirectory, "pre-012-application-data.json.gz");
  const schemaPath = path.join(outputDirectory, "pre-012-schema-metadata.json.gz");
  fs.writeFileSync(dataPath, zlib.gzipSync(JSON.stringify(data)));
  fs.writeFileSync(schemaPath, zlib.gzipSync(JSON.stringify(schemaMetadata)));

  const manifest = {
    createdAt: data.metadata.createdAt,
    systemMode: data.metadata.systemMode,
    files: [dataPath, schemaPath].map((filePath) => {
      const bytes = fs.readFileSync(filePath);
      return {
        name: path.basename(filePath),
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      };
    }),
    tableCounts: Object.fromEntries(
      Object.entries(data.tables).map(([table, tableRows]) => [
        table,
        tableRows.length,
      ]),
    ),
  };
  const manifestPath = path.join(outputDirectory, "pre-012-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        outputDirectory,
        systemMode: manifest.systemMode,
        files: manifest.files,
        tables: Object.keys(manifest.tableCounts).length,
        totalRows: Object.values(manifest.tableCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
