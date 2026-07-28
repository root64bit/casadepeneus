import pkg from 'pg';
const { Client } = pkg;

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function testMigrationBatch() {
  console.log("Connecting to production pooler for migration test...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Create Migration Batch
    const resBatch = await client.query(`
      INSERT INTO migration.migration_batches (batch_name, source_system)
      VALUES ('TEST-XT-POS-BATCH-001', 'XT-POS PRO v3.50')
      RETURNING id;
    `);
    const batchId = resBatch.rows[0].id;
    console.log("Created test batch ID:", batchId);

    // 2. Insert Sample Legacy Products into migration.products_raw
    await client.query(`
      INSERT INTO migration.products_raw (
        migration_batch_id, source_file, source_record_id, legacy_code, legacy_description, legacy_family, legacy_brand, legacy_unit, legacy_price, legacy_stock, legacy_cost
      ) VALUES 
        ('${batchId}', 'ARTIGOS.DBF', 'REC-001', 'PN-1956515', 'Pneu 195/65R15 91V Turanza T005', 'PNEU', 'Bridgestone', 'UN', 4500.00, 24.000, 3200.00),
        ('${batchId}', 'ARTIGOS.DBF', 'REC-002', 'PN-2055516', 'Pneu 205/55R16 91V Primacy 4', 'PNEU', 'Michelin', 'UN', 5800.00, 18.000, 4100.00),
        ('${batchId}', 'ARTIGOS.DBF', 'REC-003', 'SERV-ALINH', 'Serviço de Alinhamento Direção 3D', 'SERV', 'Serviço Interno', 'UN', 1200.00, 0.000, 0.00);
    `);
    console.log("Inserted 3 raw legacy product records.");

    // 3. Insert Sample Opening Stock into migration.stock_movements_raw
    await client.query(`
      INSERT INTO migration.stock_movements_raw (
        migration_batch_id, source_file, source_record_id, legacy_product_code, legacy_warehouse_code, legacy_movement_type, legacy_qty, legacy_unit_cost, legacy_date
      ) VALUES 
        ('${batchId}', 'STK_BAL.DBF', 'STK-001', 'PN-1956515', 'ARM01', 'opening_stock', 24.000, 3200.00, '2026-01-01'),
        ('${batchId}', 'STK_BAL.DBF', 'STK-002', 'PN-2055516', 'ARM01', 'opening_stock', 18.000, 4100.00, '2026-01-01');
    `);
    console.log("Inserted 2 raw opening stock records.");

    // 4. Run Article Transformation RPC
    console.log("Executing migration.process_article_migration_batch...");
    const resProdProc = await client.query(`SELECT * FROM migration.process_article_migration_batch('${batchId}');`);
    console.log("Article Transformation Results:", resProdProc.rows[0]);

    // 5. Run Opening Stock Transformation RPC
    console.log("Executing migration.process_opening_stock_migration_batch...");
    const resStockProc = await client.query(`SELECT * FROM migration.process_opening_stock_migration_batch('${batchId}');`);
    console.log("Stock Transformation Results:", resStockProc.rows[0]);

    // 6. Run Reconciliation Gate RPC
    console.log("Executing migration.reconcile_article_stock_batch...");
    const resReconcile = await client.query(`SELECT * FROM migration.reconcile_article_stock_batch('${batchId}');`);
    console.table(resReconcile.rows);

    await client.end();
  } catch (err) {
    console.error("ERROR running migration batch test:", err);
    await client.end().catch(() => {});
  }
}

testMigrationBatch();
