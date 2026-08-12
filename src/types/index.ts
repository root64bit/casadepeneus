export interface Article {
  id: string;
  code: string;
  description: string;
  unit: string;
  minStock: number;
  stock: number;
  costPrice: number;
  profitMargin: number; // e.g., 25 for 25%
  sellPrice: number;
  sellPriceWithIva: number;
  taxCodeId?: string;
  taxRate: number; // e.g., 16 for 16%, 0 for exempt
  category: string;
  brand?: string;
  size?: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  unitId?: string;
}

export interface SaleItem {
  documentLineId?: string;
  articleId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount?: number;
  ivaPercent: number;
  total: number;
  lineType?: 'STOCK' | 'SERVICE' | 'MANUAL';
  stockEffectEnabled?: boolean;
}

export interface SaleInvoice {
  id: string;
  clientId?: string;
  docNumber: string;
  date: string;
  clientName: string;
  clientNuit: string;
  clientAddress: string;
  paymentMethod: string;
  paymentTermCode?: string;
  paymentMethodCode?: string;
  documentTypeCode?: string;
  sellerName: string;
  operatorName?: string;
  items: SaleItem[];
  subtotalBruto: number;
  descontoTotal: number;
  generalDiscountAmount?: number;
  subtotalLiquido?: number;
  ivaTotal: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'Concluída' | 'Pendente' | 'Cancelada';
  time?: string;
  notes?: string;
  clientPhone?: string;
  bankAccountBci?: string;
  bankNibBci?: string;
  bankAccountBim?: string;
  bankNibBim?: string;
  validityDays?: string;
  keepAsWalkIn?: boolean;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  productId?: string;
  type: 'entrada' | 'saida';
  docRef: string;
  sourceDocumentId?: string;
  docTypeCode?: string;
  docTypeName?: string;
  date: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  entityName: string; // Fornecedor ou Cliente
  operator: string;
  warehouseId?: string;
  warehouseName?: string;
  reason?: string;
  notes?: string;
  unitCost?: number;
  sellPriceWithIva?: number; // When provided on stock entry, auto-updates product sell price
  quantityIn?: number;
  quantityOut?: number;
  balanceAfter?: number;
}

export interface AccessScope {
  id: string;
  code: string;
  name: string;
}

export interface RoleSummary {
  code: string;
  name: string;
}

export interface UserContext {
  userId: string;
  companyId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  roles: RoleSummary[];
  permissions: string[];
  branches: AccessScope[];
  warehouses: AccessScope[];
  systemMode: string;
}

export interface DashboardMetrics {
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  salesToday: number;
  receivables: number;
  debtorCount?: number;
  payables: number;
  draftDocuments: number;
  serverDate: string;
}

export interface ReferenceOption {
  id: string;
  code: string;
  name: string;
  requiresImmediatePayment?: boolean;
  requiresReference?: boolean;
  allowsCustomerReceipt?: boolean;
  allowsSupplierPayment?: boolean;
}

export interface Client {
  id: string;
  code?: string;
  number?: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  email: string;
  pendingBalance: number;
  active?: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  number: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  totalPurchases: number;
  pendingBalance: number;
  active?: boolean;
}

export interface BankAccount {
  bankName: string;
  account: string;
  nib: string;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  taxNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
  bankBciAccount?: string;
  bankBciNib?: string;
  bankBimAccount?: string;
  bankBimNib?: string;
  bankAccounts?: BankAccount[];
  quotationValidityDays?: string;
  quotationDefaultNotes?: string;
}

export interface DocumentRecord {
  id: string;
  displayNumber: string;
  date: string;
  dueDate: string;
  typeCode: string;
  typeName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyId: string;
  partyCode?: string;
  partyName: string;
  status: string;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  salespersonName?: string;
  notes?: string;
  sourceDocumentId?: string;
  createdAt?: string;
  items?: SaleItem[];
}

export interface PaymentRecord {
  id: string;
  displayNumber: string;
  date: string;
  direction: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT';
  partyName: string;
  totalAmount: number;
  allocatedAmount: number;
  unappliedAmount: number;
  status: string;
  reference?: string;
  description?: string;
}

export interface LedgerRecord {
  id: string;
  date: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyName: string;
  entryType: string;
  debitAmount: number;
  creditAmount: number;
  outstandingAmount: number;
  status: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  roles: string[];
  bundles?: string[];
  permissions?: string[];
  telephone?: string;
}

export interface PurchaseItem {
  articleId: string;
  code: string;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  taxPercent: number;
  total: number;
}

export interface PurchaseInvoiceInput {
  supplierId: string;
  date: string;
  supplierInvoiceNumber: string;
  paymentTermCode: string;
  items: PurchaseItem[];
}
