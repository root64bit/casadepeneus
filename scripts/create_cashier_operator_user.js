import pg from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const connStr = process.env.DATABASE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!connStr) throw new Error("DATABASE_URL is required.");
if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase URL and Anon Key are required.");

async function createCashierUser() {
  console.log("Creating Operador de Caixa User in Supabase Auth & Database...");

  const pgClient = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    await pgClient.connect();

    // 1. Get default company_id
    const compRes = await pgClient.query(`SELECT id FROM public.companies LIMIT 1;`);
    const companyId = compRes.rows[0].id;
    console.log(`Company ID: ${companyId}`);

    // 2. Ensure CASHIER role exists with sales.create permission
    let roleRes = await pgClient.query(`SELECT id FROM public.roles WHERE code = 'CASHIER' LIMIT 1;`);
    let roleId;
    if (roleRes.rows.length === 0) {
      const newRole = await pgClient.query(`
        INSERT INTO public.roles (company_id, code, name, description, is_system_role)
        VALUES ('${companyId}', 'CASHIER', 'Operador de Caixa', 'Operador de caixa restrito a Vendas e Cotações', true)
        RETURNING id;
      `);
      roleId = newRole.rows[0].id;
      console.log(`Created CASHIER role with ID ${roleId}`);
    } else {
      roleId = roleRes.rows[0].id;
      console.log(`Found CASHIER role with ID ${roleId}`);
    }

    // Assign sales.create permission to CASHIER role
    await pgClient.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT '${roleId}', p.id
      FROM public.permissions p
      WHERE p.code IN ('sales.create', 'sales.read', 'documents.view')
      ON CONFLICT DO NOTHING;
    `);
    console.log("Assigned permissions (sales.create, sales.read, documents.view) to CASHIER role.");

    // 3. Register user in Supabase Auth
    const email = 'caixa@casadepneus.com';
    const username = 'caixa';
    const fullName = 'Operador de Caixa';
    const password = 'caixa123456';
    const phone = '840000000';

    console.log(`Attempting to sign up user ${email} in Auth...`);
    const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
        }
      }
    });

    let userId;
    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`User ${email} already exists in Auth. Fetching ID from user_profiles or auth.users...`);
        const userRes = await pgClient.query(`SELECT id FROM auth.users WHERE email = '${email}';`);
        userId = userRes.rows[0].id;
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
      console.log(`Created Auth User ID: ${userId}`);
    }

    // 4. Upsert user_profiles and user_roles
    await pgClient.query(`
      INSERT INTO public.user_profiles (id, company_id, username, full_name, email, phone, is_active)
      VALUES ('${userId}', '${companyId}', '${username}', '${fullName}', '${email}', '${phone}', true)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        is_active = true;
    `);

    await pgClient.query(`
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES ('${userId}', '${roleId}')
      ON CONFLICT DO NOTHING;
    `);

    console.log("================================================================================");
    console.log("✅ OPERADOR DE CAIXA CREATED SUCCESSFULLY!");
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log("Permissions: Restrito a Vendas (Guia de Remessa) e Cotações");
    console.log("================================================================================");

  } catch (err) {
    console.error("❌ ERROR creating Cashier User:", err);
  } finally {
    await pgClient.end().catch(() => {});
  }
}

createCashierUser();
