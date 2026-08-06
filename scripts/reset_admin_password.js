import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.service_role;

if (!url || !serviceKey) throw new Error("Supabase credentials missing");

const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function resetPasswords() {
  console.log("Resetting passwords for QA test suite...");

  // 1. Admin user
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  const adminUser = usersData.users.find(u => u.email === 'admin@casadepneus.co.mz');

  if (adminUser) {
    await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
      password: 'admin123456'
    });
    console.log("✅ Admin password reset to admin123456");
  }

  // 2. Cashier user
  const cashierUser = usersData.users.find(u => u.email === 'caixa@casadepneus.com');
  if (cashierUser) {
    await supabaseAdmin.auth.admin.updateUserById(cashierUser.id, {
      password: 'caixa123456'
    });
    console.log("✅ Cashier password reset to caixa123456");
  }
}

resetPasswords();
