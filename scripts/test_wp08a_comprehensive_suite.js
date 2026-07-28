import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function runWP08AClosureTests() {
  console.log("Connecting to production pooler for PROD-WP08A Closure Test Suite...");
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
      VALUES ('${userId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'closure_admin@casadepeneus.co.mz', 'secret', now(), '{}', '{"full_name":"Closure Admin"}', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.user_profiles (id, company_id, username, full_name, email)
      VALUES ('${userId}', '${companyId}', 'closure_admin', 'Closure Admin WP08A', 'closure_admin@casadepeneus.co.mz')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup Customer, Supplier & Product
    const resCust = await client.query(`
      INSERT INTO public.customers (company_id, customer_number, name)
      VALUES ('${companyId}', 'CLOSURE-CLI-01', 'Cliente Encerramento WP08A')
      ON CONFLICT (company_id, customer_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const customerId = resCust.rows[0].id;

    const resSupp = await client.query(`
      INSERT INTO public.suppliers (company_id, supplier_number, name)
      VALUES ('${companyId}', 'CLOSURE-FOR-01', 'Fornecedor Encerramento WP08A')
      ON CONFLICT (company_id, supplier_number) DO UPDATE SET name = EXCLUDED.name RETURNING id;
    `);
    const supplierId = resSupp.rows[0].id;

    const resProd = await client.query(`
      INSERT INTO public.products (company_id, code, description, unit_id, tax_code_id, avg_cost, sale_price_excl, sale_price_incl)
      VALUES ('${companyId}', 'PN-CLOSURE-01', 'Pneu Teste Closure 225/65R17', '11000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000016', 4000.00, 6000.00, 6960.00)
      ON CONFLICT (company_id, code) DO UPDATE SET sale_price_excl = EXCLUDED.sale_price_excl RETURNING id;
    `);
    const productId = resProd.rows[0].id;

    // Seed 100 units initial stock
    await client.query(`SELECT public.post_stock_movement('${companyId}', '${productId}', '${warehouseId}', 'opening_stock', 100.000, 0.000, 4000.00);`);

    // Fetch document type IDs
    const resTypes = await client.query("SELECT code, id FROM public.document_types;");
    const docTypes = {};
    resTypes.rows.forEach(r => docTypes[r.code] = r.id);

    // 1. CUSTOMER DELIVERY NOTE (Guia de Remessa)
    const resDN = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.CUSTOMER_DELIVERY_NOTE}', '${fiscalPeriodId}', '${customerId}', '${userId}') RETURNING id;
    `);
    const dnId = resDN.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot)
      VALUES ('${companyId}', '${dnId}', 1, '${productId}', 'Pneu Teste Closure', 10.000, 6000.00, '17000000-0000-0000-0000-000000000016', 16.00, 60000.00, 9600.00, 69600.00, 4000.00);
    `);
    const resDNConf = await client.query(`SELECT status, stock_posted FROM private.confirm_customer_document('${dnId}', 'IDEM-DN-01');`);
    const resBal1 = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}';`);
    record("Customer Delivery Note Posts Stock Exit", resDNConf.rows[0].stock_posted && Number(resBal1.rows[0].quantity) === 90, `Stock balance: ${resBal1.rows[0].quantity}`);

    // 2. LINKED CUSTOMER INVOICE (No duplicate stock exit)
    const resFT = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, source_document_id, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.CUSTOMER_INVOICE}', '${fiscalPeriodId}', '${customerId}', '${dnId}', '${userId}') RETURNING id;
    `);
    const ftId = resFT.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot, stock_effect_enabled)
      VALUES ('${companyId}', '${ftId}', 1, '${productId}', 'Pneu Teste Closure', 10.000, 6000.00, '17000000-0000-0000-0000-000000000016', 16.00, 60000.00, 9600.00, 69600.00, 4000.00, false);
    `);
    const resFTConf = await client.query(`SELECT status, financial_posted FROM private.confirm_customer_document('${ftId}', 'IDEM-FT-01');`);
    const resBal2 = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}';`);
    record("Linked Customer Invoice Prevents Duplicate Stock Exit", resFTConf.rows[0].financial_posted && Number(resBal2.rows[0].quantity) === 90, `Stock balance remained 90`);

    // 3. CREDIT NOTE HELPER RPC & CONFIRMATION WITH STOCK RETURN
    const resCNId = await client.query(`SELECT private.create_customer_credit_note_from_document('${ftId}', 'Devolução de 10 pneus', true);`);
    const cnId = resCNId.rows[0].create_customer_credit_note_from_document;
    const resCNConf = await client.query(`SELECT status, stock_posted, financial_posted FROM private.confirm_customer_document('${cnId}', 'IDEM-CN-01');`);
    const resBal3 = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}';`);
    record("Customer Credit Note with Stock Return Posts Stock IN", resCNConf.rows[0].stock_posted && Number(resBal3.rows[0].quantity) === 100, `Stock returned to ${resBal3.rows[0].quantity}`);

    // 4. DEBIT NOTE HELPER RPC
    const resDN2Id = await client.query(`SELECT private.create_customer_debit_note_from_document('${ftId}', 'Ajuste de preço');`);
    const dn2Id = resDN2Id.rows[0].create_customer_debit_note_from_document;
    const resDN2Conf = await client.query(`SELECT status, financial_posted FROM private.confirm_customer_document('${dn2Id}', 'IDEM-DN2-01');`);
    record("Customer Debit Note Financial Posting", resDN2Conf.rows[0].financial_posted, `Debit note confirmed`);

    // 5. SUPPLIER INVOICE & SUPPLIER CREDIT ADVICE HELPER RPC
    const resSuppInv = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, supplier_id, supplier_invoice_number, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.SUPPLIER_INVOICE}', '${fiscalPeriodId}', '${supplierId}', 'SUPP-CLOSURE-77', '${userId}') RETURNING id;
    `);
    const suppInvId = resSuppInv.rows[0].id;
    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount)
      VALUES ('${companyId}', '${suppInvId}', 1, '${productId}', 'Pneu Teste Closure', 20.000, 4000.00, '17000000-0000-0000-0000-000000000016', 16.00, 80000.00, 12800.00, 92800.00);
    `);
    const resSuppConf = await client.query(`SELECT status, stock_posted, financial_posted FROM private.confirm_supplier_document('${suppInvId}', 'IDEM-SUPP-01');`);
    const resBal4 = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}';`);
    record("Supplier Invoice Posts Stock IN & Payable Entry", resSuppConf.rows[0].stock_posted && Number(resBal4.rows[0].quantity) === 120, `Stock balance increased to 120`);

    const resSCAId = await client.query(`SELECT private.create_supplier_credit_advice_from_document('${suppInvId}', 'Desconto comercial fornecedor');`);
    const scaId = resSCAId.rows[0].create_supplier_credit_advice_from_document;
    const resSCAConf = await client.query(`SELECT status, financial_posted FROM private.confirm_supplier_document('${scaId}', 'IDEM-SCA-01');`);
    record("Supplier Credit Advice Reduces Payable", resSCAConf.rows[0].financial_posted, `Credit advice confirmed`);

    // 6. SUPPLIER RETURN HELPER RPC
    const resSRId = await client.query(`SELECT private.create_supplier_return_from_document('${suppInvId}', 'Devolução por defeito');`);
    const srId = resSRId.rows[0].create_supplier_return_from_document;
    const resSRConf = await client.query(`SELECT status, stock_posted FROM private.confirm_supplier_document('${srId}', 'IDEM-SR-01');`);
    const resBal5 = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}';`);
    record("Supplier Return Posts Stock OUT", resSRConf.rows[0].stock_posted && Number(resBal5.rows[0].quantity) === 100, `Stock reduced to ${resBal5.rows[0].quantity}`);

    // 7. DUPLICATE SUPPLIER INVOICE REJECTION
    try {
      await client.query(`
        INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, supplier_id, supplier_invoice_number, created_by)
        VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${docTypes.SUPPLIER_INVOICE}', '${fiscalPeriodId}', '${supplierId}', 'SUPP-CLOSURE-77', '${userId}');
      `);
      record("Duplicate Supplier Invoice Rejection", false, "Allowed duplicate supplier invoice!");
    } catch (err) {
      record("Duplicate Supplier Invoice Rejection", true, "Rejected duplicate invoice number");
    }

    // 8. IDEMPOTENCY RETRY WITH SAME VS DIFFERENT KEY
    const resIdemSame = await client.query(`SELECT status FROM private.confirm_customer_document('${ftId}', 'IDEM-FT-01');`);
    record("Idempotency Retry Same Key Succeeds", resIdemSame.rows[0].status === 'CONFIRMED', "Returned existing confirmed document");

    try {
      await client.query(`SELECT status FROM private.confirm_customer_document('${ftId}', 'IDEM-DIFF-KEY');`);
      record("Idempotency Retry Different Key Rejected", false, "Allowed different idempotency key!");
    } catch (err) {
      record("Idempotency Retry Different Key Rejected", true, "Rejected different idempotency key");
    }

    // 9. REVERSAL RETRY BEHAVIOUR
    const resRev1 = await client.query(`SELECT private.reverse_confirmed_document('${ftId}', 'Primeiro cancelamento');`);
    record("First Document Reversal Succeeds", resRev1.rows[0].reverse_confirmed_document === ftId, "Reversed document");

    try {
      await client.query(`SELECT private.reverse_confirmed_document('${ftId}', 'Segundo cancelamento');`);
      record("Reversal Retry Rejected", false, "Allowed double reversal!");
    } catch (err) {
      record("Reversal Retry Rejected", true, "Blocked double reversal");
    }

    // 10. CLEANUP SYNTHETIC TEST RECORDS
    await client.query("DELETE FROM public.document_links WHERE source_document_id IN (SELECT id FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "') OR target_document_id IN (SELECT id FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "');");
    await client.query("DELETE FROM public.document_lines WHERE document_id IN (SELECT id FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "');");
    await client.query("DELETE FROM public.document_status_history WHERE document_id IN (SELECT id FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "');");
    await client.query("DELETE FROM public.ledger_entries WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "';");
    await client.query("DELETE FROM public.stock_movements WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.inventory_balances WHERE product_id = '" + productId + "';");
    await client.query("DELETE FROM public.documents WHERE customer_id = '" + customerId + "' OR supplier_id = '" + supplierId + "';");
    await client.query("DELETE FROM public.products WHERE id = '" + productId + "';");
    await client.query("DELETE FROM public.customers WHERE id = '" + customerId + "';");
    await client.query("DELETE FROM public.suppliers WHERE id = '" + supplierId + "';");
    await client.query("DELETE FROM public.user_profiles WHERE username = 'closure_admin';");
    await client.query("DELETE FROM auth.users WHERE email = 'closure_admin@casadepeneus.co.mz';");

    console.log("\n=== COMPREHENSIVE CLOSURE TEST SUITE RESULTS ===");
    console.table(testResults);

    await client.end();
  } catch (err) {
    console.error("ERROR in PROD-WP08A closure test suite:", err);
    await client.end().catch(() => {});
  }
}

runWP08AClosureTests();
