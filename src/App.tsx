import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Layout } from './components/Layout';
import { AuthGate } from './components/AuthGate';
import { PartyModal } from './components/PartyModal';
import { NewArticleModal } from './components/NewArticleModal';
import { PaymentModal } from './components/PaymentModal';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { PrintRecordModal } from './components/PrintRecordModal';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { NewSale } from './pages/NewSale';
import { StockMovements } from './pages/StockMovements';
import { Entities } from './pages/Entities';
import { Reports } from './pages/Reports';
import { Documents } from './pages/Documents';
import { Purchases } from './pages/Purchases';
import { Accounts } from './pages/Accounts';
import { Administration } from './pages/Administration';
import { StitchConnection } from './pages/StitchConnection';
import {
  Article,
  CompanyProfile,
  DocumentRecord,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  StockMovement,
  UserSummary,
} from './types';
import {
  INITIAL_ARTICLES,
  INITIAL_SALES,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_STOCK_MOVEMENTS
} from './data/mockData';
import { supabase } from './lib/supabase';
import {
  createArticle,
  createCustomer,
  createCustomerPayment,
  createCustomerSale,
  createSupplier,
  createSupplierInvoice,
  createSupplierPayment,
  loadAppData,
  postStockMovement,
} from './lib/appData';
import type { PartyInput } from './lib/appData';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';
const demoPermissions = [
  'products.view',
  'products.view_cost',
  'products.create',
  'stock.view',
  'stock.entry.confirm',
  'stock.exit.confirm',
  'sales.create',
  'sales.confirm',
  'customers.view',
  'customers.create',
  'suppliers.view',
  'suppliers.create',
  'payments.view',
  'payments.pay_supplier',
  'payments.allocate_supplier',
  'documents.view',
  'purchases.invoice.create',
  'purchases.invoice.confirm',
  'customers.view_balance',
  'suppliers.view_balance',
  'settings.manage',
  'reports.sales',
  'reports.stock',
  'reports.receivables',
  'reports.payables',
  'reports.tax',
  'reports.export',
];
const demoCompany: CompanyProfile = {
  name: 'Casa de Pneus — Demonstração',
  taxNumber: '',
  address: '',
  city: '',
  country: 'Moçambique',
  phone: '',
  email: '',
  currency: 'MZN',
};

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(!useMockData);
  const [dataLoading, setDataLoading] = useState(!useMockData);
  const [dataError, setDataError] = useState('');
  const [articles, setArticles] = useState<Article[]>(useMockData ? INITIAL_ARTICLES : []);
  const [company, setCompany] = useState<CompanyProfile>(demoCompany);
  const [permissions, setPermissions] = useState<string[]>(
    useMockData ? demoPermissions : [],
  );
  const [sales, setSales] = useState<SaleInvoice[]>(useMockData ? INITIAL_SALES : []);
  const [clients, setClients] = useState(useMockData ? INITIAL_CLIENTS : []);
  const [suppliers, setSuppliers] = useState(useMockData ? INITIAL_SUPPLIERS : []);
  const [movements, setMovements] = useState<StockMovement[]>(
    useMockData ? INITIAL_STOCK_MOVEMENTS : [],
  );
  const [documents, setDocuments] = useState<DocumentRecord[]>(
    useMockData
      ? INITIAL_SALES.map((sale) => ({
          id: sale.id,
          displayNumber: sale.docNumber,
          date: sale.date,
          dueDate: sale.date,
          typeCode: 'CUSTOMER_INVOICE',
          typeName: 'Factura',
          partyType: 'CUSTOMER' as const,
          partyId: sale.clientId ?? '',
          partyName: sale.clientName,
          status: sale.status === 'Concluída' ? 'CONFIRMED' : 'PARTIALLY_PAID',
          netTotal: sale.subtotalBruto - sale.descontoTotal,
          taxTotal: sale.ivaTotal,
          grandTotal: sale.totalAmount,
          paidAmount: sale.paidAmount,
          outstandingAmount: sale.pendingAmount,
        }))
      : [],
  );
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerRecord[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [systemMode, setSystemMode] = useState('MIGRATION');

  // Modals
  const [isNewArticleModalOpen, setNewArticleModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalAmount, setPaymentModalAmount] = useState(0);
  const [paymentModalClient, setPaymentModalClient] = useState('');
  const [paymentSale, setPaymentSale] = useState<SaleInvoice | null>(null);
  const [isPrintModalOpen, setPrintModalOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<SaleInvoice | null>(null);
  const [printDocument, setPrintDocument] = useState<DocumentRecord | null>(null);
  const [printPayment, setPrintPayment] = useState<PaymentRecord | null>(null);
  const [partyModalType, setPartyModalType] = useState<'customer' | 'supplier' | null>(null);

  const refreshData = useCallback(async () => {
    if (useMockData || !session) return;
    setDataLoading(true);
    setDataError('');
    try {
      const data = await loadAppData();
      setCompany(data.company);
      setPermissions(data.permissions);
      setArticles(data.articles);
      setSales(data.sales);
      setClients(data.clients);
      setSuppliers(data.suppliers);
      setMovements(data.movements);
      setDocuments(data.documents);
      setPayments(data.payments);
      setLedger(data.ledger);
      setUsers(data.users);
      setSystemMode(data.systemMode);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao carregar dados.');
    } finally {
      setDataLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (useMockData || !supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Handlers
  const handleAddArticle = async (article: Omit<Article, 'id'>) => {
    if (useMockData) {
      setArticles((current) => [...current, { ...article, id: `art-${Date.now()}` }]);
      return;
    }

    try {
      await createArticle(article);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao guardar artigo.');
      throw error;
    }
  };

  const handleCompleteSale = async (sale: SaleInvoice): Promise<SaleInvoice> => {
    if (useMockData) {
      setSales((current) => [sale, ...current]);
      if (sale.paymentMethod !== 'Crédito 30 Dias') {
        setPaymentSale(sale);
        setPaymentModalAmount(sale.totalAmount);
        setPaymentModalClient(sale.clientName);
        setPaymentModalOpen(true);
      }
      return sale;
    }
    if (!sale.clientId) throw new Error('Cliente da venda não identificado.');

    const savedSale = await createCustomerSale(sale, sale.clientId);
    await refreshData();
    if (sale.paymentMethod !== 'Crédito 30 Dias') {
      setPaymentSale(savedSale);
      setPaymentModalAmount(savedSale.totalAmount);
      setPaymentModalClient(savedSale.clientName);
      setPaymentModalOpen(true);
    }
    return savedSale;
  };

  const handleAddMovement = async (mov: StockMovement) => {
    if (useMockData) {
      setMovements((current) => [mov, ...current]);
      setArticles((current) =>
        current.map((article) =>
          article.code === mov.articleCode
            ? {
                ...article,
                stock:
                  mov.type === 'entrada'
                    ? article.stock + mov.quantity
                    : Math.max(0, article.stock - mov.quantity),
              }
            : article,
        ),
      );
      return;
    }

    try {
      await postStockMovement(mov);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao registar movimento.');
      throw error;
    }
  };

  const handleConfirmPayment = async (
    method: 'Pronto Pagamento (Numerário)' | 'Transferência Bancária (M-Pesa)',
    paidAmount: number,
    reference: string,
  ) => {
    if (useMockData) {
      setPaymentModalOpen(false);
      if (paymentSale) {
        setPrintInvoice({ ...paymentSale, paidAmount, pendingAmount: 0, status: 'Concluída' });
        setPrintModalOpen(true);
      }
      setPaymentSale(null);
      return;
    }
    if (!paymentSale) throw new Error('Fatura do pagamento não identificada.');

    await createCustomerPayment(paymentSale, method, paidAmount, reference);
    await refreshData();
    setPaymentModalOpen(false);
    setPrintInvoice({ ...paymentSale, paidAmount, pendingAmount: 0, status: 'Concluída' });
    setPrintModalOpen(true);
    setPaymentSale(null);
  };

  const handleOpenPrintModal = (sale: SaleInvoice) => {
    setPrintInvoice(sale);
    setPrintModalOpen(true);
  };

  const handleSaveParty = async (
    type: 'customer' | 'supplier',
    input: PartyInput,
  ) => {
    if (useMockData) {
      if (type === 'customer') {
        setClients((current) => [
          ...current,
          {
            id: `test-customer-${Date.now()}`,
            name: input.name,
            nuit: input.taxNumber,
            address: input.address,
            phone: input.telephone,
            email: input.email,
            pendingBalance: 0,
          },
        ]);
      } else {
        setSuppliers((current) => [
          ...current,
          {
            id: `test-supplier-${Date.now()}`,
            name: input.name,
            nuit: input.taxNumber,
            address: input.address,
            phone: input.telephone,
            contactPerson: input.contactPerson ?? '',
            totalPurchases: 0,
          },
        ]);
      }
      return;
    }

    if (type === 'customer') await createCustomer(input);
    else await createSupplier(input);
    await refreshData();
  };

  const handleCreateSupplierInvoice = async (invoice: import('./types').PurchaseInvoiceInput) => {
    if (useMockData) {
      const supplier = suppliers.find((item) => item.id === invoice.supplierId);
      const net = invoice.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost * (1 - item.discountPercent / 100),
        0,
      );
      const tax = net * 0.16;
      const document: DocumentRecord = {
        id: `test-purchase-${Date.now()}`,
        displayNumber: `TEST-COMPRA-${Date.now()}`,
        date: invoice.date,
        dueDate: invoice.date,
        typeCode: 'SUPPLIER_INVOICE',
        typeName: 'Factura de Fornecedor',
        partyType: 'SUPPLIER',
        partyId: invoice.supplierId,
        partyName: supplier?.name ?? '',
        status: 'CONFIRMED',
        netTotal: net,
        taxTotal: tax,
        grandTotal: net + tax,
        paidAmount: 0,
        outstandingAmount: net + tax,
      };
      setDocuments((current) => [document, ...current]);
      return document;
    }
    const document = await createSupplierInvoice(invoice);
    await refreshData();
    return document;
  };

  const handleSupplierPayment = async (
    document: DocumentRecord,
    method: 'CASH' | 'BANK_TRANSFER',
    amount: number,
    reference: string,
  ) => {
    if (useMockData) {
      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id
            ? { ...item, status: 'PAID', paidAmount: item.grandTotal, outstandingAmount: 0 }
            : item,
        ),
      );
      return;
    }
    await createSupplierPayment(document, method, amount, reference);
    await refreshData();
  };

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar"]')?.focus();
        break;
      case 'F2':
        e.preventDefault();
        setActiveTab('sales');
        break;
      case 'F3':
        e.preventDefault();
        setActiveTab('inventory');
        break;
      case 'F4':
        e.preventDefault();
        setActiveTab('reports');
        break;
      case 'F9':
        e.preventDefault();
        window.print();
        break;
      case 'Escape':
        e.preventDefault();
        if (isNewArticleModalOpen) setNewArticleModalOpen(false);
        else if (isPaymentModalOpen) setPaymentModalOpen(false);
        else if (isPrintModalOpen) setPrintModalOpen(false);
        break;
    }
  }, [isNewArticleModalOpen, isPaymentModalOpen, isPrintModalOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTriggerShortcut = (key: string) => {
    switch (key) {
      case 'F2': setActiveTab('sales'); break;
      case 'F3': setActiveTab('inventory'); break;
      case 'F4': setActiveTab('reports'); break;
      case 'F9': window.print(); break;
    }
  };

  // Render active view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            articles={articles}
            sales={sales}
            clients={clients}
            setActiveTab={setActiveTab}
            onOpenNewArticleModal={() => setNewArticleModalOpen(true)}
          />
        );
      case 'inventory':
        return (
          <Inventory
            articles={articles}
            globalSearch={globalSearch}
            onOpenNewArticleModal={() => setNewArticleModalOpen(true)}
            setActiveTab={setActiveTab}
            canViewCost={permissions.includes('products.view_cost')}
            canCreate={permissions.includes('products.create')}
          />
        );
      case 'sales':
        return (
          <NewSale
            articles={articles}
            clients={clients}
            onCompleteSale={handleCompleteSale}
            onOpenPrintModal={handleOpenPrintModal}
            canReceivePayment={
              permissions.includes('payments.receive')
              && (
                permissions.includes('payments.allocate')
                || permissions.includes('payments.allocate_customer')
              )
            }
          />
        );
      case 'purchases':
        return (
          <Purchases
            articles={articles}
            suppliers={suppliers}
            documents={documents}
            canCreate={
              permissions.includes('purchases.invoice.create')
              && permissions.includes('purchases.invoice.confirm')
            }
            canPay={
              permissions.includes('payments.pay_supplier')
              && (
                permissions.includes('payments.allocate')
                || permissions.includes('payments.allocate_supplier')
              )
            }
            onCreateInvoice={handleCreateSupplierInvoice}
            onPayInvoice={handleSupplierPayment}
          />
        );
      case 'movements':
        return (
          <StockMovements
            movements={movements}
            articles={articles}
            onAddMovement={handleAddMovement}
            canPostEntry={permissions.includes('stock.entry.confirm')}
            canPostExit={permissions.includes('stock.exit.confirm')}
          />
        );
      case 'entities':
        return (
          <Entities
            clients={clients}
            suppliers={suppliers}
            onNewCustomer={() => setPartyModalType('customer')}
            onNewSupplier={() => setPartyModalType('supplier')}
            canCreateCustomer={permissions.includes('customers.create')}
            canCreateSupplier={permissions.includes('suppliers.create')}
          />
        );
      case 'reports':
        return (
          <Reports
            sales={sales}
            clients={clients}
            suppliers={suppliers}
            articles={articles}
            payments={payments}
            ledger={ledger}
            permissions={permissions}
          />
        );
      case 'documents':
        return (
          <Documents
            documents={documents}
            sales={sales}
            onPrint={handleOpenPrintModal}
            onPrintRecord={setPrintDocument}
          />
        );
      case 'accounts':
        return (
          <Accounts
            payments={payments}
            ledger={ledger}
            onPrintPayment={setPrintPayment}
          />
        );
      case 'administration':
        return (
          <Administration
            systemMode={systemMode}
            users={users}
            permissions={permissions}
          />
        );
      case 'stitch':
        return <StitchConnection />;
      default:
        return null;
    }
  };

  const application = (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        onTriggerShortcut={handleTriggerShortcut}
        userLabel={session?.user.email ?? (useMockData ? 'Modo demonstração' : 'Utilizador')}
        connectionLabel={useMockData ? 'Dados de demonstração' : 'Supabase produção'}
        onSignOut={
          useMockData || !supabase
            ? undefined
            : () => {
                void supabase?.auth.signOut();
              }
        }
        permissions={permissions}
        showDeveloperTools={useMockData}
      >
        {dataError && (
          <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{dataError}</span>
            <button className="font-bold underline" onClick={() => void refreshData()}>
              Tentar novamente
            </button>
          </div>
        )}
        {dataLoading ? (
          <div className="grid min-h-[50vh] place-items-center text-sm font-bold text-slate-500">
            A carregar dados operacionais…
          </div>
        ) : (
          renderActiveView()
        )}
      </Layout>

      {/* Modals */}
      <NewArticleModal
        isOpen={isNewArticleModalOpen}
        onClose={() => setNewArticleModalOpen(false)}
        onSave={handleAddArticle}
      />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={paymentModalAmount}
        clientName={paymentModalClient}
        onConfirmPayment={handleConfirmPayment}
      />
      <PrintInvoiceModal
        isOpen={isPrintModalOpen}
        onClose={() => setPrintModalOpen(false)}
        invoice={printInvoice}
        company={company}
      />
      <PrintRecordModal
        company={company}
        document={printDocument}
        payment={printPayment}
        onClose={() => {
          setPrintDocument(null);
          setPrintPayment(null);
        }}
      />
      <PartyModal
        type={partyModalType}
        onClose={() => setPartyModalType(null)}
        onSave={handleSaveParty}
      />
    </>
  );

  if (useMockData) return application;

  return (
    <AuthGate session={session} checking={checkingSession}>
      {application}
    </AuthGate>
  );
}

export default App;
