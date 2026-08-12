import type {
  Article,
  Client,
  CompanyProfile,
  DocumentRecord,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  SaleItem,
  StockMovement,
  Supplier,
  UserSummary,
  PurchaseInvoiceInput,
  UserContext,
  DashboardMetrics,
  ReferenceOption,
  BankAccount,
} from '../types';
import { requireSupabase } from './supabase';
import { bundleCodesFromRoleCodes } from './responsibilityBundles';
import { calculateDocumentLine, calculateDocumentTotals, isUuid, recalculateSaleItems } from './documentCalculations';

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

export interface DocumentUpdatePayload {
  documentDate?: string;
  clientName?: string;
  clientNuit?: string;
  clientAddress?: string;
  grandTotal?: number;
  notes?: string;
  items?: SaleItem[];
  generalDiscount?: number;
  keepAsWalkIn?: boolean;
}

export async function updateDocumentDetails(documentId: string, payload: DocumentUpdatePayload): Promise<void> {
  const client = requireSupabase();

  const lines = payload.items ? recalculateSaleItems(payload.items) : undefined;
  const { error } = await client.rpc('update_operational_document_v2', {
    p_document_id: documentId,
    p_document_date: payload.documentDate || null,
    p_client_name: payload.clientName?.trim() || null,
    p_client_nuit: payload.clientNuit !== undefined ? payload.clientNuit.trim() : null,
    p_client_address: payload.clientAddress !== undefined ? payload.clientAddress.trim() : null,
    p_grand_total: payload.grandTotal !== undefined ? Number(payload.grandTotal) : null,
    p_notes: payload.notes !== undefined ? payload.notes.trim() : null,
    p_lines: lines && lines.length > 0 ? lines : null,
    p_general_discount: Math.max(0, Number(payload.generalDiscount) || 0),
    p_keep_as_walk_in: Boolean(payload.keepAsWalkIn),
  });

  if (error) {
    console.error('❌ Error in update_operational_document RPC:', error);
    throw new Error(error.message || 'Falha ao atualizar documento.');
  }
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
    .select('id,avg_cost,tax_rate')
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

  if (error) throw new Error(error.message || 'Falha ao registar movimento de stock.');

  // Auto-update product sell price if a price with IVA was provided on stock entry
  if (movement.sellPriceWithIva && movement.sellPriceWithIva > 0 && movement.type === 'entrada') {
    const taxRate = articleResult.data.tax_rate || 16;
    const newSellPrice = Math.round((movement.sellPriceWithIva / (1 + taxRate / 100)) * 100) / 100;

    await client
      .from('products')
      .update({
        sell_price: newSellPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleResult.data.id);
  }
}

async function resolveOrRegisterCustomer(
  client: any,
  customerId: string,
  clientName?: string,
  clientNuit?: string,
  clientAddress?: string,
  keepAsWalkIn = false,
): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
  const { data, error } = await client.rpc('resolve_or_create_operational_customer_v2', {
    p_customer_id: isUuid ? customerId : null,
    p_client_name: clientName?.trim() || null,
    p_client_nuit: clientNuit?.trim() || null,
    p_client_address: clientAddress?.trim() || null,
    p_keep_as_walk_in: keepAsWalkIn,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao pesquisar ou registar o cliente.');
  }
  if (!data) {
    throw new Error('Cliente inválido. Registe pelo menos um cliente no sistema.');
  }

  return String(data);
}

export async function saveStockGuide(input: import('../types').StockGuideInput): Promise<string> {
  const client = requireSupabase();
  const params = {
    p_guide_number: input.guideNumber.trim(),
    p_document_date: input.date,
    p_warehouse_id: input.warehouseId,
    p_supplier_id: input.type === 'entrada' && input.supplierId ? input.supplierId : null,
    p_notes: input.notes?.trim() || null,
    p_items: input.items.map((item) => ({
      product_id: item.articleId,
      quantity: item.quantity,
      unit_cost: item.unitCost ?? null,
      sale_price_incl: input.type === 'entrada' ? (item.salePriceWithIva ?? null) : null,
    })),
  };
  const result = input.id
    ? await client.rpc('update_stock_guide_v2', { p_document_id: input.id, ...params })
    : await client.rpc('create_stock_guide_v2', {
        p_guide_type: input.type === 'entrada' ? 'STOCK_ENTRY_GUIDE' : 'STOCK_EXIT_GUIDE',
        p_idempotency_key: crypto.randomUUID(),
        ...params,
      });
  if (result.error) throw new Error(result.error.message || 'Falha ao guardar a guia de stock.');
  return String(result.data);
}

export async function cancelStockGuide(documentId: string, reason: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_stock_guide_v2', {
    p_document_id: documentId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message || 'Falha ao anular a guia de stock.');
}

