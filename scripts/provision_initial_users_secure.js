import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.service_role;
if (!url || !serviceRole) {
  throw new Error('Server-side Supabase URL and service-role credential are required.');
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const specifications = [
  {
    email: 'admin@casadepneus.co.mz',
    fullName: 'Administrador Casa de Pneus',
    username: 'admin',
    roleCode: 'ADMINISTRATOR',
  },
  {
    email: 'gestor@casadepneus.co.mz',
    fullName: 'Gestor Casa de Pneus',
    username: 'gestor',
    roleCode: 'MANAGER_LIMITED',
  },
];

const generatePassword = () => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*+-=?';
  const all = uppercase + lowercase + numbers + special;
  const required = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    numbers[crypto.randomInt(numbers.length)],
    special[crypto.randomInt(special.length)],
  ];
  while (required.length < 22) required.push(all[crypto.randomInt(all.length)]);
  for (let index = required.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(index + 1);
    [required[index], required[swap]] = [required[swap], required[index]];
  }
  return required.join('');
};

const credentials = [];
const results = [];

for (const specification of specifications) {
  const password = generatePassword();
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', specification.email)
    .maybeSingle();
  if (existingProfileError) throw existingProfileError;
  let user;

  if (!existingProfile) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: specification.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: specification.fullName,
        username: specification.username,
        force_password_change: true,
      },
      app_metadata: { initial_provisioning: true },
    });
    if (error || !data.user) throw error ?? new Error('User creation returned no user.');
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(existingProfile.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        full_name: specification.fullName,
        username: specification.username,
        force_password_change: true,
      },
      app_metadata: {
        ...user.app_metadata,
        initial_provisioning: true,
      },
    });
    if (error || !data.user) throw error ?? new Error('User update returned no user.');
    user = data.user;
  }

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id,company_id')
    .eq('code', specification.roleCode)
    .single();
  if (roleError || !role) throw roleError ?? new Error(`Role ${specification.roleCode} not found.`);

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: user.id,
    company_id: role.company_id,
    username: specification.username,
    full_name: specification.fullName,
    email: specification.email,
    is_active: true,
    force_password_change: true,
    updated_at: new Date().toISOString(),
  });
  if (profileError) throw profileError;

  const { error: deleteRolesError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', user.id);
  if (deleteRolesError) throw deleteRolesError;
  const { error: userRoleError } = await supabase
    .from('user_roles')
    .insert({ user_id: user.id, role_id: role.id });
  if (userRoleError) throw userRoleError;

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', role.company_id)
    .eq('is_active', true)
    .order('code')
    .limit(1)
    .single();
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('id')
    .eq('company_id', role.company_id)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('code')
    .limit(1)
    .single();
  if (!branch || !warehouse) throw new Error('Active branch and warehouse are required.');

  await supabase.from('branch_access').upsert({ user_id: user.id, branch_id: branch.id });
  await supabase.from('warehouse_access').upsert({
    user_id: user.id,
    warehouse_id: warehouse.id,
  });

  credentials.push({
    email: specification.email,
    temporaryPassword: password,
    forcePasswordChange: true,
  });
  results.push({
    userId: user.id,
    email: specification.email,
    roleCode: specification.roleCode,
    branchId: branch.id,
    warehouseId: warehouse.id,
    forcePasswordChange: true,
  });
}

const handoffDirectory = path.join(os.homedir(), '.codex', 'secure-handoffs');
fs.mkdirSync(handoffDirectory, { recursive: true, mode: 0o700 });
const handoffPath = path.join(
  handoffDirectory,
  `casa-de-pneus-initial-users-${new Date().toISOString().replaceAll(':', '-')}.json`,
);
fs.writeFileSync(
  handoffPath,
  JSON.stringify({
    createdAt: new Date().toISOString(),
    instruction: 'Change each password immediately after first sign-in.',
    credentials,
  }, null, 2),
  { encoding: 'utf8', mode: 0o600, flag: 'wx' },
);

if (process.platform === 'win32') {
  const currentUser = process.env.USERNAME;
  if (currentUser) {
    execFileSync('icacls.exe', [
      handoffPath,
      '/inheritance:r',
      '/grant:r',
      `${currentUser}:(R,W)`,
    ], { stdio: 'ignore' });
  }
}

console.log(JSON.stringify({
  result: 'PASS',
  users: results,
  secureHandoffPath: handoffPath,
  passwordsPrinted: false,
}, null, 2));
