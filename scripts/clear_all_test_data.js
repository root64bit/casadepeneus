import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeAllTestData() {
  console.log('🧹 Purging all test transactions (Faturas, VDs, Guias, Cotações, Movimentos, Pagamentos)...');

  // Sign in as admin/user if possible or execute SQL RPC
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'casadepneus.mz@gmail.com',
    password: 'password123',
  });

  if (!authData?.session) {
    console.log('⚠️ Could not log in with default credentials. Attempting with cashier...');
    await supabase.auth.signInWithPassword({
      email: 'caixa@casadepneus.com',
      password: 'password123',
    });
  }

  // Execute purge queries
  const { error: errLines } = await supabase.from('document_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errLines) console.log('Lines delete result:', errLines.message);

  const { error: errAlloc } = await supabase.from('payment_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errAlloc) console.log('Allocations delete result:', errAlloc.message);

  const { error: errPayments } = await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errPayments) console.log('Payments delete result:', errPayments.message);

  const { error: errDocs } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errDocs) console.log('Documents delete result:', errDocs.message);

  const { error: errMov } = await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errMov) console.log('Movements delete result:', errMov.message);

  const { error: errCustLedg } = await supabase.from('customer_ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errCustLedg) console.log('Customer ledger delete result:', errCustLedg.message);

  const { error: errSuppLedg } = await supabase.from('supplier_ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errSuppLedg) console.log('Supplier ledger delete result:', errSuppLedg.message);

  // Reset product stocks to zero
  const { error: errProducts } = await supabase.from('products').update({ stock: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (errProducts) console.log('Product stocks reset result:', errProducts.message);

  console.log('✅ All test documents, sales, stock movements, and payments purged successfully!');
}

purgeAllTestData().catch((err) => {
  console.error('❌ Error during purge:', err);
  process.exit(1);
});
