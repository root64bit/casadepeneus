import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.database_url;

async function testDocumentsEngine() {
  console.log("Connecting to production pooler for PROD-WP08 Synthetic Test Suite...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Setup Test Company, Branch, Warehouse, Fiscal Period & User
    const companyId = 'a0000000-0000-0000-0000-000000000001';
    const branchId = 'b0000000-0000-0000-0000-000000000001';
    const warehouseId = 'c0000000-0000-0000-0000-000000000001';
    const fiscalPeriodId = 'f2026000-0000-0000-0000-000000002026';
    const userId = '00000000-0000-0000-0000-000000000001';

    // Provision Test Auth User in auth.users (Triggers handle_new_user)
    await client.query(`
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ('${userId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_wp08@casadepeneus.co.mz', 'secret', now(), '{}', '{"full_name":"Admin WP08"}', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Ensure user_profiles row exists
    await client.query(`
      INSERT INTO public.user_profiles (id, company_id, username, full_name, email)
      VALUES ('${userId}', '${companyId}', 'admin_wp08', 'Administrador Teste WP08', 'admin_wp08@casadepeneus.co.mz')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 1. Create Test Customer & Supplier
    const resCust = await client.query(`
      INSERT INTO public.customers (company_id, customer_number, name)
      VALUES ('${companyId}', 'TEST-CLI-808', 'Cliente Teste Comercial WP08')
      ON CONFLICT (company_id, customer_number) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const customerId = resCust.rows[0].id;

    const resSupp = await client.query(`
      INSERT INTO public.suppliers (company_id, supplier_number, name)
      VALUES ('${companyId}', 'TEST-FOR-808', 'Fornecedor Teste Comercial WP08')
      ON CONFLICT (company_id, supplier_number) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const supplierId = resSupp.rows[0].id;

    // 2. Create Test Product & Initial Stock
    const resProd = await client.query(`
      INSERT INTO public.products (company_id, code, description, unit_id, tax_code_id, avg_cost, sale_price_excl, sale_price_incl)
      VALUES ('${companyId}', 'PN-TEST-808', 'Pneu Teste 205/55R16', '11000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000016', 3000.00, 5000.00, 5800.00)
      ON CONFLICT (company_id, code) DO UPDATE SET sale_price_excl = EXCLUDED.sale_price_excl
      RETURNING id;
    `);
    const productId = resProd.rows[0].id;

    // Seed initial stock of 100 units via post_stock_movement
    await client.query(`
      SELECT public.post_stock_movement(
        '${companyId}', '${productId}', '${warehouseId}', 'opening_stock', 100.000, 0.000, 3000.00
      );
    `);

    // Fetch initial balance
    const resBalBefore = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}' AND warehouse_id = '${warehouseId}';`);
    console.log("Initial Product Stock Quantity:", resBalBefore.rows[0].quantity);

    // 3. TEST 1: Create & Confirm Customer Delivery Note (Guia de Remessa)
    console.log("\n--- TEST 1: Customer Delivery Note (Guia de Remessa) ---");
    const resDNType = await client.query(`SELECT id FROM public.document_types WHERE code = 'CUSTOMER_DELIVERY_NOTE';`);
    const dnTypeId = resDNType.rows[0].id;

    const resDNDoc = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${dnTypeId}', '${fiscalPeriodId}', '${customerId}', '${userId}')
      RETURNING id;
    `);
    const dnDocId = resDNDoc.rows[0].id;

    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot)
      VALUES ('${companyId}', '${dnDocId}', 1, '${productId}', 'Pneu Teste 205/55R16', 10.000, 5000.00, '17000000-0000-0000-0000-000000000016', 16.00, 50000.00, 8000.00, 58000.00, 3000.00);
    `);

    // Confirm Delivery Note via RPC
    const resDNConf = await client.query(`SELECT display_number, status, stock_posted FROM private.confirm_customer_document('${dnDocId}', 'IDEM-DN-808-01');`);
    console.log("Confirmed Delivery Note:", resDNConf.rows[0]);

    const resBalAfterDN = await client.query(`SELECT quantity FROM public.inventory_balances WHERE product_id = '${productId}' AND warehouse_id = '${warehouseId}';`);
    console.log("Stock after Delivery Note (Expected 90.000):", resBalAfterDN.rows[0].quantity);

    // 4. TEST 2: Create & Confirm Customer Invoice (Factura)
    console.log("\n--- TEST 2: Customer Invoice (Factura) & Financial Posting ---");
    const resFTType = await client.query(`SELECT id FROM public.document_types WHERE code = 'CUSTOMER_INVOICE';`);
    const ftTypeId = resFTType.rows[0].id;

    const resFTDoc = await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, customer_id, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${ftTypeId}', '${fiscalPeriodId}', '${customerId}', '${userId}')
      RETURNING id;
    `);
    const ftDocId = resFTDoc.rows[0].id;

    await client.query(`
      INSERT INTO public.document_lines (company_id, document_id, line_number, product_id, description_snapshot, quantity, unit_price, tax_code_id, tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot)
      VALUES ('${companyId}', '${ftDocId}', 1, '${productId}', 'Pneu Teste 205/55R16', 5.000, 5000.00, '17000000-0000-0000-0000-000000000016', 16.00, 25000.00, 4000.00, 29000.00, 3000.00);
    `);

    const resFTConf = await client.query(`SELECT display_number, status, stock_posted, financial_posted, grand_total FROM private.confirm_customer_document('${ftDocId}', 'IDEM-FT-808-01');`);
    console.log("Confirmed Customer Invoice:", resFTConf.rows[0]);

    // Check Customer Ledger Entry & Current Balance
    const resLedger = await client.query(`SELECT entry_type, debit_amount, credit_amount, status FROM public.ledger_entries WHERE source_document_id = '${ftDocId}';`);
    console.log("Ledger Entry created:", resLedger.rows[0]);

    const resCustBal = await client.query(`SELECT current_balance FROM public.customers WHERE id = '${customerId}';`);
    console.log("Customer Current Balance (Expected 29,000.00 MZN):", resCustBal.rows[0].current_balance);

    // 5. TEST 3: Duplicate Supplier Invoice Rejection
    console.log("\n--- TEST 3: Duplicate Supplier Invoice Rejection Check ---");
    const resSuppInvType = await client.query(`SELECT id FROM public.document_types WHERE code = 'SUPPLIER_INVOICE';`);
    const suppInvTypeId = resSuppInvType.rows[0].id;

    // Create 1st Supplier Invoice
    await client.query(`
      INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, supplier_id, supplier_invoice_number, created_by)
      VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${suppInvTypeId}', '${fiscalPeriodId}', '${supplierId}', 'INV-SUPP-999', '${userId}')
      RETURNING id;
    `);

    try {
      // Attempt 2nd Supplier Invoice with same supplier_invoice_number
      await client.query(`
        INSERT INTO public.documents (company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id, supplier_id, supplier_invoice_number, created_by)
        VALUES ('${companyId}', '${branchId}', '${warehouseId}', '${suppInvTypeId}', '${fiscalPeriodId}', '${supplierId}', 'INV-SUPP-999', '${userId}');
      `);
      console.error("ERROR: Duplicate supplier invoice insertion did NOT fail!");
    } catch (dupErr) {
      console.log("SUCCESS! Duplicate supplier invoice rejected cleanly:", dupErr.message);
    }

    // 6. TEST 4: Reversal of Confirmed Document
    console.log("\n--- TEST 4: Reversal of Confirmed Customer Invoice ---");
    const resRev = await client.query(`SELECT private.reverse_confirmed_document('${ftDocId}', 'Cancelamento por erro de emissão');`);
    console.log("Reversal Executed:", resRev.rows[0]);

    const resFTRevStatus = await client.query(`SELECT status, cancellation_reason FROM public.documents WHERE id = '${ftDocId}';`);
    console.log("Reversed Document Status:", resFTRevStatus.rows[0]);

    // Check Ledger Status after reversal
    const resLedgerRev = await client.query(`SELECT status FROM public.ledger_entries WHERE source_document_id = '${ftDocId}';`);
    console.log("Ledger Entry Status (Expected REVERSED):", resLedgerRev.rows[0].status);

    await client.end();
  } catch (err) {
    console.error("ERROR in document engine test suite:", err);
    await client.end().catch(() => {});
  }
}

testDocumentsEngine();
