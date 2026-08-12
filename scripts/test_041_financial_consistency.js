import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');

const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260812103000_041_cash_sale_and_non_receivable_balances.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8')
  .replace(/^\uFEFF?\s*BEGIN;\s*/i, '')
  .replace(/\s*COMMIT;\s*$/i, '');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(migrationSql);

  const inconsistent = await client.query(`
    SELECT COUNT(*)::INT AS count
    FROM public.documents d
    JOIN public.document_types dt ON dt.id=d.document_type_id
    WHERE d.status='CONFIRMED' AND (
      (dt.code='CASH_SALE' AND (d.amount_paid<>d.grand_total OR d.outstanding_amount<>0)) OR
      (dt.code IN('CUSTOMER_DELIVERY_NOTE','CUSTOMER_QUOTATION','QUOTATION','COT')
        AND (d.amount_paid<>0 OR d.outstanding_amount<>0))
    )
  `);
  assert.equal(inconsistent.rows[0].count, 0, 'Existing cash/non-receivable documents remain inconsistent');

  const ledgerMismatch = await client.query(`
    SELECT COUNT(*)::INT AS count
    FROM public.ledger_entries le
    JOIN public.documents d ON d.id=le.source_document_id
    JOIN public.document_types dt ON dt.id=d.document_type_id
    WHERE dt.code='CASH_SALE' AND le.status<>'REVERSED'
      AND (le.debit_amount<>d.grand_total OR le.credit_amount<>d.grand_total OR le.outstanding_amount<>0)
  `);
  assert.equal(ledgerMismatch.rows[0].count, 0, 'Cash-sale ledger rows remain inconsistent');

  const authUser = await client.query(`
    SELECT up.id
    FROM public.user_profiles up
    WHERE EXISTS (
      SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id=ur.role_id
      JOIN public.permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=up.id AND p.code='sales.create'
    ) AND EXISTS (
      SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id=ur.role_id
      JOIN public.permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=up.id AND p.code='sales.confirm'
    )
    ORDER BY up.id LIMIT 1
  `);
  assert.equal(authUser.rowCount, 1, 'No sales.create + sales.confirm user found');
  await client.query(`SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)`, [authUser.rows[0].id]);

  const customer = await client.query(`SELECT id FROM public.customers WHERE company_id=public.get_user_company_id() AND active ORDER BY CASE WHEN customer_number='1' THEN 0 ELSE 1 END,customer_number LIMIT 1`);
  assert.equal(customer.rowCount, 1, 'No active customer found');
  const testItems = JSON.stringify([{ code:'SERV-TESTE',description:'Serviço transacional',quantity:1,unit_price_incl:116,discount_amount:16,tax_rate:16,line_type:'SERVICE',stock_effect_enabled:false }]);

  for (const type of ['CASH_SALE','CUSTOMER_DELIVERY_NOTE']) {
    const created = await client.query(
      `SELECT (public.create_and_confirm_customer_sale_v2($1,current_date,'DINHEIRO',$2::jsonb,$3,$4,'Teste 041',0)).*`,
      [customer.rows[0].id,testItems,`test-041-${type}-${Date.now()}`,type],
    );
    const row=created.rows[0];
    assert.equal(Number(row.grand_total),100,`${type} total mismatch`);
    assert.equal(Number(row.outstanding_amount),0,`${type} should not be outstanding`);
    assert.equal(Number(row.amount_paid),type==='CASH_SALE'?100:0,`${type} paid amount mismatch`);
    assert.match(row.display_number,type==='CASH_SALE'?/^VD-\d{4}\/\d{6}$/:/^GR-\d{4}\/\d{6}$/);
  }

  console.log('Migration 041 transactional validation passed: VD paid, GR non-receivable, ledger balanced.');
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end().catch(() => {});
}
