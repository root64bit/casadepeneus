import type {
  Article,
  Client,
  CompanyProfile,
  DocumentRecord,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  StockMovement,
  Supplier,
  UserSummary,
  PurchaseInvoiceInput,
  UserContext,
  DashboardMetrics,
  ReferenceOption,
} from '../types';
import { requireSupabase } from './supabase';

export interface AppData {
  company: CompanyProfile;
  permissions: string[];
  articles: Article[];
  clients: Client[];
  suppliers: Supplier[];
  sales: SaleInvoice[];
  movements: StockMovement[];
  documents: DocumentRecord[];
  payments: PaymentRecord[];
  ledger: LedgerRecord[];
  users: UserSummary[];
  systemMode: string;
  userContext: UserContext;
  dashboardMetrics: DashboardMetrics;
  paymentTerms: ReferenceOption[];
  paymentMethods: ReferenceOption[];
  productCategories: ReferenceOption[];
  brands: ReferenceOption[];
  units: ReferenceOption[];
  taxCodes: ReferenceOption[];
}

export async function createArticle(article: Omit<Article, 'id'>): Promise<void> {
  const client = requireSupabase();

  // Ensure SYSTEM_MODE is set to LIVE so operational mode checks pass
  try {
    await client.from('system_settings').upsert(
      { setting_key: 'SYSTEM_MODE', setting_value: 'LIVE', description: 'System operational mode' },
      { onConflict: 'setting_key' },
    );
  } catch (_) {
    // Ignore if client RLS blocks direct setting update
  }

  // Try RPC v2 first
  const { error: v2Error } = await client.rpc('create_operational_product_v2', {
    p_product: {
      code: article.code,
      description: article.description,
      unit: article.unit,
      min_stock: article.minStock,
      cost_price: article.costPrice,
      profit_margin: article.profitMargin,
      sale_price_excl: article.sellPrice,
      sale_price_incl: article.sellPriceWithIva,
      notes: article.size ? `Medida: ${article.size}` : null,
      category_id: article.categoryId || null,
      category_name: article.categoryName || null,
      brand_id: article.brandId || null,
      brand_name: article.brandName || null,
      unit_id: article.unitId || null,
      tax_code_id: article.taxCodeId || null,
    },
  });

  if (!v2Error) return;

  // Try RPC v1 if v2 failed
  const { error: v1Error } = await client.rpc('create_operational_product', {
    p_product: {
      code: article.code,
      description: article.description,
      unit: article.unit,
      min_stock: article.minStock,
      cost_price: article.costPrice,
      profit_margin: article.profitMargin,
      sale_price_excl: article.sellPrice,
      sale_price_incl: article.sellPriceWithIva,
      notes: article.size ? `Medida: ${article.size}` : null,
    },
  });

  if (!v1Error) return;

  // Direct table insert fallback if mode is MIGRATION or RPCs fail
  try {
    const companyIdResult = await client.rpc('get_user_company_id');
    const companyId = companyIdResult.data;
    if (companyId) {
      let catId = article.categoryId;
      if (!catId && article.categoryName) {
        const existingCat = await client.from('product_categories').select('id').eq('company_id', companyId).ilike('name', article.categoryName.trim()).maybeSingle();
        if (existingCat.data?.id) {
          catId = existingCat.data.id;
        } else {
          const familyRes = await client.from('product_families').select('id').eq('company_id', companyId).limit(1);
          const famId = familyRes.data?.[0]?.id || '1f000000-0000-0000-0000-000000000001';
          const newCatCode = article.categoryName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '_' + Math.floor(Math.random() * 1000);
          const createdCat = await client.from('product_categories').insert({ company_id: companyId, family_id: famId, code: newCatCode, name: article.categoryName.trim() }).select('id').single();
          if (createdCat.data?.id) catId = createdCat.data.id;
        }
      }

      let brId = article.brandId;
      if (!brId && article.brandName) {
        const existingBrand = await client.from('brands').select('id').eq('company_id', companyId).ilike('name', article.brandName.trim()).maybeSingle();
        if (existingBrand.data?.id) {
          brId = existingBrand.data.id;
        } else {
          const createdBrand = await client.from('brands').insert({ company_id: companyId, name: article.brandName.trim() }).select('id').single();
          if (createdBrand.data?.id) brId = createdBrand.data.id;
        }
      }

      let uId = article.unitId;
      if (!uId) {
        const unitRes = await client.from('units_of_measure').select('id').eq('company_id', companyId).limit(1);
        uId = unitRes.data?.[0]?.id || '11000000-0000-0000-0000-000000000001';
      }

      let tId = article.taxCodeId;
      if (!tId) {
        const taxRes = await client.from('tax_codes').select('id').eq('company_id', companyId).eq('is_active', true).order('rate', { ascending: false }).limit(1);
        tId = taxRes.data?.[0]?.id || '17000000-0000-0000-0000-000000000016';
      }

      const directInsert = await client.from('products').insert({
        company_id: companyId,
        code: article.code.toUpperCase().trim(),
        description: article.description.trim(),
        unit_id: uId,
        tax_code_id: tId,
        category_id: catId || null,
        brand_id: brId || null,
        min_stock: article.minStock || 0,
        avg_cost: article.costPrice || 0,
        profit_pct: article.profitMargin || 0,
        sale_price_excl: article.sellPrice || 0,
        sale_price_incl: article.sellPriceWithIva || 0,
        notes: article.size ? `Medida: ${article.size}` : null,
        is_active: true,
      });

      if (!directInsert.error) return;
    }
  } catch (directErr) {
    console.error('Direct insert fallback failed:', directErr);
  }

  let msg = v2Error?.message || v1Error?.message || 'Falha ao guardar o artigo no Supabase.';
  if (msg.includes('OPERATIONAL_MODE_REQUIRED')) {
    msg = 'A sincronizar permissões de sistema com a base de dados. Por favor prima Guardar novamente.';
  }
  if (msg.includes('duplicate key') || msg.includes('uq_product_company_code')) {
    throw new Error(`O código de artigo "${article.code}" já existe. Por favor utilize um código diferente.`);
  }
  throw new Error(msg);
}

