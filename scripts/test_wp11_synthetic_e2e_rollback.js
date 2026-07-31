import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const countState = async () =>
  (
    await client.query(`
      SELECT
        (SELECT count(*)::int FROM public.products) AS products,
        (SELECT count(*)::int FROM public.customers) AS customers,
        (SELECT count(*)::int FROM public.suppliers) AS suppliers,
        (SELECT count(*)::int FROM public.documents) AS documents,
        (SELECT count(*)::int FROM public.document_lines) AS document_lines,
        (SELECT count(*)::int FROM public.stock_movements) AS stock_movements,
        (SELECT count(*)::int FROM public.payments) AS payments,
        (SELECT count(*)::int FROM public.payment_allocations) AS allocations,
        (SELECT count(*)::int FROM public.ledger_entries) AS ledger_entries
    `)
  ).rows[0];

try {
  await client.connect();
  const before = await countState();
  const modeResult = await client.query(
    "SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'",
  );
  const systemMode = modeResult.rows[0]?.setting_value ?? "UNKNOWN";

  const testProfile = await client.query(`
    SELECT up.id
    FROM public.user_profiles up
    WHERE up.is_active
    ORDER BY up.created_at
    LIMIT 1
  `);
  if (!testProfile.rows[0]) {
    throw new Error("No active test profile exists for synthetic testing.");
  }
  const migrationAdminRole = await client.query(`
    SELECT r.id
    FROM public.roles r
    WHERE EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = r.id AND p.code = 'migration.manage'
    )
    ORDER BY r.is_system_role DESC, r.code
    LIMIT 1
  `);
  if (!migrationAdminRole.rows[0]) {
    throw new Error("No role grants migration.manage.");
  }
  const userId = testProfile.rows[0].id;

  await client.query("BEGIN");
  await client.query(
    `
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [userId, migrationAdminRole.rows[0].id],
  );
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
    userId,
  ]);
  await client.query(
    "SELECT set_config('request.jwt.claim.role', 'authenticated', true)",
  );

  await client.query("SAVEPOINT normal_mode_check");
  let normalModeRejected = false;
  try {
    await client.query("SELECT public.require_operational_mode()");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT normal_mode_check");
    normalModeRejected = error.message.includes("OPERATIONAL_MODE_REQUIRED");
  }
  await client.query("RELEASE SAVEPOINT normal_mode_check");
  if (systemMode === "MIGRATION" && !normalModeRejected) {
    throw new Error("Normal MIGRATION-mode session was not rejected.");
  }

  await client.query(
    "SELECT set_config('app.synthetic_test_mode', 'on', true)",
  );
  await client.query("SELECT public.require_operational_mode()");

  const suffix = Date.now().toString().slice(-8);
  const customerNumber = `TEST-C-${suffix}`;
  const supplierNumber = `TEST-S-${suffix}`;
  const productCode = `TEST-P-${suffix}`;

  const customer = await client.query(
    `
      SELECT public.create_operational_customer($1::JSONB) AS id
    `,
    [
      JSON.stringify({
        number: customerNumber,
        name: `TEST Customer ${suffix}`,
        tax_number: null,
        telephone: null,
        email: null,
        address: "TEST ONLY",
        city: "Maputo",
        credit_limit: 100000,
        payment_term_code: "DINHEIRO",
        notes: "TEST WP11 - ROLLBACK REQUIRED",
      }),
    ],
  );
  const customerId = customer.rows[0].id;

  const supplier = await client.query(
    `
      SELECT public.create_operational_supplier($1::JSONB) AS id
    `,
    [
      JSON.stringify({
        number: supplierNumber,
        name: `TEST Supplier ${suffix}`,
        tax_number: null,
        telephone: null,
        email: null,
        address: "TEST ONLY",
        city: "Maputo",
        contact_person: "TEST",
        credit_limit: 100000,
        payment_term_code: "DINHEIRO",
        notes: "TEST WP11 - ROLLBACK REQUIRED",
      }),
    ],
  );
  const supplierId = supplier.rows[0].id;

  const product = await client.query(
    `
      SELECT public.create_operational_product($1::JSONB) AS id
    `,
    [
      JSON.stringify({
        code: productCode,
        description: `TEST Product ${suffix}`,
        unit: "UN",
        min_stock: 0,
        cost_price: 100,
        profit_margin: 50,
        sale_price_excl: 150,
        sale_price_incl: 174,
        notes: "TEST WP11 - ROLLBACK REQUIRED",
      }),
    ],
  );
  const productId = product.rows[0].id;

  await client.query(
    `
      SELECT public.post_operational_stock_movement(
        $1, 'direct_entry', 10, $2
      )
    `,
    [productId, `TEST-STOCK-${suffix}`],
  );

  const sale = await client.query(
    `
      SELECT *
      FROM public.create_and_confirm_customer_sale(
        $1, CURRENT_DATE, 'DINHEIRO', $2::JSONB, $3
      )
    `,
    [
      customerId,
      JSON.stringify([
        {
          article_id: productId,
          quantity: 2,
          discount_percent: 0,
        },
      ]),
      `TEST-SALE-${suffix}`,
    ],
  );
  const document = sale.rows[0];

  const payment = await client.query(
    `
      SELECT *
      FROM public.create_and_confirm_customer_payment(
        $1, $2, 'CASH', $3, NULL, $4
      )
    `,
    [
      customerId,
      document.id,
      document.grand_total,
      `TEST-PAYMENT-${suffix}`,
    ],
  );

  const purchase = await client.query(
    `
      SELECT *
      FROM public.create_and_confirm_supplier_invoice(
        $1, CURRENT_DATE, 'DINHEIRO', $2, $3::JSONB, $4
      )
    `,
    [
      supplierId,
      `TEST-SUPPLIER-INVOICE-${suffix}`,
      JSON.stringify([
        {
          article_id: productId,
          quantity: 5,
          unit_cost: 100,
          discount_percent: 0,
        },
      ]),
      `TEST-PURCHASE-${suffix}`,
    ],
  );
  const purchaseDocument = purchase.rows[0];

  const supplierPayment = await client.query(
    `
      SELECT *
      FROM public.create_and_confirm_supplier_payment(
        $1, $2, 'CASH', $3, NULL, $4
      )
    `,
    [
      supplierId,
      purchaseDocument.id,
      purchaseDocument.grand_total,
      `TEST-SUPPLIER-PAYMENT-${suffix}`,
    ],
  );

  const inside = await countState();
  const verification = await client.query(
    `
      SELECT
        d.status AS document_status,
        d.outstanding_amount,
        p.status AS payment_status,
        p.unapplied_amount,
        (
          SELECT count(*)::int
          FROM public.payment_allocations pa
          WHERE pa.payment_id = p.id AND pa.document_id = d.id
            AND pa.status = 'ACTIVE'
        ) AS allocation_count,
        (
          SELECT quantity
          FROM public.inventory_balances
          WHERE product_id = $3
          ORDER BY last_movement_at DESC
          LIMIT 1
        ) AS remaining_stock,
        (
          SELECT count(*)::int
          FROM public.ledger_entries
          WHERE customer_id = $1
        ) AS customer_ledger_entries,
        sd.status AS supplier_document_status,
        sd.outstanding_amount AS supplier_outstanding_amount,
        sp.status AS supplier_payment_status,
        sp.unapplied_amount AS supplier_unapplied_amount,
        (
          SELECT count(*)::int
          FROM public.payment_allocations spa
          WHERE spa.payment_id = sp.id AND spa.document_id = sd.id
            AND spa.status = 'ACTIVE'
        ) AS supplier_allocation_count,
        (
          SELECT count(*)::int
          FROM public.ledger_entries
          WHERE supplier_id = $5
        ) AS supplier_ledger_entries
      FROM public.documents d
      CROSS JOIN public.payments p
      CROSS JOIN public.documents sd
      CROSS JOIN public.payments sp
      WHERE d.id = $2 AND p.id = $4
        AND sd.id = $6 AND sp.id = $7
    `,
    [
      customerId,
      document.id,
      productId,
      payment.rows[0].id,
      supplierId,
      purchaseDocument.id,
      supplierPayment.rows[0].id,
    ],
  );

  const facts = verification.rows[0];
  const insidePass =
    facts.document_status === "PAID" &&
    Number(facts.outstanding_amount) === 0 &&
    facts.payment_status === "FULLY_ALLOCATED" &&
    Number(facts.unapplied_amount) === 0 &&
    facts.allocation_count === 1 &&
    Number(facts.remaining_stock) === 13 &&
    facts.customer_ledger_entries >= 2 &&
    facts.supplier_document_status === "PAID" &&
    Number(facts.supplier_outstanding_amount) === 0 &&
    facts.supplier_payment_status === "FULLY_ALLOCATED" &&
    Number(facts.supplier_unapplied_amount) === 0 &&
    facts.supplier_allocation_count === 1 &&
    facts.supplier_ledger_entries >= 2;
  if (!insidePass) {
    throw new Error(`Synthetic workflow reconciliation failed: ${JSON.stringify(facts)}`);
  }

  await client.query("ROLLBACK");

  const after = await countState();
  const residue = await client.query(
    `
      SELECT
        EXISTS (SELECT 1 FROM public.products WHERE code = $1) AS product,
        EXISTS (SELECT 1 FROM public.customers WHERE customer_number = $2) AS customer,
        EXISTS (SELECT 1 FROM public.suppliers WHERE supplier_number = $3) AS supplier,
        EXISTS (
          SELECT 1 FROM public.documents WHERE idempotency_key = $4
        ) AS document,
        EXISTS (
          SELECT 1 FROM public.payments WHERE idempotency_key = $5
        ) AS payment,
        EXISTS (
          SELECT 1 FROM public.documents WHERE idempotency_key = $6
        ) AS supplier_document,
        EXISTS (
          SELECT 1 FROM public.payments WHERE idempotency_key = $7
        ) AS supplier_payment
    `,
    [
      productCode,
      customerNumber,
      supplierNumber,
      `TEST-SALE-${suffix}`,
      `TEST-PAYMENT-${suffix}`,
      `TEST-PURCHASE-${suffix}`,
      `TEST-SUPPLIER-PAYMENT-${suffix}`,
    ],
  );

  const countsRestored = JSON.stringify(before) === JSON.stringify(after);
  const noResidue = Object.values(residue.rows[0]).every((value) => !value);
  if (!countsRestored || !noResidue) {
    throw new Error("Synthetic rollback cleanup verification failed.");
  }

  console.log(
    JSON.stringify(
      {
        result: "PASS",
        systemMode,
        normalModeRejected,
        syntheticWorkflow: {
          customerCreated: Boolean(customerId),
          supplierCreated: Boolean(supplierId),
          productCreated: Boolean(productId),
          documentStatus: facts.document_status,
          paymentStatus: facts.payment_status,
          allocationCount: facts.allocation_count,
          remainingStock: facts.remaining_stock,
          ledgerEntries: facts.customer_ledger_entries,
          supplierDocumentStatus: facts.supplier_document_status,
          supplierPaymentStatus: facts.supplier_payment_status,
          supplierAllocationCount: facts.supplier_allocation_count,
          supplierLedgerEntries: facts.supplier_ledger_entries,
        },
        rollback: {
          countsBefore: before,
          countsDuring: inside,
          countsAfter: after,
          countsRestored,
          noTestResidue: noResidue,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
