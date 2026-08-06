import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL missing");

async function updateCustomersRls() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Updating customers table RLS policies...");

  await client.query(`
    DROP POLICY IF EXISTS "customers_select" ON public.customers;
    CREATE POLICY "customers_select" ON public.customers
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "customers_insert" ON public.customers;
    CREATE POLICY "customers_insert" ON public.customers
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "customers_update" ON public.customers;
    CREATE POLICY "customers_update" ON public.customers
        FOR UPDATE TO authenticated USING (true);
  `);

  console.log("✅ Customers RLS policies updated to allow authenticated SELECT/INSERT!");
  await client.end();
}

updateCustomersRls().catch(console.error);