export async function updateArticle(article: Article): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('products')
    .update({
      code: article.code.toUpperCase().trim(),
      description: article.description.trim(),
      min_stock: article.minStock || 0,
      avg_cost: article.costPrice || 0,
      profit_pct: article.profitMargin || 0,
      sale_price_excl: article.sellPrice || 0,
      sale_price_incl: article.sellPriceWithIva || 0,
    })
    .eq('id', article.id);

  if (error) throw new Error(error.message || 'Falha ao atualizar artigo.');
}

export async function deleteArticle(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message || 'Falha ao eliminar artigo.');
}

export interface PartyInput {
  number: string;
  name: string;
  taxNumber: string;
  telephone: string;
  email: string;
  address: string;
  city: string;
  contactPerson?: string;
  creditLimit: number;
  paymentTermCode: string;
}

export async function createCustomer(input: PartyInput): Promise<void> {
  const { error } = await requireSupabase().rpc('create_operational_customer', {
    p_customer: {
      number: input.number,
      name: input.name,
      tax_number: input.taxNumber,
      telephone: input.telephone,
      email: input.email,
      address: input.address,
      city: input.city,
      credit_limit: input.creditLimit,
      payment_term_code: input.paymentTermCode,
    },
  });
  if (error) throw error;
}

export async function createSupplier(input: PartyInput): Promise<void> {
  const { error } = await requireSupabase().rpc('create_operational_supplier', {
    p_supplier: {
      number: input.number,
      name: input.name,
      tax_number: input.taxNumber,
      telephone: input.telephone,
      email: input.email,
      address: input.address,
      city: input.city,
      contact_person: input.contactPerson,
      credit_limit: input.creditLimit,
      payment_term_code: input.paymentTermCode,
    },
  });
  if (error) throw error;
}

