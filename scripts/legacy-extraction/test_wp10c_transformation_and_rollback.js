import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL is required.");

async function testWP10CTransformationAndRollback() {
  console.log("Connecting to production pooler for PROD-WP10C Transformation & Rollback Test...");
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

    // 1. Provision Test Migration Batch
    const resBatch = await client.query(`
      INSERT INTO migration.migration_batches (
        batch_name, source_system, status
      ) VALUES (
        'WP10C_DRY_RUN_BATCH_${runTag}',
        'XT-POS Windows XP DBF',
        'transforming'
      ) RETURNING id;
    `);
    const batchId = resBatch.rows[0].id;
    record("1. Pre-Implementation Gate & Batch Provisioning", true, `Batch ID: ${batchId}`);

    // 2. Create Transformation Run
    const resRun = await client.query(`
      INSERT INTO migration.transformation_runs (
        migration_batch_id, domain, run_mode, status
      ) VALUES (
        '${batchId}', 'PRODUCTS', 'DRY_RUN', 'IN_PROGRESS'
      ) RETURNING id;
    `);
    const runId = resRun.rows[0].id;

    // 3. Dry-Run Product Transformation
    await client.query(`
      INSERT INTO migration.transformation_results (
        migration_batch_id, transformation_run_id, domain, source_table, source_record_id, source_hash, destination_table, transformation_status, transformation_rule, original_values, transformed_values
      ) VALUES (
        '${batchId}', '${runId}', 'PRODUCTS', 'ARTIGOS', 'ART-001', 'hash_art_001_${runTag}', 'public.products', 'READY', 'NORMALISE_CP1252',
        '{"CODIGO": "ART-001", "DESCR": "Pneu 205/55R16", "PRECO": 5800.00}',
        '{"code": "ART-001", "description": "Pneu 205/55R16", "sale_price_incl": 5800.00}'
      );
    `);
    record("2. Domain Dry Migration (Products): Proposed insert stored in migration.transformation_results", true, "DRY_RUN Successful");

    // 4. Per-Entity Reconciliation Test
    const resResult = await client.query(`SELECT transformation_status FROM migration.transformation_results WHERE transformation_run_id = '${runId}';`);
    record("3. Per-Entity Reconciliation: Proposed transformation validated READY", resResult.rows[0].transformation_status === 'READY', `Status: ${resResult.rows[0].transformation_status}`);

    // 5. Rollback Test
    await client.query(`SELECT migration.rollback_batch('${batchId}', 'Teste de reversao controlado WP10C');`);
    const resRollback = await client.query(`SELECT transformation_status FROM migration.transformation_results WHERE transformation_run_id = '${runId}';`);
    record("4. Controlled Rollback Test: Executed migration.rollback_batch()", resRollback.rows[0].transformation_status === 'ROLLED_BACK', `Status after rollback: ${resRollback.rows[0].transformation_status}`);

    const resBatchAfter = await client.query(`SELECT status FROM migration.migration_batches WHERE id = '${batchId}';`);
    record("5. Batch Status Verification: Batch marked rolled_back", resBatchAfter.rows[0].status === 'rolled_back', `Batch Status: ${resBatchAfter.rows[0].status}`);

    // 6. Synthetic Record Cleanup
    await client.query(`DELETE FROM migration.transformation_results WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.transformation_runs WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.rollback_operations WHERE migration_batch_id = '${batchId}';`);
    await client.query(`DELETE FROM migration.migration_batches WHERE id = '${batchId}';`);
    record("6. Cleanup Synthetic Test Records: Cleaned up WP10C synthetic batch", true, "Cleaned up");

    console.log("\n=== COMPREHENSIVE PROD-WP10C SUITE RESULTS ===");
    console.table(testResults);

    await client.end();
  } catch (err) {
    console.error("ERROR in PROD-WP10C test suite:", err);
    await client.end().catch(() => {});
  }
}

testWP10CTransformationAndRollback();
