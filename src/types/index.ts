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
  category: 'pneus' | 'camaras' | 'servicos' | 'acessorios';
  brand?: string;
  size?: string;
}

export interface SaleItem {
  articleId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  ivaPercent: number;
  total: number;
}

export interface SaleInvoice {
  id: string;
  clientId?: string;
  docNumber: string;
  date: string;
  clientName: string;
  clientNuit: string;
  clientAddress: string;
  paymentMethod: 'Pronto Pagamento (Numerário)' | 'Transferência Bancária (M-Pesa)' | 'Crédito 30 Dias';
  sellerName: string;
  items: SaleItem[];
  subtotalBruto: number;
  descontoTotal: number;
  ivaTotal: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'Concluída' | 'Pendente' | 'Cancelada';
  time: string;
}

export interface StockMovement {
  id: string;
  type: 'entrada' | 'saida';
  docRef: string;
  date: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  entityName: string; // Fornecedor ou Cliente
  operator: string;
}

export interface Client {
  id: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  email: string;
  pendingBalance: number;
}

export interface Supplier {
  id: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  contactPerson: string;
  totalPurchases: number;
}

export interface CompanyProfile {
  name: string;
  taxNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
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
  partyName: string;
  status: string;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
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
  paymentTermCode: 'DINHEIRO' | '30_DIAS';
  items: PurchaseItem[];
}
