import pkg from 'pg';
const { Client } = pkg;

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function testContactMigrationBatch() {
  console.log("Connecting to production pooler for PROD-WP07 Synthetic Batch Test...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Create Migration Batch
    const resBatch = await client.query(`
      INSERT INTO migration.migration_batches (batch_name, source_system)
      VALUES ('SYNTHETIC-CONTACT-BATCH-001', 'XT-POS PRO v3.50')
      RETURNING id;
    `);
    const batchId = resBatch.rows[0].id;
    console.log("Created test batch ID:", batchId);

    // 2. Insert 5 Synthetic Customers into migration.customers_raw
    await client.query(`
      INSERT INTO migration.customers_raw (
        migration_batch_id, source_file, source_record_id, legacy_number, legacy_name, legacy_address, legacy_postal_code, legacy_telephone, legacy_email, legacy_tax_number, legacy_payment_condition, legacy_credit_limit, legacy_balance, raw_payload, source_hash
      ) VALUES 
        ('${batchId}', 'CLIENTES.DBF', 'CUST-001', 'CLI-001', 'Transportes Mambas, Lda.', 'Av. 24 de Julho 1234', '1100', '+258 84 100 0001', 'geral@mambas.co.mz', '400999001', '30_DIAS', '250000.00', '45000.00', '{"raw":"data1"}', 'hash_cust_001'),
        ('${batchId}', 'CLIENTES.DBF', 'CUST-002', 'CLI-002', 'Construções Rovuma, S.A.', 'Rua da Beira 45', '1200', '+258 82 200 0002', 'compras@rovuma.co.mz', '400999002', '15_DIAS', '500000.00', '120000.00', '{"raw":"data2"}', 'hash_cust_002'),
        ('${batchId}', 'CLIENTES.DBF', 'CUST-003', 'CLI-003', 'Frotas do Sul, Lda.', 'Av. de Moçambique 890', '1105', '+258 86 300 0003', 'contact@frotassul.co.mz', '400999003', 'DINHEIRO', '0.00', '0.00', '{"raw":"data3"}', 'hash_cust_003'),
        ('${batchId}', 'CLIENTES.DBF', 'CUST-004', 'CLI-004', 'Cliente Final Exemplo', 'Av. Julius Nyerere 12', '1100', '+258 84 400 0004', 'cliente4@example.com', '400999004', 'DINHEIRO', '0.00', '0.00', '{"raw":"data4"}', 'hash_cust_004'),
        ('${batchId}', 'CLIENTES.DBF', 'CUST-005', 'CLI-005', 'Logística Express, Lda.', 'Zona Industrial da Matola', '1300', '+258 84 500 0005', 'ops@express.co.mz', '400999005', '60_DIAS', '1000000.00', '350000.00', '{"raw":"data5"}', 'hash_cust_005');
    `);
    console.log("Inserted 5 synthetic raw customer records.");

    // 3. Insert 5 Synthetic Suppliers into migration.suppliers_raw
    await client.query(`
      INSERT INTO migration.suppliers_raw (
        migration_batch_id, source_file, source_record_id, legacy_number, legacy_name, legacy_address, legacy_postal_code, legacy_telephone, legacy_email, legacy_tax_number, legacy_payment_condition, legacy_credit_limit, legacy_balance, raw_payload, source_hash
      ) VALUES 
        ('${batchId}', 'FORNEC.DBF', 'SUPP-001', 'FOR-001', 'Bridgestone South Africa (Pty) Ltd', 'Isando, Johannesburg', '1600', '+27 11 923 0000', 'orders@bridgestone.co.za', '999888001', '30_DIAS', '2000000.00', '1800000.00', '{"raw":"supp1"}', 'hash_supp_001'),
        ('${batchId}', 'FORNEC.DBF', 'SUPP-002', 'FOR-002', 'Michelin Moçambique, Lda.', 'Av. das Indústrias 500, Matola', '1300', '+258 21 700 111', 'comercial@michelin.co.mz', '400777002', '30_DIAS', '1500000.00', '650000.00', '{"raw":"supp2"}', 'hash_supp_002'),
        ('${batchId}', 'FORNEC.DBF', 'SUPP-003', 'FOR-003', 'Distribuidora de Jantes Maputo', 'Av. 25 de Setembro 2100', '1100', '+258 84 333 4444', 'vendas@jantesmaputo.co.mz', '400777003', '15_DIAS', '300000.00', '45000.00', '{"raw":"supp3"}', 'hash_supp_003'),
        ('${batchId}', 'FORNEC.DBF', 'SUPP-004', 'FOR-004', 'Acessórios & Válvulas, Lda.', 'Rua da Eletricidade 12', '1100', '+258 82 555 6666', 'geral@acessorios.co.mz', '400777004', 'DINHEIRO', '0.00', '0.00', '{"raw":"supp4"}', 'hash_supp_004'),
        ('${batchId}', 'FORNEC.DBF', 'SUPP-005', 'FOR-005', 'Goodyear Middle East & Africa', 'Dubai South Free Zone', '0000', '+971 4 800 0000', 'africa.orders@goodyear.com', '999888005', '60_DIAS', '3000000.00', '1200000.00', '{"raw":"supp5"}', 'hash_supp_005');
    `);
    console.log("Inserted 5 synthetic raw supplier records.");

    // 4. Run Customer Transformation RPC
    console.log("Executing migration.process_customer_migration_batch...");
    const resCustProc = await client.query(`SELECT * FROM migration.process_customer_migration_batch('${batchId}');`);
    console.log("Customer Transformation Results:", resCustProc.rows[0]);

    // 5. Run Supplier Transformation RPC
    console.log("Executing migration.process_supplier_migration_batch...");
    const resSuppProc = await client.query(`SELECT * FROM migration.process_supplier_migration_batch('${batchId}');`);
    console.log("Supplier Transformation Results:", resSuppProc.rows[0]);

    // 6. Run Customer Reconciliation RPC
    console.log("Executing migration.reconcile_customer_batch...");
    const resCustReconcile = await client.query(`SELECT * FROM migration.reconcile_customer_batch('${batchId}');`);
    console.log("=== CUSTOMER RECONCILIATION ===");
    console.table(resCustReconcile.rows);

    // 7. Run Supplier Reconciliation RPC
    console.log("Executing migration.reconcile_supplier_batch...");
    const resSuppReconcile = await client.query(`SELECT * FROM migration.reconcile_supplier_batch('${batchId}');`);
    console.log("=== SUPPLIER RECONCILIATION ===");
    console.table(resSuppReconcile.rows);

    await client.end();
  } catch (err) {
    console.error("ERROR running synthetic contact migration batch test:", err);
    await client.end().catch(() => {});
  }
}

testContactMigrationBatch();