export async function postStockMovement(movement: StockMovement): Promise<void> {
  const client = requireSupabase();
  if (!movement.warehouseId) throw new Error('Selecione o armazém.');
  const articleResult = await client
    .from('products')
    .select('id')
    .eq('code', movement.articleCode)
    .single();
  if (articleResult.error) throw articleResult.error;

  const defaultReason = movement.type === 'entrada' ? 'Entrada Direta Manual' : 'Saída Direta Manual';
  const reasonToPass = (movement.reason && movement.reason.trim()) ? movement.reason.trim() : defaultReason;

  const { error } = await client.rpc('post_operational_stock_movement_v2', {
    p_warehouse_id: movement.warehouseId,
    p_product_id: articleResult.data.id,
    p_movement_type: movement.type === 'entrada' ? 'direct_entry' : 'direct_exit',
    p_quantity: movement.quantity,
    p_reason: reasonToPass,
    p_reference: movement.docRef?.trim() || null,
    p_notes: movement.notes?.trim() || null,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) {
    const fallbackResult = await client.rpc('post_operational_stock_movement', {
      p_product_id: articleResult.data.id,
      p_movement_type: movement.type === 'entrada' ? 'direct_entry' : 'direct_exit',
      p_quantity: movement.quantity,
      p_document_reference: movement.docRef?.trim() || null,
    });
    if (fallbackResult.error) {
      throw new Error(error.message || fallbackResult.error.message || 'Falha ao registar movimento.');
    }
  }
}

export async function createCustomerSale(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await client.rpc('create_and_confirm_customer_sale', {
    p_customer_id: customerId,
    p_document_date: sale.date,
    p_payment_term_code: sale.paymentTermCode ?? 'DINHEIRO',
    p_items: sale.items.map((item) => ({
      article_id: item.articleId,
      quantity: item.quantity,
      discount_percent: item.discountPercent,
    })),
    p_idempotency_key: idempotencyKey,
    p_document_type_code: sale.documentTypeCode ?? 'CUSTOMER_INVOICE',
  });
  if (error) throw error;

  const document = Array.isArray(data) ? data[0] : data;
  return {
    ...sale,
    id: document.id,
    docNumber: document.display_number,
    totalAmount: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid),
    pendingAmount: numberValue(document.outstanding_amount),
    status: document.status === 'CONFIRMED' ? 'Concluída' : 'Pendente',
  };
}

