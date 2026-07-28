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
}

export async function createArticle(article: Omit<Article, 'id'>): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('create_operational_product', {
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
  if (error) throw error;
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
  const articleResult = await client
    .from('products')
    .select('id')
    .eq('code', movement.articleCode)
    .single();
  if (articleResult.error) throw articleResult.error;

  const { error } = await client.rpc('post_operational_stock_movement', {
    p_product_id: articleResult.data.id,
    p_movement_type: movement.type === 'entrada' ? 'direct_entry' : 'direct_exit',
    p_quantity: movement.quantity,
    p_document_reference: movement.docRef || null,
  });
  if (error) throw error;
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
    p_payment_term_code:
      sale.paymentMethod === 'Crédito 30 Dias' ? '30_DIAS' : 'DINHEIRO',
    p_items: sale.items.map((item) => ({
      article_id: item.articleId,
      quantity: item.quantity,
      discount_percent: item.discountPercent,
    })),
    p_idempotency_key: idempotencyKey,
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
  method: SaleInvoice['paymentMethod'],
  amount: number,
  reference: string,
): Promise<void> {
  if (!sale.clientId) throw new Error('Cliente do pagamento não identificado.');
  const methodCode =
    method === 'Pronto Pagamento (Numerário)' ? 'CASH' : 'MPESA';
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

const categoryValue = (name: unknown): Article['category'] => {
  const normalized = String(name ?? '').toLowerCase();
  if (normalized.includes('câmara')) return 'camaras';
  if (normalized.includes('servi')) return 'servicos';
  if (normalized.includes('acess')) return 'acessorios';
  return 'pneus';
};

export async function loadAppData(): Promise<AppData> {
  const client = requireSupabase();
  const companyIdResult = await client.rpc('get_user_company_id');
  if (companyIdResult.error || !companyIdResult.data) {
    throw companyIdResult.error ?? new Error('Empresa do utilizador não definida.');
  }

  const [permissionsResult, modeResult, companyResult, productsResult, balancesResult, customersResult, suppliersResult, documentsResult, movementsResult, paymentsResult, ledgerResult, usersResult] =
    await Promise.all([
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
        .select('id,code,description,min_stock,avg_cost,profit_pct,sale_price_excl,sale_price_incl,product_categories(name),brands(name),units_of_measure(abbreviation)')
        .eq('is_active', true)
        .order('code'),
      client.from('inventory_balances').select('product_id,quantity'),
      client
        .from('customers')
        .select('id,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name'),
      client
        .from('suppliers')
        .select('id,name,tax_number,telephone,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name'),
      client
        .from('documents')
        .select('id,display_number,document_date,due_date,status,subtotal,discount_total,net_total,tax_total,grand_total,amount_paid,outstanding_amount,salesperson_name,customer_id,supplier_id,customers(name,tax_number),suppliers(name,tax_number),document_types(code,name),document_lines(id,product_id,product_code_snapshot,description_snapshot,quantity,unit_price,discount_percentage,tax_rate_snapshot,total_amount)')
        .order('document_date', { ascending: false })
        .limit(250),
      client
        .from('stock_movements')
        .select('id,movement_type,legacy_ref,created_at,quantity_in,quantity_out,products(code,description),customers(name),suppliers(name),user_profiles(full_name)')
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
        .order('full_name'),
    ]);

  const failed = [
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
  ].find((result) => result.error);
  if (failed?.error) throw failed.error;
  if (!companyResult.data) throw new Error('Dados da empresa não encontrados.');

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

  const articles: Article[] = (productsResult.data ?? []).map((row: Row) => ({
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
    category: categoryValue(relation(row.product_categories)?.name),
    brand: relation(row.brands)?.name ?? undefined,
  }));

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
    return {
      id: row.id,
      docNumber: row.display_number ?? 'Rascunho',
      date: row.document_date,
      clientName: customer?.name ?? 'Cliente não identificado',
      clientNuit: customer?.tax_number ?? '',
      clientAddress: '',
      paymentMethod: 'Crédito 30 Dias',
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
      partyName: customer?.name ?? supplier?.name ?? '',
      status: row.status,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
    };
  });

  const movements: StockMovement[] = (movementsResult.data ?? []).map((row: Row) => {
    const product = relation(row.products);
    return {
      id: row.id,
      type: numberValue(row.quantity_in) > 0 ? 'entrada' : 'saida',
      docRef: row.legacy_ref ?? '',
      date: row.created_at,
      articleCode: product?.code ?? '',
      articleDescription: product?.description ?? '',
      quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
      entityName: relation(row.customers)?.name ?? relation(row.suppliers)?.name ?? '',
      operator: relation(row.user_profiles)?.full_name ?? '',
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
    systemMode: modeResult.data?.setting_value ?? 'UNKNOWN',
  };
}
