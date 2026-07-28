import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function testPaymentsEngine() {
  console.log("Connecting to production pooler for PROD-WP09 Synthetic Test Suite...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  const testResults = [];
  function record(name, pass, details = "") {
    testResults.push({ test: name, result: pass ? "PASS" : "FAIL", details });
    console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${details ? "- " + details : ""}`);
  }

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
      VALUES ('${userId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pay_admin@casadepeneus.co.mz', 'secret', now(), '{}', '{"full_name":"Pay Admin"}', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.user_profiles (id, company_id, username, full_name, email)
      VALUES ('${userId}', '${companyId}', 'pay_admin', 'Pay Admin WP09', 'pay_admin@casadepeneus.co.mz')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup Customer, Supplier & Product
    const resCust = await client.query(`
      INSERT INTO public.customers (company_id, customer_number, name)
      VALUES ('${companyId}', 'PAY-CLI-01', 'Cliente Pagamentos WP09')
      ON CONFLICT (company_id, customer_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const customerId = resCust.rows[0].id;

    const resSupp = await client.query(`
      INSERT INTO public.suppliers (company_id, supplier_number, name)
      VALUES ('${companyId}', 'PAY-FOR-01', 'Fornecedor Pagamentos WP09')
      ON CONFLICT (company_id, supplier_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const supplierId = resSupp.rows[0].id;

    const resProd = await client.query(`
      INSERT INTO public.products (company_id, code, description, unit_id, tax_code_id, avg_cost, sale_price_excl, sale_price_incl)
      VALUES ('${companyId}', 'PN-PAY-01', 'Pneu Teste Pay 195/65R15', '11000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000016', 2500.00, 4000.00, 4640.00)
      ON CONFLICT (company_id, code) DO UPDATE SET sale_price_excl = EXCLUDED.sale_price_excl RETURNING id;
    `);
    const productId = resProd.rows[0].id;

    // Fetch cash payment method ID
    const resMeth = await client.query("SELECT id FROM public.payment_methods WHERE code = 'CASH';");
    const cashMethodId = resMeth.rows[0].id;

    // Create & Confirm Customer Invoice for 10,000 MZN
    const resFTType = await client.query("SELECT id FROM public.document_types WHERE code = 'CUSTOMER_INVOICE';");
    const ftTypeId = resFTType.rows[0].id;

    const resFT = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, grand_total, outstanding_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${ftTypeId}', '${fiscalPeriodId}', '${customerId}', 10000.00, 10000.00, '${userId}') RETURNING id;
    `);
    const ftId = resFT.rows[0].id;

    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount)
      VALUES ('${companyId}', '${ftId}', 1, '${productId}', 'Pneu Teste Pay', 2.000, 4310.34, '17000000-0000-0000-0000-000000000016', 16.00, 8620.69, 1379.31, 10000.00);
    `);

    await client.query(`SELECT private.confirm_customer_document('${ftId}', 'IDEM-FT-PAY-01');`);

    // Verify Customer Current Balance before payment (Expected 10,000.00 MZN)
    const resCustBal1 = await client.query(`SELECT current_balance FROM public.customers WHERE id = '${customerId}';`);
    record("Customer Balance After Invoice Creation", Number(resCustBal1.rows[0].current_balance) === 10000, `Balance: ${resCustBal1.rows[0].current_balance} MZN`);

    // 1. CREATE & CONFIRM FULL CUSTOMER PAYMENT (10,000 MZN)
    const resPay = await client.query(`
      INSERT INTO public.payments (company_id, branch_id, fiscal_period_id, direction, customer_id, total_amount, created_by)
      VALUES ('${companyId}', '${branchId}', '${fiscalPeriodId}', 'CUSTOMER_RECEIPT', '${customerId}', 10000.00, '${userId}') RETURNING id;
    `);
    const payId = resPay.rows[0].id;

    await client.query(`
      INSERT INTO public.payment_method_entries (company_id, payment_id, line_number, payment_method_id, amount)
      VALUES ('${companyId}', '${payId}', 1, '${cashMethodId}', 10000.00);
    `);

    const resPayConf = await client.query(`SELECT display_number, status, unapplied_amount FROM private.confirm_customer_payment('${payId}', 'IDEM-PAY-01', 'OLDEST_FIRST');`);

    // Verify Invoice Payment Status (Expected PAID, outstanding 0.00)
    const resDocStatus = await client.query(`SELECT status, amount_paid, outstanding_amount FROM public.documents WHERE id = '${ftId}';`);
    record("Customer Invoice Settled to PAID", resDocStatus.rows[0].status === 'PAID' && Number(resDocStatus.rows[0].outstanding_amount) === 0, `Status: ${resDocStatus.rows[0].status}, Outstanding: ${resDocStatus.rows[0].outstanding_amount}`);

    // Verify Customer Receipt Generation
    const resReceipt = await client.query(`SELECT receipt_number, series FROM public.payment_receipts WHERE payment_id = '${payId}';`);
    record("Atomic Receipt Issued", resReceipt.rows.length === 1, `Receipt #: REC A/${resReceipt.rows[0].receipt_number}`);

    // Verify Customer Balance After Payment (Expected 0.00 MZN)
    const resCustBal2 = await client.query(`SELECT current_balance FROM public.customers WHERE id = '${customerId}';`);
    record("Customer Current Balance Settled to 0.00 MZN", Number(resCustBal2.rows[0].current_balance) === 0, `Balance: ${resCustBal2.rows[0].current_balance} MZN`);

    // 2. OVER-ALLOCATION REJECTION TEST
    try {
      await client.query(`SELECT private.allocate_payment('${payId}', '${ftId}', 5000.00);`);
      record("Over-Allocation Rejection", false, "Allowed allocation exceeding unapplied amount!");
    } catch (err) {
      record("Over-Allocation Rejection", true, "Blocked allocation exceeding unapplied balance");
    }

    // 3. PAYMENT REVERSAL TEST
    const resRev = await client.query(`SELECT private.reverse_payment('${payId}', 'Erro no valor recebido');`);
    record("Payment Reversal Executed", resRev.rows[0].reverse_payment === payId, "Reversed payment");

    const resDocStatusAfterRev = await client.query(`SELECT status, outstanding_amount FROM public.documents WHERE id = '${ftId}';`);
    record("Document Outstanding Amount Restored After Reversal", resDocStatusAfterRev.rows[0].status === 'CONFIRMED' && Number(resDocStatusAfterRev.rows[0].outstanding_amount) === 10000, `Outstanding restored to ${resDocStatusAfterRev.rows[0].outstanding_amount}`);

    const resCustBal3 = await client.query(`SELECT current_balance FROM public.customers WHERE id = '${customerId}';`);
    record("Customer Current Balance Restored After Reversal", Number(resCustBal3.rows[0].current_balance) === 10000, `Balance restored to ${resCustBal3.rows[0].current_balance} MZN`);

    // 4. CLEANUP SYNTHETIC TEST RECORDS
    await client.query("DELETE FROM public.payment_receipts WHERE payment_id = '" + payId + "';");
    await client.query("DELETE FROM public.payment_reversals WHERE original_payment_id = '" + payId + "';");
    await client.query("DELETE FROM public.payment_allocations WHERE payment_id = '" + payId + "';");
    await client.query("DELETE FROM public.payment_method_entries WHERE payment_id = '" + payId + "';");
    await client.query("DELETE FROM public.payments WHERE id = '" + payId + "';");
    await client.query("DELETE FROM public.document_lines WHERE document_id = '" + ftId + "';");
    await client.query("DELETE FROM public.document_status_history WHERE document_id = '" + ftId + "';");
    await client.query("DELETE FROM public.ledger_entries WHERE customer_id = '" + customerId + "';");
    await client.query("DELETE FROM public.stock_movements WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.inventory_balances WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.documents WHERE id = '" + ftId + "';");
    await client.query("DELETE FROM public.products WHERE id = '" + productId + "';");
    await client.query("DELETE FROM public.customers WHERE id = '" + customerId + "';");
    await client.query("DELETE FROM public.suppliers WHERE id = '" + supplierId + "';");
    await client.query("DELETE FROM public.user_profiles WHERE username = 'pay_admin';");
    await client.query("DELETE FROM auth.users WHERE email = 'pay_admin@casadepeneus.co.mz';");

    console.log("\n=== COMPREHENSIVE PROD-WP09 TEST RESULTS ===");
    console.table(testResults);

    await client.end();
  } catch (err) {
    console.error("ERROR in payment engine test suite:", err);
    await client.end().catch(() => {});
  }
}

testPaymentsEngine();
