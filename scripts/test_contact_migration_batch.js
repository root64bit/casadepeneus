import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function testContactMigrationBatch() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const resBatch = await client.query(`
      INSERT INTO migration.migration_batches (batch_name, source_system)
      VALUES ('SYNTHETIC-CONTACT-BATCH-001', 'XT-POS PRO v3.50')
      RETURNING id;
    `);
    const batchId = resBatch.rows[0].id;
    console.log("Created test batch ID:", batchId);

    await client.query(`
      INSERT INTO migration.customers_raw (
        migration_batch_id, source_file, source_record_id, legacy_number, legacy_name, legacy_address, legacy_postal_code, legacy_telephone, legacy_email, legacy_tax_number, legacy_payment_condition, legacy_credit_limit, legacy_balance, raw_payload, source_hash
      ) VALUES 
        ('${batchId}', 'CLIENTES.DBF', 'CUST-001', 'CLI-001', 'Transportes Mambas, Lda.', 'Av. 24 de Julho 1234', '1100', '+258 84 100 0001', 'geral@mambas.co.mz', '400999001', '30_DIAS', '250000.00', '45000.00', '{"raw":"data1"}', 'hash_cust_001');
    `);

    const resCustProc = await client.query(`SELECT * FROM migration.process_customer_migration_batch('${batchId}');`);
    console.log("Customer Transformation Results:", resCustProc.rows[0]);

    // Clean up
    await client.query(`DELETE FROM migration.migration_batches WHERE id = '${batchId}';`);
    await client.query(`DELETE FROM public.customers WHERE customer_number = 'CLI-001';`);

    await client.end();
  } catch (err) {
    console.error("ERROR running contact migration test:", err);
    await client.end().catch(() => {});
  }
}

testContactMigrationBatch();