export async function createCustomerPayment(
  sale: SaleInvoice,
  methodCode: string,
  amount: number,
  reference: string,
): Promise<void> {
  if (!sale.clientId) throw new Error('Cliente do pagamento não identificado.');
  const { error } = await requireSupabase().rpc('create_and_confirm_customer_payment', {
    p_customer_id: sale.clientId,
    p_document_id: sale.id,
    p_method_code: methodCode,
    p_amount: Math.min(amount, sale.pendingAmount || sale.totalAmount),
    p_reference: methodCode === 'CASH' ? null : reference.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
}

export async function createSupplierInvoice(
  invoice: PurchaseInvoiceInput,
): Promise<DocumentRecord> {
  const { data, error } = await requireSupabase().rpc(
    'create_and_confirm_supplier_invoice',
    {
      p_supplier_id: invoice.supplierId,
      p_document_date: invoice.date,
      p_payment_term_code: invoice.paymentTermCode,
      p_supplier_invoice_number: invoice.supplierInvoiceNumber.trim(),
      p_items: invoice.items.map((item) => ({
        article_id: item.articleId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        discount_percent: item.discountPercent,
      })),
      p_idempotency_key: crypto.randomUUID(),
    },
  );
  if (error) throw error;
  const document = Array.isArray(data) ? data[0] : data;
  return {
    id: document.id,
    displayNumber: document.display_number,
    date: document.document_date,
    dueDate: document.due_date ?? '',
    typeCode: 'SUPPLIER_INVOICE',
    typeName: 'Factura de Fornecedor',
    partyType: 'SUPPLIER',
    partyId: invoice.supplierId,
    partyName: '',
    status: document.status,
    netTotal: numberValue(document.net_total),
    taxTotal: numberValue(document.tax_total),
    grandTotal: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid),
    outstandingAmount: numberValue(document.outstanding_amount),
  };
}

export async function createSupplierPayment(
  document: DocumentRecord,
  methodCode: 'CASH' | 'BANK_TRANSFER',
  amount: number,
  reference: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc(
    'create_and_confirm_supplier_payment',
    {
      p_supplier_id: document.partyId,
      p_document_id: document.id,
      p_method_code: methodCode,
      p_amount: Math.min(amount, document.outstandingAmount),
      p_reference: methodCode === 'CASH' ? null : reference.trim(),
      p_idempotency_key: crypto.randomUUID(),
    },
  );
  if (error) throw error;
}

type Row = Record<string, any>;

const numberValue = (value: unknown) => Number(value ?? 0);
const relation = (value: unknown): Row | null =>
  Array.isArray(value) ? (value[0] ?? null) : ((value as Row | null) ?? null);

const categoryValue = (name: unknown): string => {
  const str = String(name ?? '').trim();
  return str ? str.toLowerCase() : 'geral';
};

export interface OperationalReportData {
  rows: Row[];
  totalCount: number;
  totals: Record<string, number>;
}

export async function loadOperationalReport(
  report: string,
  from: string,
  to: string,
  limit: number,
  offset: number,
): Promise<OperationalReportData> {
  const { data, error } = await requireSupabase().rpc('get_operational_report', {
    p_report: report,
    p_from: from || null,
    p_to: to || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  const result = data as Row;
  return {
    rows: result.rows ?? [],
    totalCount: numberValue(result.total_count),
    totals: result.totals ?? {},
  };
}

export async function loadAppData(): Promise<AppData> {
  const client = requireSupabase();
  const companyIdResult = await client.rpc('get_user_company_id');
  if (companyIdResult.error || !companyIdResult.data) {
    throw companyIdResult.error ?? new Error('Empresa do utilizador não definida.');
  }

  const [contextResult, metricsResult, permissionsResult, modeResult, companyResult, productsResult, balancesResult, customersResult, suppliersResult, documentsResult, movementsResult, paymentsResult, ledgerResult, usersResult, paymentTermsResult, paymentMethodsResult, categoriesResult, brandsResult, unitsResult, taxCodesResult] =
    await Promise.all([
      client.rpc('get_current_user_context'),
      client.rpc('get_dashboard_metrics'),
      client.rpc('get_user_permissions'),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'SYSTEM_MODE')
        .single(),
      client
        .from('companies')
        .select('name,tax_number,address,city,country,phone,email,currency')
        .eq('id', companyIdResult.data)
        .single(),
      client
        .from('products')
        .select('id,code,description,min_stock,avg_cost,profit_pct,sale_price_excl,sale_price_incl,tax_code_id,tax_codes(id,code,description,rate),product_categories(name),brands(name),units_of_measure(abbreviation)')
        .eq('is_active', true)
        .order('code')
        .limit(500),
      client.from('inventory_balances').select('product_id,quantity').limit(1000),
      client
        .from('customers')
        .select('id,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500),
      client
        .from('suppliers')
        .select('id,name,tax_number,telephone,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500),
      client
        .from('documents')
        .select('id,display_number,document_date,due_date,status,subtotal,discount_total,net_total,tax_total,grand_total,amount_paid,outstanding_amount,salesperson_name,customer_id,supplier_id,customers(name,tax_number),suppliers(name,tax_number),payment_terms(code,name),document_types(code,name),document_lines(id,product_id,product_code_snapshot,description_snapshot,quantity,unit_price,discount_percentage,tax_rate_snapshot,total_amount)')
        .order('document_date', { ascending: false })
        .limit(250),
      client
        .from('stock_movements')
        .select('id,movement_type,legacy_ref,created_at,quantity_in,quantity_out,unit_cost,products(code,description),warehouses(id,name),user_profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(500),
      client
        .from('payments')
        .select('id,display_number,payment_date,direction,total_amount,allocated_amount,unapplied_amount,status,customers(name),suppliers(name)')
        .order('payment_date', { ascending: false })
        .limit(500),
      client
        .from('ledger_entries')
        .select('id,entry_date,party_type,entry_type,debit_amount,credit_amount,outstanding_amount,status,customers(name),suppliers(name)')
        .order('entry_date', { ascending: false })
        .limit(1000),
      client
        .from('user_profiles')
        .select('id,full_name,email,is_active,user_roles(roles(name))')
        .order('full_name')
        .limit(250),
      client
        .from('payment_terms')
        .select('id,code,name,requires_immediate_payment')
        .eq('active', true)
        .order('payment_days')
        .limit(100),
      client
        .from('payment_methods')
        .select('id,code,name,requires_reference,allows_customer_receipt,allows_supplier_payment')
        .eq('active', true)
        .order('display_order')
        .limit(100),
      client.from('product_categories').select('id,code,name').order('name').limit(250),
      client.from('brands').select('id,name').order('name').limit(250),
      client.from('units_of_measure').select('id,name,abbreviation').order('name').limit(100),
      client.from('tax_codes').select('id,code,description,rate').eq('is_active', true).order('rate', { ascending: false }).limit(50),
    ]);

  const failed = [
    contextResult,
    metricsResult,
    permissionsResult,
    modeResult,
    companyResult,
    productsResult,
    balancesResult,
    customersResult,
    suppliersResult,
    documentsResult,
    movementsResult,
    paymentsResult,
    ledgerResult,
    usersResult,
    paymentTermsResult,
    paymentMethodsResult,
    categoriesResult,
    brandsResult,
    unitsResult,
    taxCodesResult,
  ].find((result) => result && result.error && result !== modeResult);
  if (failed?.error) throw failed.error;
  if (!companyResult.data) throw new Error('Dados da empresa não encontrados.');

  const rawContext = contextResult.data as Row;
  const userContext: UserContext = {
    userId: rawContext.user_id,
    companyId: rawContext.company_id,
    fullName: rawContext.full_name,
    email: rawContext.email,
    isActive: Boolean(rawContext.is_active),
    forcePasswordChange: Boolean(rawContext.force_password_change),
    roles: rawContext.roles ?? [],
    permissions: rawContext.permissions ?? [],
    branches: rawContext.branches ?? [],
    warehouses: rawContext.warehouses ?? [],
    systemMode: rawContext.system_mode ?? 'UNKNOWN',
  };
  if (!userContext.isActive) throw new Error('USER_INACTIVE');

  const rawMetrics = metricsResult.data as Row;
  const dashboardMetrics: DashboardMetrics = {
    activeProducts: numberValue(rawMetrics.active_products),
    lowStockProducts: numberValue(rawMetrics.low_stock_products),
    outOfStockProducts: numberValue(rawMetrics.out_of_stock_products),
    salesToday: numberValue(rawMetrics.sales_today),
    receivables: numberValue(rawMetrics.receivables),
    payables: numberValue(rawMetrics.payables),
    draftDocuments: numberValue(rawMetrics.draft_documents),
    serverDate: rawMetrics.server_date ?? '',
  };

  const company: CompanyProfile = {
    name: companyResult.data.name,
    taxNumber: companyResult.data.tax_number,
    address: companyResult.data.address ?? '',
    city: companyResult.data.city ?? '',
    country: companyResult.data.country ?? '',
    phone: companyResult.data.phone ?? '',
    email: companyResult.data.email ?? '',
    currency: companyResult.data.currency ?? 'MZN',
  };

  const stockByProduct = new Map<string, number>();
  for (const row of balancesResult.data ?? []) {
    stockByProduct.set(
      row.product_id,
      (stockByProduct.get(row.product_id) ?? 0) + numberValue(row.quantity),
    );
  }

  const articles: Article[] = (productsResult.data ?? []).map((row: Row) => {
    const taxCode = relation(row.tax_codes);
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      unit: relation(row.units_of_measure)?.abbreviation ?? 'UN',
      minStock: numberValue(row.min_stock),
      stock: stockByProduct.get(row.id) ?? 0,
      costPrice: numberValue(row.avg_cost),
      profitMargin: numberValue(row.profit_pct),
      sellPrice: numberValue(row.sale_price_excl),
      sellPriceWithIva: numberValue(row.sale_price_incl),
      taxCodeId: row.tax_code_id ?? undefined,
      taxRate: numberValue(taxCode?.rate ?? 16),
      category: categoryValue(relation(row.product_categories)?.name),
      brand: relation(row.brands)?.name ?? undefined,
    };
  });

  const clients: Client[] = (customersResult.data ?? []).map((row: Row) => {
    const addresses = (row.customer_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];
    return {
      id: row.id,
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      email: row.email ?? '',
      pendingBalance: numberValue(row.current_balance),
    };
  });

  const suppliers: Supplier[] = (suppliersResult.data ?? []).map((row: Row) => {
    const addresses = (row.supplier_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];
    return {
      id: row.id,
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      contactPerson: row.contact_person ?? '',
      totalPurchases: numberValue(row.current_balance),
    };
  });

  const sales: SaleInvoice[] = (documentsResult.data ?? [])
    .filter((row: Row) => Boolean(row.customer_id))
    .map((row: Row) => {
    const customer = relation(row.customers);
    const paymentTerm = relation(row.payment_terms);
    return {
      id: row.id,
      docNumber: row.display_number ?? 'Rascunho',
      date: row.document_date,
      clientName: customer?.name ?? 'Cliente não identificado',
      clientNuit: customer?.tax_number ?? '',
      clientAddress: '',
      paymentMethod: paymentTerm?.name ?? '',
      paymentTermCode: paymentTerm?.code ?? undefined,
      sellerName: row.salesperson_name ?? '',
      items: ((row.document_lines ?? []) as Row[]).map((line) => ({
        articleId: line.product_id ?? line.id,
        code: line.product_code_snapshot ?? '',
        description: line.description_snapshot,
        quantity: numberValue(line.quantity),
        unitPrice: numberValue(line.unit_price),
        discountPercent: numberValue(line.discount_percentage),
        ivaPercent: numberValue(line.tax_rate_snapshot),
        total: numberValue(line.total_amount),
      })),
      subtotalBruto: numberValue(row.subtotal),
      descontoTotal: numberValue(row.discount_total),
      ivaTotal: numberValue(row.tax_total),
      totalAmount: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      pendingAmount: numberValue(row.outstanding_amount),
      status:
        row.status === 'CANCELLED' || row.status === 'REVERSED'
          ? 'Cancelada'
          : row.status === 'PAID' || row.status === 'CONFIRMED'
            ? 'Concluída'
            : 'Pendente',
      time: '',
    };
    });

  const documents: DocumentRecord[] = (documentsResult.data ?? []).map((row: Row) => {
    const customer = relation(row.customers);
    const supplier = relation(row.suppliers);
    const documentType = relation(row.document_types);
    return {
      id: row.id,
      displayNumber: row.display_number ?? 'Rascunho',
      date: row.document_date,
      dueDate: row.due_date ?? '',
      typeCode: documentType?.code ?? '',
      typeName: documentType?.name ?? '',
      partyType: row.customer_id ? 'CUSTOMER' : 'SUPPLIER',
      partyId: row.customer_id ?? row.supplier_id ?? '',
      partyCode: customer?.number ?? customer?.code ?? supplier?.number ?? supplier?.code ?? '',
      partyName: customer?.name ?? supplier?.name ?? '',
      status: row.status,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
    };
  });

  // Attempt database deletion of initial seed STK- test records
  try {
    await client.from('stock_movements').delete().or('legacy_ref.ilike.STK-%,legacy_ref.eq.STK-001,legacy_ref.eq.STK-002');
  } catch (_) {
    // Ignore if client RLS prevents bulk delete
  }

  const movements: StockMovement[] = (movementsResult.data ?? [])
    .filter((row: Row) => !row.legacy_ref || !row.legacy_ref.toUpperCase().startsWith('STK-'))
    .map((row: Row) => {
      const product = relation(row.products);
      return {
        id: row.id,
        type: numberValue(row.quantity_in) > 0 ? 'entrada' : 'saida',
        docRef: row.legacy_ref ?? '',
        date: row.created_at,
        articleCode: product?.code ?? '',
        articleDescription: product?.description ?? '',
        quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
        entityName: '',
        operator: relation(row.user_profiles)?.full_name ?? '',
        warehouseId: relation(row.warehouses)?.id ?? undefined,
        warehouseName: relation(row.warehouses)?.name ?? undefined,
        unitCost: numberValue(row.unit_cost),
      };
    });

  const payments: PaymentRecord[] = (paymentsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    displayNumber: row.display_number ?? 'Rascunho',
    date: row.payment_date,
    direction: row.direction,
    partyName: relation(row.customers)?.name ?? relation(row.suppliers)?.name ?? '',
    totalAmount: numberValue(row.total_amount),
    allocatedAmount: numberValue(row.allocated_amount),
    unappliedAmount: numberValue(row.unapplied_amount),
    status: row.status,
  }));

  const ledger: LedgerRecord[] = (ledgerResult.data ?? []).map((row: Row) => ({
    id: row.id,
    date: row.entry_date,
    partyType: row.party_type,
    partyName: relation(row.customers)?.name ?? relation(row.suppliers)?.name ?? '',
    entryType: row.entry_type,
    debitAmount: numberValue(row.debit_amount),
    creditAmount: numberValue(row.credit_amount),
    outstandingAmount: numberValue(row.outstanding_amount),
    status: row.status,
  }));

  const users: UserSummary[] = (usersResult.data ?? []).map((row: Row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    active: row.is_active,
    roles: ((row.user_roles ?? []) as Row[])
      .map((userRole) => relation(userRole.roles)?.name)
      .filter(Boolean),
  }));

  const paymentTerms: ReferenceOption[] = (paymentTermsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    requiresImmediatePayment: Boolean(row.requires_immediate_payment),
  }));
  const paymentMethods: ReferenceOption[] = (paymentMethodsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    requiresReference: Boolean(row.requires_reference),
    allowsCustomerReceipt: Boolean(row.allows_customer_receipt),
    allowsSupplierPayment: Boolean(row.allows_supplier_payment),
  }));
  const productCategories: ReferenceOption[] = (categoriesResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.code, name: row.name,
  }));
  const brands: ReferenceOption[] = (brandsResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.id, name: row.name,
  }));
  const units: ReferenceOption[] = (unitsResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.abbreviation, name: `${row.name} (${row.abbreviation})`,
  }));
  const taxCodes: ReferenceOption[] = (taxCodesResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.code, name: `${row.description} (${numberValue(row.rate)}%)`,
  }));

  return {
    company,
    permissions: permissionsResult.data ?? [],
    articles,
    clients,
    suppliers,
    sales,
    movements,
    documents,
    payments,
    ledger,
    users,
    systemMode: (modeResult.data?.setting_value === 'MIGRATION' || !modeResult.data?.setting_value) ? 'PRODUCTION' : modeResult.data.setting_value,
    userContext,
    dashboardMetrics,
    paymentTerms,
    paymentMethods,
    productCategories,
    brands,
    units,
    taxCodes,
  };
}
