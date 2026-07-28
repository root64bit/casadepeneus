import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.database_url;

async function cleanupWP08Synthetic() {
  console.log("Cleaning up PROD-WP08 synthetic test records...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Delete synthetic document lines, documents, stock movements, ledger entries, products, customers & suppliers
    await client.query("DELETE FROM public.document_lines WHERE product_id IN (SELECT id FROM public.products WHERE code LIKE 'PN-TEST-%');");
    await client.query("DELETE FROM public.ledger_entries WHERE entry_type LIKE 'CUSTOMER_%' OR entry_type LIKE 'SUPPLIER_%';");
    await client.query("DELETE FROM public.stock_movements WHERE product_id IN (SELECT id FROM public.products WHERE code LIKE 'PN-TEST-%');");
    await client.query("DELETE FROM public.inventory_balances WHERE product_id IN (SELECT id FROM public.products WHERE code LIKE 'PN-TEST-%');");
    await client.query("DELETE FROM public.documents WHERE customer_id IN (SELECT id FROM public.customers WHERE customer_number LIKE 'TEST-CLI-%') OR supplier_id IN (SELECT id FROM public.suppliers WHERE supplier_number LIKE 'TEST-FOR-%');");
    await client.query("DELETE FROM public.products WHERE code LIKE 'PN-TEST-%';");
    await client.query("DELETE FROM public.customers WHERE customer_number LIKE 'TEST-CLI-%';");
    await client.query("DELETE FROM public.suppliers WHERE supplier_number LIKE 'TEST-FOR-%';");
    await client.query("DELETE FROM public.user_profiles WHERE username = 'admin_wp08';");
    await client.query("DELETE FROM auth.users WHERE email = 'admin_wp08@casadepeneus.co.mz';");

    console.log("PROD-WP08 synthetic test records cleaned up cleanly.");
    await client.end();
  } catch (err) {
    console.error("ERROR cleaning up WP08 synthetic data:", err);
    await client.end().catch(() => {});
  }
}

cleanupWP08Synthetic();
