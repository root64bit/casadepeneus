import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.service_role || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing service role key or Supabase URL');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fixAllUserCredentials() {
  console.log('🔍 Listing users in Supabase Auth...');
  const { data: usersData, error: listErr } = await adminClient.auth.admin.listUsers();
  
  if (listErr) {
    console.error('List users error:', listErr.message);
    process.exit(1);
  }

  const { data: companyRes } = await adminClient.from('companies').select('id').limit(1);
  const companyId = companyRes?.[0]?.id || 'a0000000-0000-0000-0000-000000000000';

  const targetUsers = [
    {
      email: 'admin@casadepneus.co.mz',
      password: 'Iloveafrica@123',
      roleCode: 'ADMINISTRATOR',
      fullName: 'Administrador Casa de Pneus',
    },
    {
      email: 'gestor@casadepneus.co.mz',
      password: 'GES!9mT2#2026.',
      roleCode: 'MANAGER',
      fullName: 'Gerente Comercial',
    },
    {
      email: 'caixa@casadepneus.com',
      password: 'password123',
      roleCode: 'CASHIER',
      fullName: 'Operador de Caixa',
    },
  ];

  for (const target of targetUsers) {
    let existingUser = usersData.users.find((u) => u.email.toLowerCase() === target.email.toLowerCase());

    if (existingUser) {
      console.log(`🔑 Updating password for existing user ${target.email}...`);
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: target.password,
        email_confirm: true,
      });
      if (updateErr) {
        console.error(`Update password error for ${target.email}:`, updateErr.message);
      } else {
        console.log(`✅ Password for ${target.email} updated to ${target.password}!`);
      }
    } else {
      console.log(`➕ Creating new user ${target.email}...`);
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: target.email,
        password: target.password,
        email_confirm: true,
        user_metadata: { full_name: target.fullName },
      });
      if (createErr) {
        console.error(`Create user error for ${target.email}:`, createErr.message);
      } else {
        console.log(`✅ User ${target.email} created with password ${target.password}!`);
        existingUser = newUser.user;
      }
    }

    if (existingUser?.id) {
      await adminClient.from('user_profiles').upsert({
        id: existingUser.id,
        company_id: companyId,
        full_name: target.fullName,
        system_mode: 'LIVE_OPERATIONAL',
        updated_at: new Date().toISOString(),
      });

      const { data: roleRes } = await adminClient.from('roles').select('id').eq('code', target.roleCode).maybeSingle();
      if (roleRes?.id) {
        await adminClient.from('user_roles').upsert({
          user_id: existingUser.id,
          role_id: roleRes.id,
        });
        console.log(`✅ Role ${target.roleCode} assigned to ${target.email}!`);
      }
    }
  }

  console.log('🎉 All user credentials and roles updated successfully!');
}

fixAllUserCredentials().catch((err) => {
  console.error('Error in fixAllUserCredentials:', err);
  process.exit(1);
});
