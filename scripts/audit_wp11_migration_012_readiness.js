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

const rows = async (sql, params = []) => (await client.query(sql, params)).rows;

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");

  const output = {
    checkedAt: new Date().toISOString(),
    database: await rows(`
      SELECT current_database() AS database_name,
             current_user AS database_user,
             current_setting('server_version') AS server_version
    `),
    mode: await rows(`
      SELECT setting_value
      FROM public.system_settings
      WHERE setting_key = 'SYSTEM_MODE'
    `),
    migrationHistory: await rows(`
      SELECT version
      FROM supabase_migrations.schema_migrations
      ORDER BY version
    `),
    migration012Functions: await rows(`
      SELECT n.nspname AS schema_name,
             p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'require_operational_mode',
          'create_operational_product',
          'post_operational_stock_movement',
          'create_and_confirm_customer_sale',
          'create_and_confirm_customer_payment'
        )
      ORDER BY p.proname
    `),
    publicSensitiveFunctionExecute: await rows(`
      SELECT n.nspname AS schema_name,
             p.proname AS function_name,
             has_function_privilege(
               'public',
               p.oid,
               'EXECUTE'
             ) AS public_can_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private'
        AND p.proname IN (
          'confirm_customer_document',
          'confirm_supplier_document',
          'confirm_customer_payment',
          'confirm_supplier_payment',
          'allocate_payment'
        )
      ORDER BY p.proname
    `),
    users: await rows(`
      SELECT count(*)::int AS profiles,
             count(*) FILTER (WHERE is_active)::int AS active_profiles
      FROM public.user_profiles
    `),
    businessCounts: await rows(`
      SELECT
        (SELECT count(*)::int FROM public.products) AS products,
        (SELECT count(*)::int FROM public.customers) AS customers,
        (SELECT count(*)::int FROM public.suppliers) AS suppliers,
        (SELECT count(*)::int FROM public.documents) AS documents,
        (SELECT count(*)::int FROM public.stock_movements) AS stock_movements,
        (SELECT count(*)::int FROM public.payments) AS payments
    `),
    requiredColumns: await rows(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'documents' AND column_name IN (
            'id', 'company_id', 'branch_id', 'warehouse_id',
            'document_type_id', 'fiscal_period_id', 'customer_id',
            'payment_term_id', 'idempotency_key', 'status'
          ))
          OR
          (table_name = 'payments' AND column_name IN (
            'id', 'company_id', 'branch_id', 'fiscal_period_id',
            'customer_id', 'idempotency_key', 'status'
          ))
        )
      ORDER BY table_name, column_name
    `),
  };

  console.log(JSON.stringify(output, null, 2));
  await client.query("ROLLBACK");
} finally {
  await client.end();
}
