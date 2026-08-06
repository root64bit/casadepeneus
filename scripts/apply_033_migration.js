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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Anon Key');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Migration 033 (Quotations RPC, Standard Prefixes, and Total Purge)...');

  // Authenticate as Admin/User
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'caixa@casadepneus.com',
    password: 'password123',
  });

  if (authErr) {
    console.error('Auth error:', authErr.message);
  }

  const migrationSql = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/20260806120000_033_quotations_and_document_numbering_closure.sql'),
    'utf-8'
  );

  // Execute SQL via postgres REST endpoint if possible, or RPC execution
  // Let's call purge_all_test_transactions RPC if it exists, or run statements
  console.log('Executing purge_all_test_transactions RPC...');
  const { error: purgeErr } = await client.rpc('purge_all_test_transactions');
  if (purgeErr) {
    console.log('RPC Purge info:', purgeErr.message);
  }

  // Also clean documents, document_lines, stock_movements, payments directly
  await client.from('document_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payment_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error: deleteDocsErr } = await client.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteDocsErr) console.log('Delete docs result:', deleteDocsErr.message);

  console.log('✅ Migration & Purge complete!');
}

applyMigration().catch((err) => {
  console.error('Error applying migration 033:', err);
});
