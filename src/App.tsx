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
  UserContext,
  DashboardMetrics,
  ReferenceOption,
} from './types';
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

const emptyCompany: CompanyProfile = {
  name: 'Casa de Pneus', taxNumber: '', address: '', city: '',
  country: '', phone: '', email: '', currency: 'MZN',
};
const pathToTab = () => {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return !path || path === 'login' ? 'dashboard' : path;
};
const tabAccess: Record<string, string[]> = {
  dashboard: ['dashboard.read', 'products.view'],
  inventory: ['products.read', 'products.view', 'stock.read', 'stock.view'],
  sales: ['sales.create'],
  purchases: ['purchases.read', 'purchases.invoice.create'],
  movements: ['stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit'],
  entities: ['customers.read', 'customers.view', 'suppliers.read', 'suppliers.view'],
  documents: ['documents.view', 'sales.read', 'purchases.read'],
  accounts: ['payments.read', 'payments.view', 'accounts.read'],
  reports: ['reports.read', 'reports.sales', 'reports.stock'],
  administration: ['settings.manage', 'users.manage'],
};

function App() {
  const [activeTab, setActiveTab] = useState<string>(pathToTab);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [clients, setClients] = useState<import('./types').Client[]>([]);
  const [suppliers, setSuppliers] = useState<import('./types').Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerRecord[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [systemMode, setSystemMode] = useState('MIGRATION');
  const [paymentTerms, setPaymentTerms] = useState<ReferenceOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ReferenceOption[]>([]);
  const [productCategories, setProductCategories] = useState<ReferenceOption[]>([]);
  const [brands, setBrands] = useState<ReferenceOption[]>([]);
  const [units, setUnits] = useState<ReferenceOption[]>([]);

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
    if (!session) return;
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
      setUserContext(data.userContext);
      setDashboardMetrics(data.dashboardMetrics);
      setPaymentTerms(data.paymentTerms);
      setPaymentMethods(data.paymentMethods);
      setProductCategories(data.productCategories);
      setBrands(data.brands);
      setUnits(data.units);
    } catch (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
      if (message.includes('USER_INACTIVE')) {
        await supabase?.auth.signOut();
        setDataError('Esta conta está desativada. Contacte o administrador.');
      } else {
        setDataError(message || 'Falha ao carregar dados.');
      }
    } finally {
      setDataLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) {
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

  useEffect(() => {
    const onPopState = () => setActiveTab(pathToTab());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!userContext || activeTab === 'unauthorized') return;
    const required = tabAccess[activeTab];
    if (!required || !required.some((code) => permissions.includes(code))) {
      void supabase?.rpc('record_access_denied', {
        p_route: window.location.pathname,
        p_reason: `Missing permission for ${activeTab}`,
      });
      setActiveTab('unauthorized');
    }
  }, [activeTab, permissions, userContext]);

  // Handlers
  const handleAddArticle = async (article: Omit<Article, 'id'>) => {
    try {
      await createArticle(article);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao guardar artigo.');
      throw error;
    }
  };

  const handleCompleteSale = async (sale: SaleInvoice): Promise<SaleInvoice> => {
    if (!sale.clientId) throw new Error('Cliente da venda não identificado.');

    const savedSale = await createCustomerSale(sale, sale.clientId);
    await refreshData();
    if (savedSale.paymentMethodCode) {
      setPaymentSale(savedSale);
      setPaymentModalAmount(savedSale.totalAmount);
      setPaymentModalClient(savedSale.clientName);
      setPaymentModalOpen(true);
    }
    return savedSale;
  };

  const handleAddMovement = async (mov: StockMovement) => {
    try {
      await postStockMovement(mov);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao registar movimento.');
      throw error;
    }
  };

  const handleConfirmPayment = async (
    methodCode: string,
    paidAmount: number,
    reference: string,
  ) => {
    if (!paymentSale) throw new Error('Fatura do pagamento não identificada.');

    await createCustomerPayment(paymentSale, methodCode, paidAmount, reference);
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
    if (type === 'customer') await createCustomer(input);
    else await createSupplier(input);
    await refreshData();
  };

  const handleCreateSupplierInvoice = async (invoice: import('./types').PurchaseInvoiceInput) => {
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
    await createSupplierPayment(document, method, amount, reference);
    await refreshData();
  };

  const handleUpdateUser = async (user: UserSummary, active: boolean) => {
    try {
      const { error } = await supabase!.rpc('admin_update_user_profile', {
        p_user_id: user.id,
        p_full_name: user.fullName,
        p_is_active: active,
      });
      if (error) throw new Error(error.message);
      await refreshData();
    } catch (cause) {
      setDataError(cause instanceof Error ? cause.message : 'Falha ao atualizar utilizador.');
    }
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
            metrics={dashboardMetrics}
            permissions={permissions}
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
            operatorName={userContext?.fullName ?? ''}
            paymentTerms={paymentTerms}
            paymentMethods={paymentMethods}
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
            paymentTerms={paymentTerms}
          />
        );
      case 'movements':
        return (
          <StockMovements
            movements={movements}
            articles={articles}
            onAddMovement={handleAddMovement}
            canPostEntry={permissions.includes('stock.direct_entry') || permissions.includes('stock.entry.confirm')}
            canPostExit={permissions.includes('stock.direct_exit') || permissions.includes('stock.exit.confirm')}
            warehouses={userContext?.warehouses ?? []}
            operatorName={userContext?.fullName ?? ''}
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
            onUpdateUser={handleUpdateUser}
          />
        );
      case 'stitch':
        return <StitchConnection />;
      case 'unauthorized':
        return <section role="alert" className="mx-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-black">Acesso não autorizado</h1><p className="mt-2 text-sm">O seu perfil não permite abrir esta área. A tentativa foi registada para auditoria.</p><button className="mt-5 rounded bg-primary px-4 py-2 font-bold text-white" onClick={() => { setActiveTab('dashboard'); window.history.replaceState({}, '', '/'); }}>Voltar ao início</button></section>;
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
        userLabel={userContext?.fullName || session?.user.email || 'Utilizador'}
        roleLabel={userContext?.roles.map((role) => role.name).join(', ')}
        companyName={company.name}
        systemMode={systemMode}
        warehouseLabel={userContext?.warehouses.map((warehouse) => warehouse.name).join(', ')}
        onSignOut={() => { void supabase?.auth.signOut(); }}
        permissions={permissions}
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
        categories={productCategories}
        brands={brands}
        units={units}
      />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={paymentModalAmount}
        clientName={paymentModalClient}
        onConfirmPayment={handleConfirmPayment}
        paymentMethods={paymentMethods.filter((method) => method.allowsCustomerReceipt)}
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
        paymentTerms={paymentTerms}
      />
    </>
  );

  return (
    <AuthGate
      session={session}
      checking={checkingSession}
      userContext={userContext}
      onPasswordChanged={refreshData}
    >
      {application}
    </AuthGate>
  );
}

export default App;
