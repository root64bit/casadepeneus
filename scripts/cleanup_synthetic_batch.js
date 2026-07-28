import pkg from 'pg';
const { Client } = pkg;

const connStr = "postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function cleanupSynthetic() {
  console.log("Cleaning up synthetic test batches...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Delete synthetic customer and supplier records created by test batches
    await client.query("DELETE FROM public.customers WHERE customer_number LIKE 'CLI-%';");
    await client.query("DELETE FROM public.suppliers WHERE supplier_number LIKE 'FOR-%';");
    await client.query("DELETE FROM migration.migration_batches WHERE batch_name LIKE 'SYNTHETIC-%' OR batch_name LIKE 'TEST-%';");

    console.log("Synthetic test records cleaned up cleanly.");
    await client.end();
  } catch (err) {
    console.error("ERROR cleaning up synthetic data:", err);
    await client.end().catch(() => {});
  }
}

cleanupSynthetic();
