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
import { bundleCodesFromRoleCodes } from './responsibilityBundles';

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
  const cleanCode = article.code.toUpperCase().trim();
  const { error } = await client.rpc('create_operational_product_v2', {
    p_product: {
      code: cleanCode,
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

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_product')) {
    throw new Error(`O código de artigo "${cleanCode}" já existe.`);
  }
  throw new Error(error.message || 'Falha ao guardar artigo.');
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
      category_id: article.categoryId || null,
      brand_id: article.brandId || null,
      unit_id: article.unitId,
      tax_code_id: article.taxCodeId,
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

  if (error) throw new Error(error.message || 'Falha ao desativar artigo.');
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
  const client = requireSupabase();
  const cleanNumber = input.number.toUpperCase().trim();
  const cleanName = input.name.trim();

  // Try RPC first
  const { error } = await client.rpc('create_operational_customer', {
    p_customer: {
      number: cleanNumber,
      name: cleanName,
      tax_number: input.taxNumber || null,
      telephone: input.telephone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      credit_limit: input.creditLimit || 0,
      payment_term_code: input.paymentTermCode || 'DINHEIRO',
    },
  });

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_customer')) {
    throw new Error(`O código de cliente "${input.number}" já existe. Por favor utilize um código diferente.`);
  }
  throw new Error(error.message || 'Falha ao guardar cliente.');
}

export async function createSupplier(input: PartyInput): Promise<void> {
  const client = requireSupabase();
  const cleanNumber = input.number.toUpperCase().trim();
  const cleanName = input.name.trim();

  // Try RPC first
  const { error } = await client.rpc('create_operational_supplier', {
    p_supplier: {
      number: cleanNumber,
      name: cleanName,
      tax_number: input.taxNumber || null,
      telephone: input.telephone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      contact_person: input.contactPerson || null,
      credit_limit: input.creditLimit || 0,
      payment_term_code: input.paymentTermCode || 'DINHEIRO',
    },
  });

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_supplier')) {
    throw new Error(`O código de fornecedor "${input.number}" já existe. Por favor utilize um código diferente.`);
  }
  throw new Error(error.message || 'Falha ao guardar fornecedor.');
}

export async function postStockMovement(movement: StockMovement): Promise<void> {
  const client = requireSupabase();
  if (!movement.warehouseId) throw new Error('Selecione o armazém.');
  const articleResult = await client
    .from('products')
    .select('id,avg_cost')
    .eq('code', movement.articleCode)
    .maybeSingle();
  if (articleResult.error || !articleResult.data?.id) throw new Error('Artigo não encontrado.');

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

  if (!error) return;
  throw new Error(error.message || 'Falha ao registar movimento de stock.');
}

