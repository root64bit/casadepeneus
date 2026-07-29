import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const queryRows = async (sql) => (await client.query(sql)).rows;

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");

  const output = {
    mode: await queryRows(
      "SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'",
    ),
    batches: await queryRows(`
      SELECT id, batch_name, source_system, status, total_records, valid_records,
             error_records, created_at, completed_at, legacy_freeze_at
      FROM migration.migration_batches
      ORDER BY created_at
    `),
    tables: await queryRows(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'migration'
      ORDER BY tablename
    `),
    runs: await queryRows(`
      SELECT migration_batch_id, domain, run_mode, status, count(*)::int AS runs
      FROM migration.transformation_runs
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2
    `),
    results: await queryRows(`
      SELECT migration_batch_id, domain, transformation_status,
             count(*)::int AS records
      FROM migration.transformation_results
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3
    `),
    controlCounts: {
      migrationSources: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.migration_sources
        GROUP BY 1 ORDER BY 1
      `),
      rawImportResults: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.raw_import_results
        GROUP BY 1 ORDER BY 1
      `),
      reconciliationResults: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.reconciliation_results
        GROUP BY 1 ORDER BY 1
      `),
      businessDecisions: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.business_decisions
        GROUP BY 1 ORDER BY 1
      `),
      unitMaps: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.unit_maps
        GROUP BY 1 ORDER BY 1
      `),
      taxCodeMaps: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.tax_code_maps
        GROUP BY 1 ORDER BY 1
      `),
      paymentMethodMaps: await queryRows(`
        SELECT migration_batch_id, count(*)::int AS records
        FROM migration.payment_method_maps
        GROUP BY 1 ORDER BY 1
      `),
    },
    migrationHistory: await queryRows(`
      SELECT version
      FROM supabase_migrations.schema_migrations
      ORDER BY version
    `),
  };

  const rawTables = output.tables.filter(({ tablename }) =>
    tablename.endsWith("_raw"),
  );
  output.rawCounts = [];

  for (const { tablename } of rawTables) {
    const [counts] = await queryRows(`
      SELECT count(*)::int AS records,
             count(DISTINCT migration_batch_id)::int AS batches
      FROM migration.${tablename}
    `);
    output.rawCounts.push({ table: tablename, ...counts });
  }

  console.log(JSON.stringify(output, null, 2));
  await client.query("ROLLBACK");
} finally {
  await client.end();
}
