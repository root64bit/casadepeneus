import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const sql = fs.readFileSync(
  'supabase/migrations/20260728320000_016_users_dynamic_data_and_mobile_security.sql',
  'utf8',
).replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const expectedManager = [
  'dashboard.read', 'products.read', 'stock.read', 'stock.direct_entry',
  'stock.direct_exit', 'customers.read', 'suppliers.read', 'sales.read',
  'purchases.read', 'payments.read', 'accounts.read', 'reports.read',
  'reports.export', 'documents.print',
];
const forbiddenManager = [
  'products.create', 'customers.create', 'suppliers.create', 'sales.create',
  'purchases.invoice.create', 'payments.receive', 'payments.pay_supplier',
  'users.manage', 'roles.manage', 'settings.manage', 'migration.manage',
  'migration.execute', 'system_mode.manage',
];

try {
  await client.connect();
  const initialMode = await client.query(
    "SELECT setting_value FROM public.system_settings WHERE setting_key='SYSTEM_MODE'",
  );
  const expectedSystemMode = initialMode.rows[0]?.setting_value;
  if (!expectedSystemMode) throw new Error('SYSTEM_MODE is not configured.');

  await client.query('BEGIN');
  await client.query(sql);

  const roles = await client.query(`
    SELECT r.code, array_agg(p.code ORDER BY p.code) permissions
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.code IN ('ADMINISTRATOR', 'MANAGER_LIMITED')
    GROUP BY r.code ORDER BY r.code
  `);
  const manager = roles.rows.find((row) => row.code === 'MANAGER_LIMITED')?.permissions ?? [];
  const admin = roles.rows.find((row) => row.code === 'ADMINISTRATOR')?.permissions ?? [];
  const missing = expectedManager.filter((code) => !manager.includes(code));
  const forbidden = forbiddenManager.filter((code) => manager.includes(code));
  if (missing.length || forbidden.length) {
    throw new Error(`Manager matrix invalid. Missing=${missing}; forbidden=${forbidden}`);
  }
  if (admin.includes('migration.execute') || admin.includes('system_mode.manage')) {
    throw new Error('Administrator received prohibited migration/mode authority.');
  }

  const functions = await client.query(`
    SELECT p.proname,
      has_function_privilege('public', p.oid, 'EXECUTE') public_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_public_login_context', 'get_current_user_context',
      'complete_first_login_password_change', 'record_access_denied',
      'get_dashboard_metrics', 'post_operational_stock_movement_v2'
    ) ORDER BY p.proname
  `);
  if (functions.rowCount !== 6 || functions.rows.some((row) => row.public_execute)) {
    throw new Error('Function privilege verification failed.');
  }

  const mode = await client.query(
    "SELECT setting_value FROM public.system_settings WHERE setting_key='SYSTEM_MODE'",
  );
  if (mode.rows[0]?.setting_value !== expectedSystemMode) throw new Error('SYSTEM_MODE changed.');

  console.log(JSON.stringify({
    validation: 'PASS',
    managerPermissionCount: manager.length,
    administratorPermissionCount: admin.length,
    managerMissing: missing,
    managerForbidden: forbidden,
    functions: functions.rows,
    systemMode: expectedSystemMode,
    outcome: 'ROLLBACK',
  }, null, 2));
  await client.query('ROLLBACK');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