export async function createCustomerSale(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
  if (!isUuid) throw new Error('Cliente da venda inválido. Atualize a lista e tente novamente.');

  const { data, error } = await client.rpc('create_and_confirm_customer_sale', {
    p_customer_id: customerId,
    p_document_date: sale.date,
    p_payment_term_code: sale.paymentTermCode ?? 'DINHEIRO',
    p_items: sale.items.map((item) => ({
      article_id: item.articleId,
      quantity: item.quantity,
      discount_percent: item.discountPercent || 0,
    })),
    p_idempotency_key: idempotencyKey,
    p_document_type_code: sale.documentTypeCode ?? 'CUSTOMER_INVOICE',
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar a venda.');
  if (!data) throw new Error('A venda não devolveu um documento confirmado.');

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
    p_amount: Math.min(amount, sale.pendingAmount ?? sale.totalAmount),
    p_reference: methodCode === 'CASH' ? null : reference.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
}

export async function createSupplierInvoice(
  invoice: PurchaseInvoiceInput,
): Promise<DocumentRecord> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();

  // 1. Try RPC first
  const { data, error } = await client.rpc(
    'create_and_confirm_supplier_invoice',
    {
      p_supplier_id: invoice.supplierId,
      p_document_date: invoice.date,
      p_payment_term_code: invoice.paymentTermCode || 'DINHEIRO',
      p_supplier_invoice_number: invoice.supplierInvoiceNumber.trim(),
      p_items: invoice.items.map((item) => ({
        article_id: item.articleId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        discount_percent: item.discountPercent || 0,
      })),
      p_idempotency_key: idempotencyKey,
    },
  );

  if (!error && data) {
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

  const msg = error?.message || 'Falha ao confirmar a compra.';
  throw new Error(msg);
}

export async function createSupplierPayment(
  document: DocumentRecord,
  methodCode: 'CASH' | 'BANK_TRANSFER',
  amount: number,
  reference: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc(
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

  if (error) throw new Error(error.message || 'Falha ao registar pagamento do fornecedor.');
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

  const [contextResult, metricsResult, permissionsResult, modeResult, companyResult, productsResult, balancesResult, customersResult, suppliersResult, documentsResult, movementsResult, paymentsResult, ledgerResult, usersResult, paymentTermsResult, paymentMethodsResult, categoriesResult, brandsResult, unitsResult, taxCodesResult, supplierPurchasesRpcResult] =
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
        .select('id,code,description,min_stock,avg_cost,profit_pct,sale_price_excl,sale_price_incl,tax_code_id,tax_codes(id,code,description,rate),product_categories(id,name),brands(id,name),units_of_measure(id,abbreviation)')
        .eq('is_active', true)
        .order('code')
        .limit(500),
      client.from('inventory_balances').select('product_id,quantity').limit(1000),
      client
        .from('customers')
        .select('id,customer_number,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500),
      client
        .from('suppliers')
        .select('id,supplier_number,name,tax_number,telephone,email,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500),
      client
        .from('documents')
        .select('id,display_number,document_date,due_date,status,subtotal,discount_total,net_total,tax_total,grand_total,amount_paid,outstanding_amount,salesperson_name,customer_id,supplier_id,customers(customer_number,name,tax_number),suppliers(supplier_number,name,tax_number),payment_terms(code,name),document_types(code,name),document_lines(id,product_id,product_code_snapshot,description_snapshot,quantity,unit_price,discount_percentage,tax_rate_snapshot,total_amount)')
        .order('document_date', { ascending: false })
        .limit(250),
      client
        .from('stock_movements')
        .select('id,movement_type,legacy_ref,source_document_id,created_at,quantity_in,quantity_out,unit_cost,products(code,description),warehouses(id,name),user_profiles(full_name)')
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
        .select('id,full_name,email,phone,is_active,user_roles(roles(code,name))')
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
      client.rpc('get_supplier_total_purchases_summary'),
    ]);

  const criticalFailed = [
    contextResult,
    metricsResult,
    permissionsResult,
    companyResult,
    productsResult,
  ].find((result) => result && result.error);
  if (criticalFailed?.error) throw criticalFailed.error;
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
    const category = relation(row.product_categories);
    const brand = relation(row.brands);
    const unit = relation(row.units_of_measure);
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      unit: unit?.abbreviation ?? 'UN',
      minStock: numberValue(row.min_stock),
      stock: stockByProduct.get(row.id) ?? 0,
      costPrice: numberValue(row.avg_cost),
      profitMargin: numberValue(row.profit_pct),
      sellPrice: numberValue(row.sale_price_excl),
      sellPriceWithIva: numberValue(row.sale_price_incl),
      taxCodeId: row.tax_code_id ?? undefined,
      taxRate: numberValue(taxCode?.rate ?? 16),
      category: categoryValue(category?.name),
      brand: brand?.name ?? undefined,
      categoryId: category?.id ?? undefined,
      brandId: brand?.id ?? undefined,
      unitId: unit?.id ?? undefined,
    };
  });

  const clients: Client[] = (customersResult.data ?? []).map((row: Row) => {
    const addresses = (row.customer_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];
    return {
      id: row.id,
      number: row.customer_number,
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      email: row.email ?? '',
      pendingBalance: numberValue(row.current_balance),
    };
  });

  const rpcSupplierTotals = (supplierPurchasesRpcResult?.data as Row[]) ?? [];

  const suppliers: Supplier[] = (suppliersResult.data ?? []).map((row: Row) => {
    const addresses = (row.supplier_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];

    const rpcTotalRow = rpcSupplierTotals.find((r) => r.supplier_id === row.id);
    const totalPurchasesCalc = rpcTotalRow ? numberValue(rpcTotalRow.total_purchases) : 0;

    return {
      id: row.id,
      code: row.supplier_number ?? '',
      number: row.supplier_number ?? '',
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      email: row.email ?? '',
      contactPerson: row.contact_person ?? '',
      totalPurchases: totalPurchasesCalc,
      pendingBalance: numberValue(row.current_balance),
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
      clientAddress: clients.find((client) => client.id === row.customer_id)?.address ?? '',
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
      partyCode: customer?.customer_number ?? supplier?.supplier_number ?? '',
      partyName: customer?.name ?? supplier?.name ?? '',
      status: row.status,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
    };
  });

  const rawMovements = ((movementsResult?.data as Row[]) ?? []).map((row: Row) => {
    // Filter out initial legacy test movements STK-001, STK-002
    if (row.legacy_ref === 'STK-001' || row.legacy_ref === 'STK-002') return null;

    const product = relation(row.products) || articles.find((p: Article) => p.id === row.product_id);
    if (!product || !product.code) return null;

    const matchedDoc = documents.find((d) => d.id === row.source_document_id);
    const isEntrada = numberValue(row.quantity_in) > 0;
    const computedRef = matchedDoc?.displayNumber 
      || row.legacy_ref 
      || (isEntrada ? 'Entrada Directa' : 'Saída Directa');

    const item: StockMovement = {
      id: row.id,
      type: isEntrada ? 'entrada' : 'saida',
      docRef: computedRef,
      sourceDocumentId: row.source_document_id ?? matchedDoc?.id,
      docTypeCode: matchedDoc?.typeCode,
      docTypeName: matchedDoc?.typeName,
      date: row.created_at,
      articleCode: product.code,
      articleDescription: product.description,
      quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
      entityName: '',
      operator: relation(row.user_profiles)?.full_name || 'Administrador Casa de Pneus',
      warehouseId: relation(row.warehouses)?.id ?? undefined,
      warehouseName: relation(row.warehouses)?.name ?? undefined,
      reason: isEntrada ? 'Entrada Direta Manual' : 'Saída Direta Manual',
      unitCost: numberValue(row.unit_cost),
    };
    return item;
  });

  const movements: StockMovement[] = rawMovements.filter((m): m is StockMovement => m !== null);

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

  const users: UserSummary[] = (usersResult.data ?? []).map((row: Row) => {
    const roles = ((row.user_roles ?? []) as Row[])
      .map((userRole) => relation(userRole.roles)?.code)
      .filter((code): code is string => Boolean(code));
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      active: row.is_active,
      telephone: row.phone ?? '',
      roles,
      bundles: bundleCodesFromRoleCodes(roles),
    };
  });

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

