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

async function renameCustomer1() {
  console.log('🔄 Renaming Customer #1 / Code 1 to "Cliente Pontual"...');

  const { data: customers } = await adminClient.from('customers').select('id,customer_number,name');
  console.log('Current customers in DB:', customers);

  const { error } = await adminClient
    .from('customers')
    .update({ name: 'Cliente Pontual' })
    .or('customer_number.eq.1,customer_number.eq.CL-001,name.ilike.%ibz%');

  if (error) {
    console.error('Error renaming customer:', error.message);
  } else {
    console.log('✅ Customer #1 successfully renamed to "Cliente Pontual"!');
  }

  const { data: updatedCust } = await adminClient.from('customers').select('id,customer_number,name');
  console.log('Updated customers in DB:', updatedCust);
}

renameCustomer1().catch(console.error);
