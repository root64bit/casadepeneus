import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function cleanupSynthetic() {
  console.log("Cleaning up synthetic test batches...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
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
