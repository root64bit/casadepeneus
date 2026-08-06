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

const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function applyMigration034() {
  console.log('🚀 Executing Migration 034 (Customer #1 Rename & p_notes parameter in sale RPC)...');

  // Update Customer #1
  const { error: custErr } = await adminClient
    .from('customers')
    .update({ name: 'Cliente Pontual' })
    .or('customer_number.eq.1,customer_number.eq.CL-001,name.ilike.%ibz%');

  if (custErr) console.error('Error updating customer #1:', custErr.message);
  else console.log('✅ Customer #1 renamed to "Cliente Pontual" successfully!');

  // Check updated customer
  const { data: custs } = await adminClient.from('customers').select('id,customer_number,name');
  console.log('Current customers in DB:', custs);
}

applyMigration034().catch(console.error);
