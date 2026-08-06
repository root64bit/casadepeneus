import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Now dynamically import appData and supabase
const { createQuotation, loadAppData } = await import('../src/lib/appData.ts');
const { supabase } = await import('../src/lib/supabase.ts');

async function testQuotationCreation() {
  console.log('🧪 Testing Quotation Creation via appData...');

  // Authenticate
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'caixa@casadepneus.com',
    password: 'password123',
  });

  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }

  console.log('Logged in as caixa@casadepneus.com successfully!');

  // Fetch articles
  const { data: articles } = await supabase.from('products').select('*').limit(1);
  if (!articles || articles.length === 0) {
    console.log('No articles found in DB.');
    return;
  }

  const article = articles[0];

  const testSale = {
    id: `cot-${Date.now()}`,
    clientId: 'client-pontual',
    documentTypeCode: 'CUSTOMER_QUOTATION',
    docNumber: 'A atribuir',
    date: new Date().toISOString().slice(0, 10),
    clientName: 'Cliente Pontual Teste',
    clientNuit: '123456789',
    clientAddress: 'Av. Eduardo Mondlane, Maputo',
    paymentMethod: 'CASH',
    sellerName: 'Operador de Caixa',
    items: [
      {
        articleId: article.id,
        code: article.code,
        description: article.description,
        quantity: 2,
        unitPrice: article.sale_price_excl || 800,
        discountPercent: 0,
        ivaPercent: 16,
        total: 1856,
      },
    ],
    subtotalBruto: 1600,
    descontoTotal: 0,
    subtotalLiquido: 1600,
    ivaTotal: 256,
    totalAmount: 1856,
    paidAmount: 0,
    pendingAmount: 1856,
    status: 'Concluída',
    notes: 'Proposta válida por 15 dias',
  };

  const createdQuotation = await createQuotation(testSale);
  console.log('🎉 Created Quotation result:', createdQuotation);

  // Load app data
  const loadedData = await loadAppData();
  console.log(`\n📊 Loaded Documents from loadAppData(): ${loadedData.documents.length}`);
  loadedData.documents.forEach((d) => {
    console.log(` - Doc: ${d.docNumber} | Type: ${d.typeCode} | Entity: ${d.partyName} | Total: ${d.totalAmount} MZN | Operator: ${d.salespersonName}`);
  });
}

testQuotationCreation().catch(console.error);