export async function updateOperationalParty(
  type: 'customer' | 'supplier',
  partyId: string,
  input: PartyInput,
  active = true,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_update_operational_party', {
    p_party_type: type.toUpperCase(),
    p_party_id: partyId,
    p_data: {
      number: input.number.trim(),
      name: input.name.trim(),
      tax_number: input.taxNumber.trim() || null,
      telephone: input.telephone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      city: input.city.trim() || null,
      contact_person: input.contactPerson?.trim() || null,
    },
    p_active: active,
  });
  if (error) {
    if (error.message.includes('WALK_IN_CUSTOMER_CANNOT_BE_DEACTIVATED')) {
      throw new Error('O Cliente Pontual (código 1) é obrigatório e não pode ser apagado.');
    }
    if (error.message.includes('duplicate key')) {
      throw new Error(`O código "${input.number}" já está em uso.`);
    }
    throw new Error(error.message || `Falha ao actualizar ${type === 'customer' ? 'cliente' : 'fornecedor'}.`);
  }
}

export async function createCustomerSale(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();

  const targetCustomerId = await resolveOrRegisterCustomer(
    client,
    customerId,
    sale.clientName,
    sale.clientNuit,
    sale.clientAddress,
    sale.keepAsWalkIn,
  );

  const encodedNotes = `[CLIENTE: ${sale.clientName} | NUIT: ${sale.clientNuit || 'N/A'} | MORADA: ${sale.clientAddress || 'N/A'}] ${sale.notes || ''}`.trim();

  const calculated = calculateDocumentTotals(sale.items, sale.descontoTotal - sale.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const { data, error } = await client.rpc('create_and_confirm_customer_sale_v2', {
    p_customer_id: targetCustomerId,
    p_document_date: sale.date,
    p_payment_term_code: sale.paymentTermCode ?? 'DINHEIRO',
    p_items: calculated.lines.map((item) => ({
      article_id: item.articleId,
      code: item.code || 'DIV',
      description: item.description,
      quantity: item.quantity,
      unit_price_incl: item.unitPrice || 0,
      discount_amount: item.discountAmount || 0,
      tax_rate: item.ivaPercent || 16,
      line_type: item.lineType || (isUuid(item.articleId) ? 'STOCK' : 'MANUAL'),
      stock_effect_enabled: item.stockEffectEnabled ?? isUuid(item.articleId),
    })),
    p_idempotency_key: idempotencyKey,
    p_document_type_code: sale.documentTypeCode ?? 'CUSTOMER_INVOICE',
    p_notes: encodedNotes,
    p_general_discount: calculated.generalDiscount,
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar a venda.');
  if (!data) throw new Error('A venda não devolveu um documento confirmado.');

  const document = Array.isArray(data) ? data[0] : data;
  return {
    ...sale,
    clientId: targetCustomerId,
    id: document.id,
    docNumber: document.display_number,
    totalAmount: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid),
    pendingAmount: numberValue(document.outstanding_amount),
    status: ['CONFIRMED', 'PAID'].includes(document.status) ? 'Concluída' : 'Pendente',
  };

}

export async function createQuotation(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();

  const targetCustomerId = await resolveOrRegisterCustomer(
    client,
    customerId,
    sale.clientName,
    sale.clientNuit,
    sale.clientAddress,
    sale.keepAsWalkIn,
  );

  const encodedNotes = `[CLIENTE: ${sale.clientName} | NUIT: ${sale.clientNuit || 'N/A'} | MORADA: ${sale.clientAddress || 'N/A'}] ${sale.notes || ''}`.trim();
  const calculated = calculateDocumentTotals(sale.items, sale.descontoTotal - sale.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const { data, error } = await client.rpc('create_and_confirm_customer_quotation_v2', {
    p_customer_id: targetCustomerId,
    p_document_date: sale.date,
    p_items: calculated.lines.map((item) => ({
      article_id: item.articleId,
      code: item.code || 'DIV',
      description: item.description,
      quantity: item.quantity,
      unit_price_incl: item.unitPrice || 0,
      discount_amount: item.discountAmount || 0,
      tax_rate: item.ivaPercent || 16,
      line_type: item.lineType || (isUuid(item.articleId) ? 'STOCK' : 'MANUAL'),
      stock_effect_enabled: false,
    })),
    p_notes: encodedNotes,
    p_idempotency_key: crypto.randomUUID(),
    p_general_discount: calculated.generalDiscount,
  });
  if (error) throw new Error(error.message || 'Falha ao guardar cotação na base de dados.');
  if (!data) throw new Error('A cotação não devolveu um documento confirmado.');
  const insertedDoc = Array.isArray(data) ? data[0] : data;

  return {
    ...sale,
    clientId: targetCustomerId,
    id: insertedDoc.id,
    docNumber: insertedDoc.display_number,
    documentTypeCode: 'CUSTOMER_QUOTATION',
    status: 'Concluída',
    paidAmount: 0,
    subtotalBruto: numberValue(insertedDoc.subtotal),
    descontoTotal: numberValue(insertedDoc.discount_total),
    subtotalLiquido: numberValue(insertedDoc.net_total),
    ivaTotal: numberValue(insertedDoc.tax_total),
    totalAmount: numberValue(insertedDoc.grand_total),
    pendingAmount: numberValue(insertedDoc.outstanding_amount),
  };
}

export async function createCustomerPayment(
  sale: SaleInvoice | DocumentRecord,
  methodCode: string,
  amount: number,
  reference: string,
): Promise<PaymentRecord> {
  const isDocumentRecord = 'partyId' in sale;
  const customerId = isDocumentRecord ? sale.partyId : sale.clientId;
  const pendingAmount = isDocumentRecord ? sale.outstandingAmount : sale.pendingAmount;
  if (!customerId) throw new Error('Cliente do pagamento não identificado.');
  const { data, error } = await requireSupabase().rpc('create_and_confirm_customer_payment', {
    p_customer_id: customerId,
    p_document_id: sale.id,
    p_method_code: methodCode,
    p_amount: Math.min(amount, pendingAmount),
    p_reference: methodCode === 'CASH' ? null : reference.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
  const payment = Array.isArray(data) ? data[0] : data;
  return {
    id: payment.id,
    displayNumber: payment.display_number,
    date: payment.payment_date,
    direction: 'CUSTOMER_RECEIPT',
    partyName: 'clientName' in sale ? sale.clientName : sale.partyName,
    totalAmount: numberValue(payment.total_amount),
    allocatedAmount: numberValue(payment.allocated_amount),
    unappliedAmount: numberValue(payment.unapplied_amount),
    status: payment.status,
    reference: payment.external_reference ?? reference,
    description: payment.description ?? undefined,
  };
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
  methodCode: string,
  amount: number,
  reference: string,
): Promise<PaymentRecord> {
  const client = requireSupabase();
  const { data, error } = await client.rpc(
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
  const payment = Array.isArray(data) ? data[0] : data;
  return {
    id: payment.id,
    displayNumber: payment.display_number,
    date: payment.payment_date,
    direction: 'SUPPLIER_PAYMENT',
    partyName: document.partyName,
    totalAmount: numberValue(payment.total_amount),
    allocatedAmount: numberValue(payment.allocated_amount),
    unappliedAmount: numberValue(payment.unapplied_amount),
    status: payment.status,
    reference: payment.external_reference ?? reference,
    description: payment.description ?? undefined,
  };
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

export type AppDataScope = 'all' | 'core' | 'sales' | 'stock' | 'documents' | 'entities' | 'users' | 'reports' | 'after-sale';

export async function loadAppData(scope: AppDataScope = 'all'): Promise<AppData> {
  const client = requireSupabase();
  const companyIdResult = await client.rpc('get_user_company_id');
  if (companyIdResult.error || !companyIdResult.data) {
    throw companyIdResult.error ?? new Error('Empresa do utilizador não definida.');
  }

  const wants = (...scopes: AppDataScope[]) => scope === 'all' || scopes.includes(scope);
  const skipped = () => Promise.resolve({ data: [] as Row[], error: null });
  const wantsProducts = wants('sales', 'stock', 'documents', 'reports', 'after-sale');
  const wantsCustomers = wants('sales', 'stock', 'documents', 'entities', 'reports', 'after-sale');
  const wantsSuppliers = wants('stock', 'documents', 'entities', 'reports');
  const wantsDocuments = wants('sales', 'stock', 'documents', 'entities', 'reports', 'after-sale');

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
        .select('id,name,tax_number,address,city,country,phone,email,currency,bank_bci_account,bank_bci_nib,bank_bim_account,bank_bim_nib,quotation_validity_days,quotation_default_notes,bank_accounts')
        .eq('id', companyIdResult.data)
        .single(),
      wantsProducts ? client
        .from('products')
        .select('id,code,description,min_stock,avg_cost,profit_pct,sale_price_excl,sale_price_incl,tax_code_id,tax_codes(id,code,description,rate),product_categories(id,name),brands(id,name),units_of_measure(id,abbreviation)')
        .eq('is_active', true)
        .order('code')
        .limit(2000) : skipped(),
      wantsProducts ? client.from('inventory_balances').select('product_id,quantity').limit(2000) : skipped(),
      wantsCustomers ? client
        .from('customers')
        .select('id,customer_number,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(2000) : skipped(),
      wantsSuppliers ? client
        .from('suppliers')
        .select('id,supplier_number,name,tax_number,telephone,email,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500) : skipped(),
      wantsDocuments ? client.rpc('get_operational_documents_page_v2', { p_limit: 1000, p_offset: 0 }) : skipped(),
      wants('stock', 'after-sale') ? client
        .from('stock_movements')
        .select('id,movement_type,legacy_ref,source_document_id,created_at,quantity_in,quantity_out,unit_cost,products(code,description),warehouses(id,name),user_profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100) : skipped(),
      wants('documents', 'entities', 'reports') ? client
        .from('payments')
        .select('id,display_number,payment_date,direction,total_amount,allocated_amount,unapplied_amount,status,external_reference,description,customers(name),suppliers(name)')
        .order('payment_date', { ascending: false })
        .limit(2000) : skipped(),
      wants('documents', 'entities', 'reports') ? client
        .from('ledger_entries')
        .select('id,entry_date,party_type,entry_type,debit_amount,credit_amount,outstanding_amount,status,customers(name),suppliers(name)')
        .order('entry_date', { ascending: false })
        .limit(1000) : skipped(),
      wants('users') ? client
        .from('user_profiles')
        .select('id,full_name,email,phone,is_active,user_roles(roles(code,name))')
        .order('full_name')
        .limit(250) : skipped(),
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
      wantsProducts ? client.from('product_categories').select('id,code,name').order('name').limit(250) : skipped(),
      wantsProducts ? client.from('brands').select('id,name').order('name').limit(250) : skipped(),
      wantsProducts ? client.from('units_of_measure').select('id,name,abbreviation').order('name').limit(100) : skipped(),
      wantsProducts ? client.from('tax_codes').select('id,code,description,rate').eq('is_active', true).order('rate', { ascending: false }).limit(50) : skipped(),
      wantsSuppliers ? client.rpc('get_supplier_total_purchases_summary') : skipped(),
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
    debtorCount: numberValue(rawMetrics.debtor_count),
    payables: numberValue(rawMetrics.payables),
    draftDocuments: numberValue(rawMetrics.draft_documents),
    serverDate: rawMetrics.server_date ?? '',
  };

  const company: CompanyProfile = {
    id: companyResult.data.id,
    name: companyResult.data.name,
    taxNumber: companyResult.data.tax_number,
    address: companyResult.data.address ?? '',
    city: companyResult.data.city ?? '',
    country: companyResult.data.country ?? '',
    phone: companyResult.data.phone ?? '',
    email: companyResult.data.email ?? '',
    currency: companyResult.data.currency ?? 'MZN',
    bankBciAccount: companyResult.data.bank_bci_account ?? '9109 8531 0001',
    bankBciNib: companyResult.data.bank_bci_nib ?? '0008 0000 0910 9853 101 80',
    bankBimAccount: companyResult.data.bank_bim_account ?? '5579 3819',
    bankBimNib: companyResult.data.bank_bim_nib ?? '0001 0000 0005 5793 8195 7',
    bankAccounts: (companyResult.data.bank_accounts || []) as BankAccount[],
    quotationValidityDays: companyResult.data.quotation_validity_days ?? '7 dias',
    quotationDefaultNotes: companyResult.data.quotation_default_notes ?? 'Oferta de Nitrogénio e Montagem/Balanceamento Gratuito.',
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

  const sales: SaleInvoice[] = (documentsResult.data ?? []).map((row: Row) => {
    const customer = relation(row.customers);
    const paymentTerm = relation(row.payment_terms);
    const docType = relation(row.document_types);
    const isCot = row.display_number?.startsWith('COT') || row.display_number?.startsWith('CO/');
    const isGr = row.display_number?.startsWith('GR');
    const isVd = row.display_number?.startsWith('VD');
    const notesStr = (row.notes as string) ?? '';
    const notesNameMatch = notesStr.match(/\[CLIENTE:\s*([^|\]]+)/i);
    const customNameFromNotes = notesNameMatch?.[1]?.trim();
    const resolvedClientName = (customNameFromNotes && customNameFromNotes.toLowerCase() !== 'cliente pontual' && customNameFromNotes.toLowerCase() !== 'cliente final')
      ? customNameFromNotes
      : (customer?.name ?? 'Cliente Pontual');

    const notesNuitMatch = notesStr.match(/NUIT:\s*([^|\]]+)/i);
    const customNuitFromNotes = notesNuitMatch?.[1]?.trim();
    const resolvedClientNuit = (customNuitFromNotes && customNuitFromNotes !== 'N/A')
      ? customNuitFromNotes
      : (customer?.tax_number ?? '');

    const notesAddressMatch = notesStr.match(/MORADA:\s*([^|\]]+)/i);
    const customAddressFromNotes = notesAddressMatch?.[1]?.trim();
    const resolvedClientAddress = (customAddressFromNotes && customAddressFromNotes !== 'N/A')
      ? customAddressFromNotes
      : (clients.find((client) => client.id === row.customer_id)?.address ?? '');

    const docTypeCode = docType?.code || (isCot ? 'CUSTOMER_QUOTATION' : isGr ? 'CUSTOMER_DELIVERY_NOTE' : isVd ? 'CASH_SALE' : 'CUSTOMER_INVOICE');

    return {
      id: row.id,
      clientId: row.customer_id ?? undefined,
      documentTypeCode: docTypeCode,
      docNumber: row.display_number ?? 'Rascunho',
      date: row.document_date,
      clientName: resolvedClientName,
      clientNuit: resolvedClientNuit,
      clientAddress: resolvedClientAddress,
      paymentMethod: paymentTerm?.name ?? '',
      paymentTermCode: paymentTerm?.code ?? undefined,
      sellerName: row.salesperson_name ?? '',
      items: ((row.document_lines ?? []) as Row[]).map((line) => {
        const qty = numberValue(line.quantity) || 1;
        const tot = numberValue(line.total_amount);
        const discountAmount = numberValue(line.discount_amount);
        const legacyDiscountPercent = numberValue(line.discount_percentage) || 0;
        const legacyDiscountAmount = discountAmount > 0
          ? discountAmount
          : numberValue(line.unit_price) * qty * legacyDiscountPercent / 100;
        const priceWithIva = (tot > 0 && qty > 0)
          ? Math.round(((tot + legacyDiscountAmount) / qty) * 10000) / 10000
          : Math.round(numberValue(line.unit_price) * (1 + numberValue(line.tax_rate_snapshot) / 100) * 100) / 100;

        return {
          documentLineId: line.id,
          articleId: line.product_id ?? line.id,
          code: line.product_code_snapshot ?? '',
          description: line.description_snapshot,
          quantity: qty,
          unitPrice: priceWithIva,
          discountPercent: legacyDiscountPercent,
          discountAmount: Math.round(legacyDiscountAmount * 100) / 100,
          ivaPercent: numberValue(line.tax_rate_snapshot) || 16,
          total: tot > 0 ? tot : calculateDocumentLine({ quantity: qty, unitPrice: priceWithIva, discountAmount: legacyDiscountAmount, discountPercent: 0, ivaPercent: numberValue(line.tax_rate_snapshot) || 16 }).totalWithTax,
          lineType: line.product_id ? 'STOCK' : (String(line.product_code_snapshot || '').toUpperCase().startsWith('SERV') ? 'SERVICE' : 'MANUAL'),
          stockEffectEnabled: Boolean(line.stock_effect_enabled),
        };
      }),
      subtotalBruto: numberValue(row.subtotal),
      descontoTotal: numberValue(row.discount_total),
      generalDiscountAmount: numberValue(row.general_discount_amount),
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
      notes: notesStr,
      createdAt: row.created_at ?? undefined,
    };
    });

  const documents: DocumentRecord[] = (documentsResult.data ?? []).map((row: Row) => {
    const customer = relation(row.customers);
    const supplier = relation(row.suppliers);
    const documentType = relation(row.document_types);
    const isCot =
      row.display_number?.toUpperCase().startsWith('COT') ||
      row.display_number?.toUpperCase().startsWith('CO/') ||
      row.display_number?.toUpperCase().startsWith('QUO') ||
      (row.notes && (row.notes.toLowerCase().includes('cotação') || row.notes.toLowerCase().includes('cotacao')));
    const isGr = row.display_number?.toUpperCase().startsWith('GR');
    const isVd = row.display_number?.toUpperCase().startsWith('VD');
    const isFt = row.display_number?.toUpperCase().startsWith('FT') || row.display_number?.toUpperCase().startsWith('A/');

    const typeCode = documentType?.code || (isCot ? 'CUSTOMER_QUOTATION' : isGr ? 'CUSTOMER_DELIVERY_NOTE' : isVd ? 'CASH_SALE' : isFt ? 'CUSTOMER_INVOICE' : '');
    const typeName = documentType?.name || (isCot ? 'Cotação' : isGr ? 'Guia de Remessa' : isVd ? 'Venda a Dinheiro' : isFt ? 'Factura' : '');

    let partyName = customer?.name ?? supplier?.name ?? 'Cliente Pontual';
    if (!customer && !supplier && typeCode === 'STOCK_ENTRY_GUIDE') {
      partyName = 'Sem fornecedor';
    }
    if (!customer && !supplier && typeCode === 'STOCK_EXIT_GUIDE') {
      partyName = 'Saida interna de stock';
    }
    if (row.notes && row.notes.includes('[CLIENTE:')) {
      const match = row.notes.match(/\[CLIENTE:\s*([^|]+)/);
      if (match && match[1].trim() && match[1].trim() !== 'N/A') {
        partyName = match[1].trim();
      }
    }

    return {
      id: row.id,
      displayNumber: row.display_number ?? 'Rascunho',
      externalReference: row.external_reference ?? undefined,
      warehouseId: row.warehouse_id ?? undefined,
      date: row.document_date,
      dueDate: row.due_date ?? '',
      typeCode: typeCode,
      typeName: typeName,
      partyType: row.customer_id ? 'CUSTOMER' : 'SUPPLIER',
      partyId: row.customer_id ?? row.supplier_id ?? '',
      partyCode: customer?.customer_number ?? supplier?.supplier_number ?? '',
      partyName: partyName,
      status: row.status,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
      salespersonName: row.salesperson_name ?? '',
      notes: row.notes ?? '',
      sourceDocumentId: row.source_document_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      items: ((row.document_lines ?? []) as Row[]).map((line) => {
        const qty = numberValue(line.quantity) || 1;
        const lineTotal = numberValue(line.total_amount);
        const discountAmount = numberValue(line.discount_amount);
        const unitPriceWithTax = qty > 0
          ? Math.round(((lineTotal + discountAmount) / qty) * 10000) / 10000
          : numberValue(line.unit_price);
        return {
          documentLineId: line.id,
          articleId: line.product_id ?? line.id,
          code: line.product_code_snapshot ?? 'DIV',
          description: line.description_snapshot,
          quantity: qty,
          unitPrice: unitPriceWithTax,
          discountPercent: numberValue(line.discount_percentage),
          discountAmount,
          ivaPercent: numberValue(line.tax_rate_snapshot),
          total: lineTotal,
          lineType: line.product_id ? 'STOCK' : 'MANUAL',
          stockEffectEnabled: Boolean(line.stock_effect_enabled),
        } as SaleItem;
      }),
      stockGuideItems: (typeCode === 'STOCK_ENTRY_GUIDE' || typeCode === 'STOCK_EXIT_GUIDE') ? ((row.document_lines ?? []) as Row[]).map((line) => ({
        documentLineId: line.id,
        articleId: line.product_id ?? line.id,
        articleCode: line.product_code_snapshot ?? '',
        articleDescription: line.description_snapshot ?? '',
        quantity: numberValue(line.quantity),
        unitCost: line.cost_was_provided ? numberValue(line.unit_cost_snapshot) : undefined,
        salePriceWithIva: line.sale_price_incl == null ? undefined : numberValue(line.sale_price_incl),
        currentStock: articles.find((article) => article.id === line.product_id)?.stock ?? 0,
        totalCost: numberValue(line.total_amount),
      })) : undefined,
    };
  });

  const rawMovements = ((movementsResult?.data as Row[]) ?? []).map((row: Row) => {
    // Filter out initial legacy test movements STK-001, STK-002
    if (row.legacy_ref === 'STK-001' || row.legacy_ref === 'STK-002') return null;

    const product = relation(row.products) || articles.find((p: Article) => p.id === row.product_id);
    if (!product || !product.code) return null;

    const matchedDoc = documents.find((d) => d.id === row.source_document_id);
    const isEntrada = numberValue(row.quantity_in) > 0;
    const isOpeningOrMigration = row.movement_type === 'opening_stock' || (row.legacy_ref && (row.legacy_ref.includes('Migração') || row.legacy_ref.includes('Pos.zip') || row.legacy_ref.startsWith('STK-')));

    const computedRef = matchedDoc
      ? `${matchedDoc.typeName} ${matchedDoc.displayNumber}`
      : isOpeningOrMigration
        ? (isEntrada ? 'Entrada Inicial (Migração POS)' : 'Saída Inicial (Migração POS)')
        : row.legacy_ref || (isEntrada ? 'Entrada Directa por Guia' : 'Saída Directa por Guia');

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

  const baseMovements: StockMovement[] = rawMovements.filter((m): m is StockMovement => m !== null);

  // Synthesize stock exit movements from customer sales & delivery notes
  const saleExitMovements: StockMovement[] = [];
  sales.forEach((s) => {
    if (s.documentTypeCode === 'CUSTOMER_QUOTATION' || s.status === 'Cancelada') return;
    s.items.forEach((item, idx) => {
      if (!item.code || item.quantity <= 0) return;
      const docName = s.documentTypeCode === 'CASH_SALE' ? 'Venda a Dinheiro' : s.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura';
      saleExitMovements.push({
        id: `sale-mov-${s.id}-${idx}`,
        type: 'saida',
        docRef: `${docName} ${s.docNumber}`,
        sourceDocumentId: s.id,
        docTypeCode: s.documentTypeCode,
        docTypeName: docName,
        date: s.date,
        articleCode: item.code,
        articleDescription: item.description,
        quantity: item.quantity,
        entityName: s.clientName,
        operator: s.sellerName || 'Operador de Caixa',
        reason: 'Venda / Emissão de Documento',
        unitCost: item.unitPrice,
      });
    });
  });

  const movements: StockMovement[] = [...baseMovements, ...saleExitMovements];

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
    reference: row.external_reference ?? undefined,
    description: row.description ?? undefined,
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
  reconciliation_opening?: number;
  movement_count: number;
  limit: number;
  offset: number;
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
  movementType: string = 'ALL',
  limit: number = 100,
  offset: number = 0,
): Promise<StockExtractResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_stock_movement_extract_v2', {
    p_product_id: productId,
    p_from: from || null,
    p_to: to || null,
    p_movement_type: movementType,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message || 'Falha ao carregar extracto de stock.');
  return data as StockExtractResult;
}

export interface StockMovementsPageResult {
  rows: StockMovement[];
  totalCount: number;
  totalStock: number;
}

export async function fetchStockMovementsPage(
  from: string,
  to: string,
  movementType: 'ALL' | 'entrada' | 'saida',
  search: string,
  limit: number,
  offset: number,
): Promise<StockMovementsPageResult> {
  const { data, error } = await requireSupabase().rpc('get_stock_movements_page_v2', {
    p_from: from || null,
    p_to: to || null,
    p_movement_type: movementType === 'entrada' ? 'ENTRADA' : movementType === 'saida' ? 'SAIDA' : 'ALL',
    p_search: search.trim() || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message || 'Falha ao carregar histórico de movimentos.');
  const result = data as Row;
  return {
    totalCount: numberValue(result.total_count),
    totalStock: numberValue(result.total_stock),
    rows: ((result.rows ?? []) as Row[]).map((row) => ({
      id: row.id,
      productId: row.product_id,
      type: row.movement_direction === 'ENTRADA' ? 'entrada' : 'saida',
      docRef: row.doc_ref ?? '',
      sourceDocumentId: row.source_document_id ?? undefined,
      docTypeCode: row.doc_type_code ?? undefined,
      docTypeName: row.doc_type_name ?? undefined,
      date: row.created_at,
      articleCode: row.product_code,
      articleDescription: row.product_description,
      quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
      quantityIn: numberValue(row.quantity_in),
      quantityOut: numberValue(row.quantity_out),
      balanceAfter: numberValue(row.balance_after),
      entityName: '',
      operator: row.operator_name ?? 'Sistema',
      warehouseId: row.warehouse_id ?? undefined,
      warehouseName: row.warehouse_name ?? undefined,
      reason: row.reason ?? '',
      unitCost: numberValue(row.unit_cost),
    })),
  };
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
  targetDocumentId: string;
  reason: string;
  notes: string;
  returnStock: boolean;
  items: {
    source_line_id: string;
    quantity: number;
  }[];
}): Promise<DocumentRecord> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_and_confirm_credit_note_v2', {
    p_entity_type: payload.entityType,
    p_entity_id: payload.entityId,
    p_source_document_id: payload.targetDocumentId,
    p_document_date: payload.documentDate,
    p_reason: payload.reason,
    p_notes: payload.notes || null,
    p_items: payload.items,
    p_return_stock: payload.returnStock,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar a nota de crédito na base de dados.');
  const document = Array.isArray(data) ? data[0] : data;
  return {
    id: document.id, displayNumber: document.display_number, date: document.document_date,
    dueDate: document.due_date ?? '', typeCode: payload.entityType === 'CUSTOMER' ? 'CUSTOMER_CREDIT_NOTE' : 'SUPPLIER_CREDIT_ADVICE',
    typeName: payload.entityType === 'CUSTOMER' ? 'Nota de Crédito a Cliente' : 'Nota de Crédito de Fornecedor',
    partyType: payload.entityType, partyId: payload.entityId, partyName: '', status: document.status,
    netTotal: numberValue(document.net_total), taxTotal: numberValue(document.tax_total), grandTotal: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid), outstandingAmount: numberValue(document.outstanding_amount),
    notes: document.notes ?? '', sourceDocumentId: document.source_document_id ?? payload.targetDocumentId,
  };
}

export async function cancelFinancialAdvice(
  documentId: string,
  reason: string,
  idempotencyKey: string
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('cancel_credit_note_v2', {
    p_document_id: documentId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message || 'Falha ao cancelar a nota de crédito na base de dados.');
  return Boolean(data);
}

export async function cancelOperationalDocument(
  documentId: string,
  reason: string,
  idempotencyKey: string
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_cancel_operational_document_v2', {
    p_document_id: documentId,
    p_reason: reason.trim(),
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message || 'Falha ao anular o documento na base de dados.');
  return Boolean(data);
}

export async function saveCompanyQuotationSettings(companyId: string, settings: {
  bankBciAccount: string;
  bankBciNib: string;
  bankBimAccount: string;
  bankBimNib: string;
  bankAccounts?: BankAccount[];
  quotationValidityDays: string;
  quotationDefaultNotes: string;
}): Promise<void> {
  const client = requireSupabase();
  const targetId = companyId || 'a0000000-0000-0000-0000-000000000001';
  const { error } = await client.from('companies').update({
    bank_bci_account: settings.bankBciAccount,
    bank_bci_nib: settings.bankBciNib,
    bank_bim_account: settings.bankBimAccount,
    bank_bim_nib: settings.bankBimNib,
    bank_accounts: settings.bankAccounts,
    quotation_validity_days: settings.quotationValidityDays,
    quotation_default_notes: settings.quotationDefaultNotes,
  }).eq('id', targetId);

  if (error) throw new Error(error.message || 'Falha ao salvar as configurações de cotação.');
}
