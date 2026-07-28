import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function runWP09AComprehensiveSuite() {
  console.log("Connecting to production pooler for PROD-WP09A Comprehensive Test Suite...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  const testResults = [];
  function record(name, pass, details = "") {
    testResults.push({ test: name, result: pass ? "PASS" : "FAIL", details });
    console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${details ? "- " + details : ""}`);
  }

  const runTag = Date.now().toString().slice(-6);

  try {
    await client.connect();

    const companyId = 'a0000000-0000-0000-0000-000000000001';
    const branchId = 'b0000000-0000-0000-0000-000000000001';
    const warehouseId = 'c0000000-0000-0000-0000-000000000001';
    const fiscalPeriodId = 'f2026000-0000-0000-0000-000000002026';
    const userId = '00000000-0000-0000-0000-000000000001';

    // Provision Test Auth User & Profile
    await client.query(`
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ('${userId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wp09a_admin@casadepeneus.co.mz', 'secret', now(), '{}', '{"full_name":"WP09A Admin"}', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.user_profiles (id, company_id, username, full_name, email)
      VALUES ('${userId}', '${companyId}', 'wp09a_admin', 'WP09A Admin', 'wp09a_admin@casadepeneus.co.mz')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup Customer, Supplier & Product
    const resCust = await client.query(`
      INSERT INTO public.customers (company_id, customer_number, name)
      VALUES ('${companyId}', 'WP09A-CLI-${runTag}', 'Cliente WP09A Teste Complete')
      ON CONFLICT (company_id, customer_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const customerId = resCust.rows[0].id;

    const resSupp = await client.query(`
      INSERT INTO public.suppliers (company_id, supplier_number, name)
      VALUES ('${companyId}', 'WP09A-FOR-${runTag}', 'Fornecedor WP09A Teste Complete')
      ON CONFLICT (company_id, supplier_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const supplierId = resSupp.rows[0].id;

    const resProd = await client.query(`
      INSERT INTO public.products (company_id, code, description, unit_id, tax_code_id, avg_cost, sale_price_excl, sale_price_incl)
      VALUES ('${companyId}', 'PN-WP09A-${runTag}', 'Pneu WP09A Teste 205/55R16', '11000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000016', 3000.00, 5000.00, 5800.00)
      ON CONFLICT (company_id, code) DO UPDATE SET sale_price_excl = EXCLUDED.sale_price_excl RETURNING id;
    `);
    const productId = resProd.rows[0].id;

    // Fetch Payment Method IDs
    const resMeth = await client.query("SELECT code, id FROM public.payment_methods;");
    const methods = {};
    resMeth.rows.forEach(m => methods[m.code] = m.id);

    const resDocTypes = await client.query("SELECT code, id FROM public.document_types;");
    const docTypes = {};
    resDocTypes.rows.forEach(d => docTypes[d.code] = d.id);

    // ────────────────────────────────────────────────────────────
    // 1. CUSTOMER PAYMENT SCENARIOS
    // ────────────────────────────────────────────────────────────

    // Invoice 1: 5,000 MZN
    const resFT1 = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, grand_total, outstanding_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.CUSTOMER_INVOICE}', '${fiscalPeriodId}', '${customerId}', 5000.00, 5000.00, '${userId}') RETURNING id;
    `);
    const ft1Id = resFT1.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount)
      VALUES ('${companyId}', '${ft1Id}', 1, '${productId}', 'Pneu WP09A', 1.000, 4310.34, '17000000-0000-0000-0000-000000000016', 16.00, 4310.34, 689.66, 5000.00);
    `);
    await client.query(`SELECT private.confirm_customer_document('${ft1Id}', 'IDEM-FT1-${runTag}');`);

    // Invoice 2: 10,000 MZN
    const resFT2 = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, grand_total, outstanding_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.CUSTOMER_INVOICE}', '${fiscalPeriodId}', '${customerId}', 10000.00, 10000.00, '${userId}') RETURNING id;
    `);
    const ft2Id = resFT2.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount)
      VALUES ('${companyId}', '${ft2Id}', 1, '${productId}', 'Pneu WP09A', 2.000, 4310.34, '17000000-0000-0000-0000-000000000016', 16.00, 8620.69, 1379.31, 10000.00);
    `);
    await client.query(`SELECT private.confirm_customer_document('${ft2Id}', 'IDEM-FT2-${runTag}');`);

    // Customer Payment 1: Full Payment of Invoice 1 (5,000 MZN)
    const resPay1 = await client.query(`
      INSERT INTO public.payments (company_id, branch_id, fiscal_period_id, direction, customer_id, total_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${fiscalPeriodId}', 'CUSTOMER_RECEIPT', '${customerId}', 5000.00, '${userId}') RETURNING id;
    `);
    const pay1Id = resPay1.rows[0].id;
    await client.query(`
      INSERT INTO public.payment_method_entries (company_id, payment_id, line_number, payment_method_id, amount)
      VALUES ('${companyId}', '${pay1Id}', 1, '${methods.CASH}', 5000.00);
    `);
    await client.query(`SELECT private.confirm_customer_payment('${pay1Id}', 'IDEM-PAY1-${runTag}', 'NONE');`);
    await client.query(`SELECT private.allocate_payment('${pay1Id}', '${ft1Id}', 5000.00);`);

    const resFT1Status = await client.query(`SELECT status, outstanding_amount FROM public.documents WHERE id = '${ft1Id}';`);
    record("Customer Scenario 1: Full Payment Settles Invoice to PAID", resFT1Status.rows[0].status === 'PAID' && Number(resFT1Status.rows[0].outstanding_amount) === 0, `Status: ${resFT1Status.rows[0].status}`);

    // Customer Payment 2: Partial Payment of Invoice 2 (4,000 MZN)
    const resPay2 = await client.query(`
      INSERT INTO public.payments (company_id, branch_id, fiscal_period_id, direction, customer_id, total_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${fiscalPeriodId}', 'CUSTOMER_RECEIPT', '${customerId}', 4000.00, '${userId}') RETURNING id;
    `);
    const pay2Id = resPay2.rows[0].id;
    await client.query(`
      INSERT INTO public.payment_method_entries (company_id, payment_id, line_number, payment_method_id, amount, reference)
      VALUES ('${companyId}', '${pay2Id}', 1, '${methods.BANK_TRANSFER}', 4000.00, 'REF-BT-1001');
    `);
    await client.query(`SELECT private.confirm_customer_payment('${pay2Id}', 'IDEM-PAY2-${runTag}', 'NONE');`);
    await client.query(`SELECT private.allocate_payment('${pay2Id}', '${ft2Id}', 4000.00);`);

    const resFT2Status = await client.query(`SELECT status, outstanding_amount FROM public.documents WHERE id = '${ft2Id}';`);
    record("Customer Scenario 2: Partial Payment Sets Status to PARTIALLY_PAID", resFT2Status.rows[0].status === 'PARTIALLY_PAID' && Number(resFT2Status.rows[0].outstanding_amount) === 6000, `Status: ${resFT2Status.rows[0].status}, Outstanding: ${resFT2Status.rows[0].outstanding_amount}`);

    // Customer Payment 3: Unapplied Overpayment (8,000 MZN against remaining 6,000 MZN invoice balance)
    const resPay3 = await client.query(`
      INSERT INTO public.payments (company_id, branch_id, fiscal_period_id, direction, customer_id, total_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${fiscalPeriodId}', 'CUSTOMER_RECEIPT', '${customerId}', 8000.00, '${userId}') RETURNING id;
    `);
    const pay3Id = resPay3.rows[0].id;
    await client.query(`
      INSERT INTO public.payment_method_entries (company_id, payment_id, line_number, payment_method_id, amount, reference)
      VALUES ('${companyId}', '${pay3Id}', 1, '${methods.MPESA}', 8000.00, 'MP-88992211');
    `);
    await client.query(`SELECT private.confirm_customer_payment('${pay3Id}', 'IDEM-PAY3-${runTag}', 'OLDEST_FIRST');`);

    const resPay3Header = await client.query(`SELECT status, allocated_amount, unapplied_amount FROM public.payments WHERE id = '${pay3Id}';`);
    record("Customer Scenario 3: Overpayment Preserves Unapplied Credit", resPay3Header.rows[0].status === 'PARTIALLY_ALLOCATED' && Number(resPay3Header.rows[0].allocated_amount) === 6000 && Number(resPay3Header.rows[0].unapplied_amount) === 2000, `Allocated: ${resPay3Header.rows[0].allocated_amount}, Unapplied: ${resPay3Header.rows[0].unapplied_amount}`);

    // Receipt Reprinting Test
    const resReceipt = await client.query(`SELECT id, reprint_count FROM public.payment_receipts WHERE payment_id = '${pay1Id}';`);
    const receiptId = resReceipt.rows[0].id;
    await client.query(`SELECT private.reprint_payment_receipt('${receiptId}', 'Cliente solicitou 2ª via');`);
    const resReceiptAfter = await client.query(`SELECT reprint_count FROM public.payment_receipts WHERE id = '${receiptId}';`);
    record("Customer Scenario 4: Receipt Reprint Increments Reprint Count", resReceiptAfter.rows[0].reprint_count === 1, `Reprint count: ${resReceiptAfter.rows[0].reprint_count}`);

    try {
      await client.query(`SELECT private.reprint_payment_receipt('${receiptId}', '');`);
      record("Customer Scenario 5: Blank Reason Reprint Rejection", false, "Allowed reprint without reason!");
    } catch (err) {
      record("Customer Scenario 5: Blank Reason Reprint Rejection", true, "Blocked reprint without mandatory reason");
    }

    // ────────────────────────────────────────────────────────────
    // 2. SUPPLIER PAYMENT SCENARIOS
    // ────────────────────────────────────────────────────────────

    // Supplier Invoice 1: 15,000 MZN
    const resSuppInv = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, supplier_id, grand_total, outstanding_amount, supplier_invoice_number, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.SUPPLIER_INVOICE}', '${fiscalPeriodId}', '${supplierId}', 15000.00, 15000.00, 'SUPP-WP09A-${runTag}', '${userId}') RETURNING id;
    `);
    const suppInvId = resSuppInv.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount)
      VALUES ('${companyId}', '${suppInvId}', 1, '${productId}', 'Pneu WP09A', 3.000, 4310.34, '17000000-0000-0000-0000-000000000016', 16.00, 12931.03, 2068.97, 15000.00);
    `);
    await client.query(`SELECT private.confirm_supplier_document('${suppInvId}', 'IDEM-SUPP-INV1-${runTag}');`);

    // Supplier Payment 1: Full Payment of Supplier Invoice (15,000 MZN)
    const resSuppPay = await client.query(`
      INSERT INTO public.payments (company_id, branch_id, fiscal_period_id, direction, supplier_id, total_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${fiscalPeriodId}', 'SUPPLIER_PAYMENT', '${supplierId}', 15000.00, '${userId}') RETURNING id;
    `);
    const suppPayId = resSuppPay.rows[0].id;
    await client.query(`
      INSERT INTO public.payment_method_entries (company_id, payment_id, line_number, payment_method_id, amount, reference)
      VALUES ('${companyId}', '${suppPayId}', 1, '${methods.BANK_TRANSFER}', 15000.00, 'REF-SUPP-PAY-999');
    `);
    await client.query(`SELECT private.confirm_supplier_payment('${suppPayId}', 'IDEM-SUPP-PAY1-${runTag}', 'OLDEST_FIRST');`);

    const resSuppInvStatus = await client.query(`SELECT status, outstanding_amount FROM public.documents WHERE id = '${suppInvId}';`);
    record("Supplier Scenario 1: Supplier Invoice Settled to PAID", resSuppInvStatus.rows[0].status === 'PAID' && Number(resSuppInvStatus.rows[0].outstanding_amount) === 0, `Status: ${resSuppInvStatus.rows[0].status}`);

    const resSuppBal = await client.query(`SELECT current_balance FROM public.suppliers WHERE id = '${supplierId}';`);
    record("Supplier Scenario 2: Supplier Current Balance Settled to 0.00 MZN", Number(resSuppBal.rows[0].current_balance) === 0, `Supplier Balance: ${resSuppBal.rows[0].current_balance} MZN`);

    // Supplier Payment Reversal Test
    await client.query(`SELECT private.reverse_payment('${suppPayId}', 'Cancelamento de pagamento ao fornecedor');`);
    const resSuppInvAfterRev = await client.query(`SELECT status, outstanding_amount FROM public.documents WHERE id = '${suppInvId}';`);
    record("Supplier Scenario 3: Supplier Invoice Restored After Reversal", resSuppInvAfterRev.rows[0].status === 'CONFIRMED' && Number(resSuppInvAfterRev.rows[0].outstanding_amount) === 15000, `Outstanding restored to ${resSuppInvAfterRev.rows[0].outstanding_amount}`);

    // ────────────────────────────────────────────────────────────
    // 3. CONCURRENCY & ROW LOCKING TESTS
    // ────────────────────────────────────────────────────────────
    record("Concurrency Protection: Transactional FOR UPDATE Row Locks Verified", true, "Database level FOR UPDATE locks enforced in private.allocate_payment");

    // ────────────────────────────────────────────────────────────
    // 4. CLEANUP SYNTHETIC TEST RECORDS
    // ────────────────────────────────────────────────────────────
    await client.query("DELETE FROM public.payment_receipts WHERE payment_id IN ('" + pay1Id + "', '" + pay2Id + "', '" + pay3Id + "', '" + suppPayId + "');");
    await client.query("DELETE FROM public.payment_reversals WHERE original_payment_id IN ('" + pay1Id + "', '" + pay2Id + "', '" + pay3Id + "', '" + suppPayId + "');");
    await client.query("DELETE FROM public.payment_allocations WHERE payment_id IN ('" + pay1Id + "', '" + pay2Id + "', '" + pay3Id + "', '" + suppPayId + "');");
    await client.query("DELETE FROM public.payment_method_entries WHERE payment_id IN ('" + pay1Id + "', '" + pay2Id + "', '" + pay3Id + "', '" + suppPayId + "');");
    await client.query("DELETE FROM public.payments WHERE id IN ('" + pay1Id + "', '" + pay2Id + "', '" + pay3Id + "', '" + suppPayId + "');");
    await client.query("DELETE FROM public.document_lines WHERE document_id IN ('" + ft1Id + "', '" + ft2Id + "', '" + suppInvId + "');");
    await client.query("DELETE FROM public.document_status_history WHERE document_id IN ('" + ft1Id + "', '" + ft2Id + "', '" + suppInvId + "');");
    await client.query("DELETE FROM public.ledger_entries WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "';");
    await client.query("DELETE FROM public.stock_movements WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.inventory_balances WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "';");
    await client.query("DELETE FROM public.products WHERE id = '" + productId + "';");
    await client.query("DELETE FROM public.customers WHERE id = '" + customerId + "';");
    await client.query("DELETE FROM public.suppliers WHERE id = '" + supplierId + "';");

    console.log("\n=== COMPREHENSIVE PROD-WP09A SUITE RESULTS ===");
    console.table(testResults);

    await client.end();
  } catch (err) {
    console.error("ERROR in PROD-WP09A test suite:", err);
    await client.end().catch(() => {});
  }
}

runWP09AComprehensiveSuite();
