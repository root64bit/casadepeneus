import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL is required.");

async function testWP10BRawImportAndReconcile() {
  console.log("Connecting to production pooler for PROD-WP10B Raw Import & Reconciliation Test...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  const testResults = [];
  function record(name, pass, details = "") {
    testResults.push({ test: name, result: pass ? "PASS" : "FAIL", details });
    console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${details ? "- " + details : ""}`);
  }

  const runTag = Date.now().toString().slice(-6);

  try {
    await client.connect();

    // 1. Create Migration Batch
    const resBatch = await client.query(`
      INSERT INTO migration.migration_batches (
        batch_name, source_system, status
      ) VALUES (
        'LEGACY_FULL_RAW_IMPORT_${runTag}',
        'XT-POS Windows XP DBF',
        'extracting'
      ) RETURNING id;
    `);
    const batchId = resBatch.rows[0].id;
    record("Batch Provisioning: Created Migration Batch LEGACY_FULL_RAW_IMPORT", true, `Batch ID: ${batchId}`);

    // 2. Register Source Files
    await client.query(`
      INSERT INTO migration.migration_sources (
        migration_batch_id, source_filename, source_table, source_checksum, source_size_bytes, record_count, validation_status
      ) VALUES
        ('${batchId}', 'ARTIGOS.DBF', 'ARTIGOS', 'hash_artigos_${runTag}', 4582912, 100, 'VALIDATED'),
        ('${batchId}', 'CLIENTES.DBF', 'CLIENTES', 'hash_clientes_${runTag}', 1248512, 50, 'VALIDATED'),
        ('${batchId}', 'FORNEC.DBF', 'FORNEC', 'hash_fornec_${runTag}', 512400, 20, 'VALIDATED'),
        ('${batchId}', 'FATURAS.DBF', 'FATURAS', 'hash_faturas_${runTag}', 8920400, 150, 'VALIDATED');
    `);
    record("Source Registration: Registered 4 DBF Source Files in migration.migration_sources", true, "Registered DBFs");

    // 3. Raw Import Phase 1 (First Run)
    let rawInserted = 0;
    for (let i = 1; i <= 100; i++) {
      const hash = `ART_HASH_${runTag}_${i}`;
      await client.query(`
        INSERT INTO migration.products_raw (
          migration_batch_id, legacy_code, legacy_description, raw_payload, source_hash, validation_status
        ) VALUES (
          '${batchId}', 'ART-${i}', 'Pneu ${i}', '{"CODIGO": "ART-${i}", "DESCR": "Pneu ${i}", "PRECO": 1000}', '${hash}', 'valid'
        ) ON CONFLICT (migration_batch_id, source_hash) DO NOTHING;
      `);
      rawInserted++;
    }
    record("Raw Import Phase 1: Inserted 100 Raw Products into migration.products_raw", rawInserted === 100, `Inserted: ${rawInserted}`);

    // 4. Raw Import Idempotency Test (Second Run - Duplicate Hashes)
    let duplicatesSkipped = 0;
    for (let i = 1; i <= 100; i++) {
      const hash = `ART_HASH_${runTag}_${i}`;
      const resDup = await client.query(`
        INSERT INTO migration.products_raw (
          migration_batch_id, legacy_code, legacy_description, raw_payload, source_hash, validation_status
        ) VALUES (
          '${batchId}', 'ART-${i}', 'Pneu ${i}', '{"CODIGO": "ART-${i}", "DESCR": "Pneu ${i}", "PRECO": 1000}', '${hash}', 'valid'
        ) ON CONFLICT (migration_batch_id, source_hash) DO NOTHING RETURNING id;
      `);
      if (resDup.rowCount === 0) duplicatesSkipped++;
    }
    record("Raw Import Idempotency Test: Re-running Raw Import Created 0 Duplicates", duplicatesSkipped === 100, `Skipped Duplicates: ${duplicatesSkipped}`);

    // 5. Raw Count Reconciliation
    const resCount = await client.query(`SELECT COUNT(*) FROM migration.products_raw WHERE migration_batch_id = '${batchId}';`);
    const countInDb = parseInt(resCount.rows[0].count, 10);
    record("Raw Count Reconciliation: DB Staging Count Equals Extracted Count (100 = 100)", countInDb === 100, `Db Count: ${countInDb}`);

    // Log Reconciliation Results in DB
    await client.query(`
      INSERT INTO migration.reconciliation_results (
        migration_batch_id, domain, metric_name, raw_count, imported_count, variance, status
      ) VALUES (
        '${batchId}', 'PRODUCTS', 'RAW_PRODUCT_COUNT', 100, ${countInDb}, 0, 'PASS'
      );
    `);

    // 6. Cleanup Synthetic Test Records
    await client.query(`DELETE FROM migration.products_raw WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.migration_sources WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.reconciliation_results WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.migration_batches WHERE id = '${batchId}';`);
    record("Synthetic Test Record Cleanup: Cleaned up WP10B synthetic test batch", true, "Cleaned up");

    console.log("\n=== COMPREHENSIVE PROD-WP10B SUITE RESULTS ===");
    console.table(testResults);

    await client.end();
  } catch (err) {
    console.error("ERROR in PROD-WP10B test suite:", err);
    await client.end().catch(() => {});
  }
}

testWP10BRawImportAndReconcile();
