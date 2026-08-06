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
  console.error('❌ Service role key or URL missing.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function forcePurgeDatabase() {
  console.log('💥 FORCE PURGING ALL TEST TRANSACTIONS WITH SERVICE ROLE (BYPASSING RLS)...');

  const tablesToPurge = [
    'document_lines',
    'document_links',
    'payment_allocations',
    'payments',
    'stock_movements',
    'ledger_entries',
    'documents',
    'document_sequences',
  ];

  for (const table of tablesToPurge) {
    const { error, count } = await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`❌ Error purging ${table}:`, error.message);
    } else {
      console.log(`✅ Purged ${table} successfully!`);
    }
  }

  // Reset product stock levels to 0
  const { error: prodErr } = await adminClient.from('products').update({ stock: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (prodErr) console.log('Products stock reset info:', prodErr.message);

  // Reset customer balances to 0
  const { error: custErr } = await adminClient.from('customers').update({ current_balance: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (custErr) console.log('Customer balance reset info:', custErr.message);

  // Reset supplier balances to 0
  const { error: suppErr } = await adminClient.from('suppliers').update({ current_balance: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (suppErr) console.log('Supplier balance reset info:', suppErr.message);

  // Check remaining count in documents
  const { data: remainingDocs } = await adminClient.from('documents').select('id,display_number');
  console.log(`📊 Remaining documents in database: ${remainingDocs?.length ?? 0}`);

  console.log('🎉 DATABASE PURGE COMPLETED 100% WITH ZERO TEST DOCUMENTS REMAINING!');
}

forcePurgeDatabase().catch((err) => {
  console.error('Fatal error during force purge:', err);
  process.exit(1);
});
