import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.service_role || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Service role key missing.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function applyMigration033WithServiceRole() {
  console.log('🚀 Executing Migration 033 (CUSTOMER_QUOTATION Document Type Seed)...');

  const { data: companies } = await adminClient.from('companies').select('id');
  if (companies && companies.length > 0) {
    for (const comp of companies) {
      const { error: insErr } = await adminClient.from('document_types').upsert({
        id: '30000000-0000-0000-0000-000000000011',
        company_id: comp.id,
        code: 'CUSTOMER_QUOTATION',
        name: 'Cotação',
        direction: 'CUSTOMER',
        party_type: 'CUSTOMER',
        affects_stock: false,
        stock_direction: 'NONE',
        affects_customer_account: false,
        affects_supplier_account: false,
        requires_customer: false,
        requires_supplier: false,
        active: true,
      }, { onConflict: 'company_id,code' });

      if (insErr) console.error('Error inserting CUSTOMER_QUOTATION:', insErr.message);
      else console.log(`✅ CUSTOMER_QUOTATION document type seeded for company ${comp.id}!`);
    }
  }

  const { data: docTypes } = await adminClient.from('document_types').select('id,code,name');
  console.log('\n📄 Updated Document Types in DB:');
  docTypes?.forEach((dt) => {
    console.log(` - ID: ${dt.id} | Code: ${dt.code} | Name: ${dt.name}`);
  });
}

applyMigration033WithServiceRole().catch(console.error);