export interface StockExtractResult {
  product_id: string;
  product_code: string;
  product_description: string;
  unit: string;
  opening_balance: number;
  current_stock: number;
  avg_cost: number;
  stock_valuation: number;
  can_view_cost: boolean;
  movements: Array<{
    id: string;
    created_at: string;
    doc_ref: string;
    source_document_id?: string;
    doc_type_code: string;
    doc_type_name: string;
    movement_direction: 'ENTRADA' | 'SAÍDA';
    quantity_in: number;
    quantity_out: number;
    unit_cost: number;
    movement_value: number;
    running_balance: number;
    operator_name: string;
    reason: string;
  }>;
  totals: {
    total_in_qty: number;
    total_out_qty: number;
    total_in_val: number;
    total_out_val: number;
  };
}

export async function fetchStockMovementExtract(
  productId: string,
  from?: string,
  to?: string,
  movementType: string = 'ALL'
): Promise<StockExtractResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_stock_movement_extract', {
    p_product_id: productId,
    p_from: from || null,
    p_to: to || null,
    p_movement_type: movementType,
  });

  if (error) throw new Error(error.message || 'Falha ao carregar extracto de stock.');
  return data as StockExtractResult;
}

export async function fetchSalesOperationalReport(
  from?: string,
  to?: string,
  docType: string = 'ALL',
  paymentStatus: string = 'ALL',
  customerId?: string,
  productId?: string,
  limit: number = 1000,
  offset: number = 0
): Promise<any> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_sales_operational_report_v2', {
    p_from: from || null,
    p_to: to || null,
    p_doc_type: docType,
    p_payment_status: paymentStatus,
    p_customer_id: customerId || null,
    p_product_id: productId || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message || 'Falha ao carregar relatório de vendas.');
  return data;
}

export async function createAndConfirmFinancialAdvice(payload: {
  entityType: 'CUSTOMER' | 'SUPPLIER';
  adviceType: 'CREDIT';
  entityId: string;
  documentDate: string;
  targetDocumentId?: string;
  reason: string;
  notes: string;
  items: {
    description: string;
    net_amount: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
  }[];
}): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_and_confirm_financial_advice', {
    p_entity_type: payload.entityType,
    p_advice_type: payload.adviceType,
    p_entity_id: payload.entityId,
    p_document_date: payload.documentDate,
    p_target_document_id: payload.targetDocumentId || null,
    p_reason: payload.reason,
    p_notes: payload.notes || null,
    p_items: payload.items,
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar o aviso financeiro na base de dados.');
  return data as string;
}

export async function cancelFinancialAdvice(
  documentId: string,
  reason: string,
  idempotencyKey: string
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('cancel_financial_advice', {
    p_advice_document_id: documentId,
    p_cancellation_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message || 'Falha ao cancelar o aviso financeiro na base de dados.');
  return Boolean(data);
}
