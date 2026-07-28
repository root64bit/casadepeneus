import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const sql = fs.readFileSync(
  "supabase/migrations/20260728310000_015_role_matrix_completion.sql",
  "utf8",
).replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");

const expected = {
  SALES_OP: ["sales.create", "sales.confirm", "documents.view", "documents.print"],
  CASHIER: ["sales.create", "payments.receive", "payments.allocate", "documents.view"],
  PURCHASING_OP: ["purchases.invoice.create", "purchases.invoice.confirm", "documents.view"],
  ACCOUNTING_OP: ["payments.receive", "payments.pay_supplier", "payments.allocate_supplier", "reports.tax"],
  STOCK_OP: ["stock.view", "stock.entry.confirm", "stock.exit.confirm"],
  READ_ONLY: ["products.view", "stock.view", "customers.view", "suppliers.view", "documents.view", "payments.view"],
  ADMIN: ["users.manage", "roles.manage", "settings.manage", "migration.manage"],
};

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);

  const result = await client.query(`
    SELECT r.code AS role_code, array_remove(array_agg(p.code ORDER BY p.code), NULL) AS permissions
    FROM public.roles r
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    GROUP BY r.code
    ORDER BY r.code
  `);

  for (const [role, permissions] of Object.entries(expected)) {
    const actual = result.rows.find((row) => row.role_code === role)?.permissions ?? [];
    const missing = permissions.filter((permission) => !actual.includes(permission));
    if (missing.length) throw new Error(`${role} missing permissions: ${missing.join(", ")}`);
  }

  const readonly = result.rows.find((row) => row.role_code === "READ_ONLY")?.permissions ?? [];
  const forbiddenReadonly = readonly.filter((permission) =>
    /\.(create|update|confirm|manage|reverse|adjust)$/.test(permission)
  );
  if (forbiddenReadonly.length) {
    throw new Error(`READ_ONLY has write permissions: ${forbiddenReadonly.join(", ")}`);
  }

  const mode = await client.query(
    "SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'",
  );
  if (mode.rows[0]?.setting_value !== "MIGRATION") throw new Error("SYSTEM_MODE changed.");

  console.log(JSON.stringify({
    validation: "PASS",
    rolesChecked: Object.keys(expected),
    readOnlyWritePermissions: forbiddenReadonly,
    systemMode: "MIGRATION",
    outcome: "ROLLBACK",
  }, null, 2));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
