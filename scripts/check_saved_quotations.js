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

async function checkQuotationsInDb() {
  console.log('🔍 Checking all documents in Supabase DB...');
  const { data: docs, error } = await adminClient
    .from('documents')
    .select('id,display_number,document_date,status,grand_total,salesperson_name,notes,document_type_id,customer_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error.message);
    return;
  }

  console.log(`Total documents found in database: ${docs?.length ?? 0}`);
  if (docs && docs.length > 0) {
    docs.forEach((d, i) => {
      console.log(`${i + 1}. ID: ${d.id} | DisplayNo: ${d.display_number} | Date: ${d.document_date} | Total: ${d.grand_total} MZN | Operator: ${d.salesperson_name} | Notes: ${d.notes}`);
    });
  } else {
    console.log('No documents found in database yet.');
  }

  const { data: docTypes } = await adminClient.from('document_types').select('id,code,name');
  console.log('\n📄 Document Types in DB:');
  docTypes?.forEach((dt) => {
    console.log(` - ID: ${dt.id} | Code: ${dt.code} | Name: ${dt.name}`);
  });
}

checkQuotationsInDb().catch(console.error);
