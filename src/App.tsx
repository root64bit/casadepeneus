import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
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
import { Quotation } from './pages/Quotation';
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
  updateArticle,
  deleteArticle,
  createCustomer,
  createCustomerPayment,
  createCustomerSale,
  createQuotation,
  createSupplier,
  createSupplierInvoice,
  createSupplierPayment,
  loadAppData,
  postStockMovement,
  createAndConfirmFinancialAdvice,
  cancelFinancialAdvice,
  saveCompanyQuotationSettings,
  updateDocumentDetails,
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
  dashboard: ['products.view', 'settings.manage'],
  inventory: ['products.read', 'products.view', 'stock.read', 'stock.view'],
  sales: ['sales.create'],
  quotation: ['sales.create', 'sales.read'],
  purchases: ['purchases.read', 'purchases.invoice.create'],
  movements: ['stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit'],
  entities: ['settings.manage', 'products.view', 'customers.manage'],
  documents: ['documents.view'],
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
  const [systemMode, setSystemMode] = useState('PRODUCTION');
  const [paymentTerms, setPaymentTerms] = useState<ReferenceOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ReferenceOption[]>([]);
  const [productCategories, setProductCategories] = useState<ReferenceOption[]>([]);
  const [brands, setBrands] = useState<ReferenceOption[]>([]);
  const [units, setUnits] = useState<ReferenceOption[]>([]);
  const [taxCodes, setTaxCodes] = useState<ReferenceOption[]>([]);

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

  const initialLoadedRef = useRef(false);

  const refreshData = useCallback(async (isSilent = false) => {
    if (!session) return;
    if (!isSilent && !userContext) {
      setDataLoading(true);
    }
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
      setSystemMode(data.systemMode === 'MIGRATION' ? 'PRODUCTION' : data.systemMode);
      setUserContext(data.userContext);
      setDashboardMetrics(data.dashboardMetrics);
      setPaymentTerms(data.paymentTerms);
      setPaymentMethods(data.paymentMethods);
      setProductCategories(data.productCategories);
      setBrands(data.brands);
      setUnits(data.units);
      setTaxCodes(data.taxCodes);
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
  }, [session, userContext]);

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
      setSession((prevSession) => {
        if (prevSession?.user?.id === nextSession?.user?.id && prevSession?.access_token === nextSession?.access_token) {
          return prevSession;
        }
        return nextSession;
      });
      setCheckingSession(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      void refreshData(false);
    } else {
      void refreshData(true);
    }
  }, [session]);

  useEffect(() => {
    const onPopState = () => setActiveTab(pathToTab());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!userContext) return;
    const isCashier = permissions.length > 0 && !permissions.includes('products.view') && !permissions.includes('settings.manage');
    if (isCashier && (activeTab === 'dashboard' || activeTab === 'unauthorized')) {
      setActiveTab('sales');
      return;
    }

    if (activeTab === 'unauthorized') return;
    const required = tabAccess[activeTab];
    if (!required || !required.some((code) => permissions.includes(code))) {
      const allowedTab = Object.keys(tabAccess).find((tab) => {
        const reqs = tabAccess[tab];
        return reqs && reqs.some((c) => permissions.includes(c));
      });

      if (allowedTab) {
        setActiveTab(allowedTab);
      } else {
        setActiveTab(isCashier ? 'sales' : 'unauthorized');
      }
    }
  }, [activeTab, permissions, userContext]);

  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null);

  // Handlers
  const handleOpenNewArticleModal = () => {
    setArticleToEdit(null);
    setNewArticleModalOpen(true);
  };

  const handleEditArticle = (art: Article) => {
    setArticleToEdit(art);
    setNewArticleModalOpen(true);
  };

  const handleAddArticle = async (article: Omit<Article, 'id'>) => {
    try {
      await createArticle(article);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao guardar artigo.');
      throw error;
    }
  };

  const handleUpdateArticle = async (updated: Article) => {
    try {
      await updateArticle(updated);
      await refreshData();
      setArticleToEdit(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao atualizar artigo.');
      throw error;
    }
  };

  const handleDeleteArticle = async (art: Article) => {
    try {
      await deleteArticle(art.id);
      await refreshData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Falha ao eliminar artigo.');
    }
  };

  const handleCompleteSale = async (sale: SaleInvoice): Promise<SaleInvoice> => {
    if (!sale.clientId) throw new Error('Cliente da venda não identificado.');

    const savedSale = await createCustomerSale(sale, sale.clientId);
    setSales((prev) => [savedSale, ...prev.filter((s) => s.id !== savedSale.id)]);
    setDocuments((prev) => [
      {
        id: savedSale.id,
        displayNumber: savedSale.docNumber,
        date: savedSale.date,
        dueDate: savedSale.date,
        typeCode: savedSale.documentTypeCode ?? 'CUSTOMER_INVOICE',
        typeName: savedSale.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : savedSale.documentTypeCode === 'CASH_SALE' ? 'Venda a Dinheiro' : 'Factura',
        partyType: 'CUSTOMER',
        partyId: sale.clientId || '',
        partyCode: '',
        partyName: savedSale.clientName || 'Cliente Pontual',
        status: 'CONFIRMED',
        netTotal: savedSale.subtotalLiquido ?? savedSale.totalAmount,
        taxTotal: savedSale.ivaTotal,
        grandTotal: savedSale.totalAmount,
        paidAmount: savedSale.paidAmount,
        outstandingAmount: savedSale.pendingAmount,
      },
      ...prev.filter((d) => d.id !== savedSale.id),
    ]);
    await refreshData();
    return savedSale;
  };

  const handleCreateQuotation = async (quotation: SaleInvoice): Promise<SaleInvoice> => {
    if (!quotation.clientId) throw new Error('Cliente da cotação não identificado.');

    const savedQuotation = await createQuotation(quotation, quotation.clientId);
    setSales((prev) => [savedQuotation, ...prev.filter((s) => s.id !== savedQuotation.id)]);
    setDocuments((prev) => [
      {
        id: savedQuotation.id,
        displayNumber: savedQuotation.docNumber,
        date: savedQuotation.date,
        dueDate: savedQuotation.date,
        typeCode: 'CUSTOMER_QUOTATION',
        typeName: 'Cotação',
        partyType: 'CUSTOMER',
        partyId: quotation.clientId || '',
        partyCode: '',
        partyName: savedQuotation.clientName || 'Cliente Pontual',
        status: 'CONFIRMED',
        netTotal: savedQuotation.subtotalLiquido ?? savedQuotation.totalAmount,
        taxTotal: savedQuotation.ivaTotal,
        grandTotal: savedQuotation.totalAmount,
        paidAmount: 0,
        outstandingAmount: savedQuotation.totalAmount,
      },
      ...prev.filter((d) => d.id !== savedQuotation.id),
    ]);
    await refreshData();
    return savedQuotation;
  };

  const handleAddMovement = async (mov: StockMovement) => {
    try {
      await postStockMovement(mov);
      const newMovementWithId: StockMovement = {
        ...mov,
        id: mov.id || crypto.randomUUID(),
        date: new Date().toISOString(),
      };
      setMovements((prev) => [newMovementWithId, ...prev]);
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

  const handleUpdateUser = async (
    user: UserSummary,
    active: boolean,
    newBundles?: string[],
    newPermissions?: string[],
    newPassword?: string
  ) => {
    try {
      if (user.id) {
        const { error } = await supabase!.rpc('admin_update_user_profile', {
          p_user_id: user.id,
          p_full_name: user.fullName,
          p_is_active: active,
        });
        if (error) throw new Error(error.message);

        if (newPassword && newPassword.length >= 6) {
          const { error: passErr } = await supabase!.rpc('admin_update_user_password_direct', {
            p_email: user.email,
            p_password: newPassword,
          });
          if (passErr) console.warn('Could not reset password via RPC:', passErr.message);
        }

        if (newBundles && newBundles.length > 0) {
          await supabase!.from('user_roles').delete().eq('user_id', user.id);
          for (const bCode of newBundles) {
            const roleRes = await supabase!.from('roles').select('id').eq('code', bCode).maybeSingle();
            if (roleRes.data?.id) {
              await supabase!.from('user_roles').insert({ user_id: user.id, role_id: roleRes.data.id });
            }
          }
        }
      }
      await refreshData();
    } catch (cause) {
      setDataError(cause instanceof Error ? cause.message : 'Falha ao atualizar utilizador.');
    }
  };

  const handleCreateUser = async (userData: {
    fullName: string;
    email: string;
    password?: string;
    bundles: string[];
    permissions: string[];
    telephone?: string;
  }) => {
    try {
      if (!userData.password || userData.password.length < 6) {
        throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const tempAuthClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: authData, error: authErr } = await tempAuthClient.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.fullName,
          },
        },
      });

      if (authErr) throw new Error(`Erro ao registar credenciais: ${authErr.message}`);
      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error('Não foi possível obter o ID de autenticação do novo utilizador.');

      const companyIdResult = await supabase!.rpc('get_user_company_id');
      const companyId = companyIdResult.data;
      if (!companyId) throw new Error('Empresa do utilizador não encontrada.');

      const username = userData.email.split('@')[0].toLowerCase();
      const primaryRole = userData.bundles && userData.bundles.length > 0 ? userData.bundles[0] : 'MANAGER_LIMITED';

      const { error: rpcErr } = await supabase!.rpc('admin_create_user_profile', {
        p_user_id: newUserId,
        p_username: username,
        p_full_name: userData.fullName,
        p_email: userData.email,
        p_phone: userData.telephone || null,
        p_role_code: primaryRole,
      });

      if (rpcErr) {
        const { error: insertErr } = await supabase!
          .from('user_profiles')
          .insert({
            id: newUserId,
            company_id: companyId,
            username: username,
            full_name: userData.fullName,
            email: userData.email,
            phone: userData.telephone || null,
            is_active: true,
          });
        if (insertErr) throw new Error(insertErr.message);
      }

      if (userData.bundles && userData.bundles.length > 0) {
        for (const bCode of userData.bundles) {
          const roleRes = await supabase!.from('roles').select('id').eq('code', bCode).maybeSingle();
          if (roleRes.data?.id) {
            await supabase!.from('user_roles').insert({ user_id: newUserId, role_id: roleRes.data.id });
          }
        }
      }

      await refreshData();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Falha ao criar utilizador.';
      setDataError(msg);
      throw new Error(msg);
    }
  };

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar"]')?.focus();
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
            movements={movements}
            sales={sales}
            documents={documents}
            globalSearch={globalSearch}
            onOpenNewArticleModal={handleOpenNewArticleModal}
            onEditArticle={handleEditArticle}
            onDeleteArticle={handleDeleteArticle}
            onOpenDocument={setPrintDocument}
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
            sales={sales}
            documents={documents}
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
            permissions={permissions}
            onUpdateDocument={async (docId, payload) => {
              await updateDocumentDetails(docId, payload);
              await refreshData(true);
            }}
          />
        );
      case 'quotation':
        return (
          <Quotation
            articles={articles}
            clients={clients}
            sales={sales}
            documents={documents}
            onCreateQuotation={handleCreateQuotation}
            onOpenPrintModal={handleOpenPrintModal}
            operatorName={userContext?.fullName ?? ''}
            onUpdateDocument={async (docId, payload) => {
              await updateDocumentDetails(docId, payload);
              await refreshData(true);
            }}
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
            documents={documents}
            onAddMovement={handleAddMovement}
            onOpenDocument={setPrintDocument}
            canPostEntry={permissions.includes('stock.direct_entry') || permissions.includes('stock.entry.confirm')}
            canPostExit={permissions.includes('stock.direct_exit') || permissions.includes('stock.exit.confirm')}
            canViewCost={permissions.includes('products.view_cost')}
            warehouses={userContext?.warehouses ?? []}
            operatorName={userContext?.fullName ?? ''}
          />
        );
      case 'entities':
        return (
          <Entities
            clients={clients}
            suppliers={suppliers}
            documents={documents}
            ledgerEntries={ledger}
            onNewCustomer={() => setPartyModalType('customer')}
            onNewSupplier={() => setPartyModalType('supplier')}
            canCreateCustomer={permissions.includes('customers.create')}
            canCreateSupplier={permissions.includes('suppliers.create')}
            onConfirmAdvice={async (payload) => {
              const docId = await createAndConfirmFinancialAdvice(payload);
              await refreshData();
              return docId;
            }}
            onPrintRecord={setPrintDocument}
          />
        );
      case 'reports':
        return (
          <Reports
            permissions={permissions}
            sales={sales}
            documents={documents}
            articles={articles}
            clients={clients}
            onPrintRecord={setPrintDocument}
            canViewCost={permissions.includes('products.view_cost')}
          />
        );
      case 'documents':
        return (
          <Documents
            documents={documents}
            sales={sales}
            articles={articles}
            onPrint={handleOpenPrintModal}
            onPrintRecord={setPrintDocument}
            permissions={permissions}
            canCancelAdvice={permissions.includes('financial_adjustments.cancel')}
            onCancelAdvice={async (docId, reason) => {
              const idempotencyKey = crypto.randomUUID();
              await cancelFinancialAdvice(docId, reason, idempotencyKey);
              await refreshData(true);
            }}
            onUpdateDocument={async (docId, payload) => {
              await updateDocumentDetails(docId, payload);
              await refreshData(true);
            }}
          />
        );
      case 'accounts':
        return (
          <Accounts
            payments={payments}
            ledger={ledger}
            clients={clients}
            documents={documents}
            onPrintPayment={setPrintPayment}
          />
        );
      case 'administration':
        return (
          <Administration
            systemMode={systemMode}
            users={users}
            permissions={permissions}
            company={company}
            onUpdateUser={handleUpdateUser}
            onCreateUser={handleCreateUser}
            onSaveCompanySettings={async (settings) => {
              const targetId = company.id || 'a0000000-0000-0000-0000-000000000001';
              await saveCompanyQuotationSettings(targetId, settings);
              await refreshData();
            }}
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
        articles={articles}
        clients={clients}
        documents={documents}
      >
        {dataError && (
          <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{dataError}</span>
            <button className="font-bold underline" onClick={() => void refreshData()}>
              Tentar novamente
            </button>
          </div>
        )}
        {dataLoading && !userContext ? (
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
        onClose={() => {
          setNewArticleModalOpen(false);
          setArticleToEdit(null);
        }}
        onSave={handleAddArticle}
        onUpdate={handleUpdateArticle}
        articleToEdit={articleToEdit}
        existingArticles={articles}
        categories={productCategories}
        brands={brands}
        units={units}
        taxCodes={taxCodes}
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
      loadError={dataError}
      onRetry={refreshData}
      onPasswordChanged={refreshData}
    >
      {application}
    </AuthGate>
  );
}

export default App;
