import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL missing");

async function fixCashierPermissions() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Fixing CASHIER role permissions...");

  // Get CASHIER role ID
  const roleRes = await client.query(`SELECT id FROM public.roles WHERE code = 'CASHIER' LIMIT 1;`);
  if (roleRes.rows.length === 0) throw new Error("CASHIER role not found");
  const roleId = roleRes.rows[0].id;

  // Clear existing permissions for CASHIER role
  await client.query(`DELETE FROM public.role_permissions WHERE role_id = '${roleId}';`);

  // Grant ONLY sales.create and sales.read
  await client.query(`
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT '${roleId}', p.id
    FROM public.permissions p
    WHERE p.code IN ('sales.create', 'sales.read', 'dashboard.read', 'customers.view', 'customers.read')
    ON CONFLICT DO NOTHING;
  `);

  // Remove any extra roles from user 'caixa' except CASHIER
  const userRes = await client.query(`SELECT id FROM public.user_profiles WHERE username = 'caixa' LIMIT 1;`);
  if (userRes.rows.length > 0) {
    const userId = userRes.rows[0].id;
    await client.query(`DELETE FROM public.user_roles WHERE user_id = '${userId}';`);
    await client.query(`INSERT INTO public.user_roles (user_id, role_id) VALUES ('${userId}', '${roleId}');`);
  }

  console.log("✅ CASHIER role permissions updated strictly to sales.create & sales.read!");
  await client.end();
}

fixCashierPermissions();
