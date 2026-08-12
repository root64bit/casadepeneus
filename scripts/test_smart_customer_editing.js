import assert from 'node:assert/strict';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error('DATABASE_URL missing in .env');

const documentTypes = [
  'CUSTOMER_INVOICE',
  'CASH_SALE',
  'CUSTOMER_DELIVERY_NOTE',
  'CUSTOMER_QUOTATION',
];

async function main() {
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query('BEGIN');

  try {
    const userResult = await client.query(`
      SELECT DISTINCT up.id
      FROM public.user_profiles up
      JOIN public.user_roles ur ON ur.user_id = up.id
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.code = 'sales.create'
      ORDER BY up.id
      LIMIT 1
    `);
    assert.equal(userResult.rowCount, 1, 'No user with sales.create was found');

    const userId = userResult.rows[0].id;
    await client.query(
      `SELECT
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.role', 'authenticated', true)`,
      [userId],
    );

    const suffix = String(Date.now()).slice(-7);
    const newName = `TESTE CLIENTE INTELIGENTE ${suffix}`;
    const newNuit = `99${suffix}`;
    const newAddress = `Morada de teste ${suffix}`;

    const maxResult = await client.query(`
      SELECT COALESCE(MAX((substring(TRIM(customer_number) FROM '([0-9]+)$'))::BIGINT), 0) AS max_number
      FROM public.customers
      WHERE company_id = public.get_user_company_id()
        AND TRIM(customer_number) ~ '[0-9]+$'
    `);
    const expectedNumber = String(BigInt(maxResult.rows[0].max_number) + 1n);

    const createdResult = await client.query(
      `SELECT public.resolve_or_create_operational_customer(NULL, $1, $2, $3) AS id`,
      [newName, newNuit, newAddress],
    );
    const createdId = createdResult.rows[0].id;
    assert.ok(createdId, 'The new customer was not created');

    const createdCustomer = await client.query(
      `SELECT customer_number, name, tax_number
       FROM public.customers
       WHERE id = $1`,
      [createdId],
    );
    assert.deepEqual(createdCustomer.rows[0], {
      customer_number: expectedNumber,
      name: newName,
      tax_number: newNuit,
    });

    const addressResult = await client.query(
      `SELECT address_line_1, is_primary
       FROM public.customer_addresses
       WHERE customer_id = $1`,
      [createdId],
    );
    assert.deepEqual(addressResult.rows[0], {
      address_line_1: newAddress,
      is_primary: true,
    });

    const byNuitResult = await client.query(
      `SELECT public.resolve_or_create_operational_customer(NULL, $1, $2, NULL) AS id`,
      ['Nome diferente, mesmo NUIT', newNuit],
    );
    assert.equal(byNuitResult.rows[0].id, createdId, 'NUIT lookup created a duplicate');

    const byNameResult = await client.query(
      `SELECT public.resolve_or_create_operational_customer(NULL, $1, NULL, NULL) AS id`,
      [newName.toLowerCase()],
    );
    assert.equal(byNameResult.rows[0].id, createdId, 'Name lookup created a duplicate');

    const documentsResult = await client.query(
      `SELECT DISTINCT ON (dt.code)
         d.id,
         d.grand_total,
         dt.code
       FROM public.documents d
       JOIN public.document_types dt ON dt.id = d.document_type_id
       WHERE d.company_id = public.get_user_company_id()
         AND dt.code = ANY($1::TEXT[])
       ORDER BY dt.code, d.created_at DESC`,
      [documentTypes],
    );

    const foundTypes = new Set(documentsResult.rows.map((row) => row.code));
    for (const type of documentTypes) {
      assert.ok(foundTypes.has(type), `No testable document found for ${type}`);
    }

    for (const document of documentsResult.rows) {
      await client.query(
        `SELECT public.update_operational_document($1, $2, $3, $4, $5, $6, NULL)`,
        [
          document.id,
          newName,
          newNuit,
          newAddress,
          document.grand_total,
          'Teste transacional; será revertido',
        ],
      );

      const linkResult = await client.query(
        `SELECT customer_id FROM public.documents WHERE id = $1`,
        [document.id],
      );
      assert.equal(
        linkResult.rows[0].customer_id,
        createdId,
        `${document.code} was not linked to the resolved customer`,
      );
    }

    const duplicateCount = await client.query(
      `SELECT COUNT(*)::INT AS count
       FROM public.customers
       WHERE company_id = public.get_user_company_id()
         AND (
           LOWER(TRIM(name)) = LOWER(TRIM($1))
           OR tax_number = $2
         )`,
      [newName, newNuit],
    );
    assert.equal(duplicateCount.rows[0].count, 1, 'Duplicate customer records were created');

    console.log('✅ Smart customer creation and editing passed for FT, VD, GR and Cotação.');
    console.log(`✅ Sequential code validated: ${expectedNumber}.`);
    console.log('✅ Name/NUIT reuse and primary address creation validated.');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Smart customer test failed:', error);
  process.exitCode = 1;
});
