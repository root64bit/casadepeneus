import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL missing in .env');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await client.connect();
  await client.query('BEGIN');
  const admin = await client.query(`select id from public.user_profiles where email='admin@casadepneus.co.mz' and is_active limit 1`);
  assert(admin.rows[0]?.id, 'Active admin user not found.');
  await client.query(`select set_config('request.jwt.claim.sub',$1,true)`, [admin.rows[0].id]);

  const sourceResult = await client.query(`
    select d.*,dl.id line_id from public.documents d join public.document_lines dl on dl.document_id=d.id
    where d.display_number='CUSTOMER_INVOICE A/000002' limit 1
  `);
  const source = sourceResult.rows[0];
  assert(source?.line_id, 'Customer source invoice or line not found.');
  const beforeOutstanding = Number(source.outstanding_amount);

  const creditResult = await client.query(`select (public.create_and_confirm_credit_note_v2(
    'CUSTOMER',$1,$2,current_date,'Teste transaccional 043','Rollback automático',
    jsonb_build_array(jsonb_build_object('source_line_id',$3::text,'quantity',0.1)),false,$4
  )).*`, [source.customer_id, source.id, source.line_id, crypto.randomUUID()]);
  const credit = creditResult.rows[0];
  assert(credit.status === 'CONFIRMED' && Number(credit.grand_total) > 0, 'Credit note was not confirmed.');
  const afterCredit = await client.query('select outstanding_amount from public.documents where id=$1', [source.id]);
  assert(Number(afterCredit.rows[0].outstanding_amount) < beforeOutstanding, 'Credit note did not reduce invoice outstanding.');

  await client.query(`select public.cancel_credit_note_v2($1,'Teste transaccional 043',$2)`, [credit.id, crypto.randomUUID()]);
  const afterCancellation = await client.query('select outstanding_amount from public.documents where id=$1', [source.id]);
  assert(Number(afterCancellation.rows[0].outstanding_amount) === beforeOutstanding, 'Credit-note cancellation did not restore outstanding.');

  const customerPayment = await client.query(`select (public.create_and_confirm_customer_payment($1,$2,'CASH',1,null,$3)).*`, [source.customer_id, source.id, crypto.randomUUID()]);
  assert(customerPayment.rows[0].status === 'FULLY_ALLOCATED', 'Customer receipt was not allocated.');

  const supplierSource = await client.query(`
    select d.* from public.documents d join public.document_types dt on dt.id=d.document_type_id
    where dt.code='SUPPLIER_OPENING_BALANCE' and d.outstanding_amount>0 order by d.created_at limit 1
  `);
  assert(supplierSource.rows[0]?.id, 'Supplier payable opening document not found.');
  const supplierPayment = await client.query(`select (public.create_and_confirm_supplier_payment($1,$2,'CASH',1,null,$3)).*`, [
    supplierSource.rows[0].supplier_id, supplierSource.rows[0].id, crypto.randomUUID(),
  ]);
  assert(supplierPayment.rows[0].status === 'FULLY_ALLOCATED', 'Supplier payment was not allocated.');

  const walkIn = await client.query(`select id from public.customers where customer_number='1' and active limit 1`);
  const creditTerm = await client.query(`select code from public.payment_terms where active and not requires_immediate_payment order by payment_days limit 1`);
  assert(walkIn.rows[0]?.id && creditTerm.rows[0]?.code, 'Walk-in customer or credit term not found.');
  await client.query('SAVEPOINT walk_in_credit');
  let walkInCreditBlocked = false;
  try {
    await client.query(`select (public.create_and_confirm_customer_sale_v2(
      $1,current_date,$2,jsonb_build_array(jsonb_build_object('code','TEST','description','Teste rollback','quantity',1,'unit_price_incl',10,'discount_amount',0,'tax_rate',0,'line_type','MANUAL','stock_effect_enabled',false)),
      $3,'CUSTOMER_INVOICE','Teste transaccional',0
    )).*`, [walkIn.rows[0].id, creditTerm.rows[0].code, crypto.randomUUID()]);
  } catch (error) {
    walkInCreditBlocked = String(error.message).includes('WALK_IN_CUSTOMER_CANNOT_BUY_ON_CREDIT');
    await client.query('ROLLBACK TO SAVEPOINT walk_in_credit');
  }
  assert(walkInCreditBlocked, 'Anonymous walk-in credit was not blocked.');

  await client.query('ROLLBACK');
  console.log('Migration 043 financial flows validated successfully and rolled back.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
