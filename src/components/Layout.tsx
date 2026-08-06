import React, { useEffect, useMemo, useState } from 'react';
import type { Article, Client, DocumentRecord } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  onTriggerShortcut?: (key: string) => void;
  userLabel?: string;
  roleLabel?: string;
  companyName?: string;
  systemMode?: string;
  warehouseLabel?: string;
  onSignOut?: () => void;
  permissions?: string[];
  articles?: Article[];
  clients?: Client[];
  documents?: DocumentRecord[];
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  globalSearch,
  setGlobalSearch,
  onTriggerShortcut,
  userLabel = 'Utilizador',
  roleLabel = '',
  companyName = 'Casa de Pneus',
  systemMode = 'MIGRATION',
  warehouseLabel = '',
  onSignOut,
  permissions = [],
  articles = [],
  clients = [],
  documents = [],
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'stock' | 'receivables'>('stock');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  }, []);

  const has = (...codes: string[]) => codes.some((code) => permissions.includes(code));

  // 1. Low stock articles notification
  const lowStockArticles = useMemo(
    () => articles.filter((art) => art.stock <= art.minStock),
    [articles],
  );

  // 2. Clients with pending receivables notification
  const pendingReceivables = useMemo(
    () => clients.filter((c) => c.pendingBalance > 0),
    [clients],
  );

  const totalNotifications = lowStockArticles.length + pendingReceivables.length;

  const navItems = useMemo(
    () =>
      [
        { id: 'dashboard', label: 'Início', icon: 'home', visible: permissions.length === 0 || has('products.view') },
        { id: 'inventory', label: 'Artigos e Stock', icon: 'inventory_2', visible: permissions.length === 0 || has('products.read', 'products.view', 'stock.read', 'stock.view') },
        { id: 'sales', label: 'Nova Venda', icon: 'sell', visible: permissions.length === 0 || has('sales.create') },
        { id: 'quotation', label: 'Cotação', icon: 'request_quote', visible: permissions.length === 0 || has('sales.create', 'sales.read') },
        { id: 'purchases', label: 'Compras', icon: 'shopping_cart', visible: permissions.length === 0 || has('purchases.read', 'purchases.invoice.create') },
        { id: 'movements', label: 'Entradas e Saídas', icon: 'swap_horiz', visible: permissions.length === 0 || has('stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit') },
        { id: 'entities', label: 'Clientes e Fornecedores', icon: 'groups', visible: permissions.length === 0 || has('settings.manage', 'products.view', 'customers.manage') },
        { id: 'documents', label: 'Documentos', icon: 'description', visible: permissions.length === 0 || has('documents.view') },
        { id: 'accounts', label: 'Pagamentos e Contas', icon: 'account_balance_wallet', visible: permissions.length === 0 || has('payments.read', 'payments.view', 'accounts.read') },
        { id: 'reports', label: 'Relatórios', icon: 'analytics', visible: permissions.length === 0 || has('reports.read', 'reports.sales', 'reports.stock') },
        { id: 'administration', label: 'Administração', icon: 'admin_panel_settings', visible: permissions.length === 0 || has('settings.manage', 'users.manage') },
      ].filter((item) => item.visible),
    [permissions],
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setShowNotifications(false);
    window.history.pushState({ tab }, '', `/${tab === 'dashboard' ? '' : tab}`);
  };

  const title = navItems.find((item) => item.id === activeTab)?.label || 'Acesso não autorizado';
  const displayMode = 'PRODUÇÃO';

  const sidebar = (
    <aside
      aria-label="Navegação principal"
      className={`fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[86vw] flex-col border-r border-slate-300 bg-slate-50 transition-transform lg:w-[240px] lg:translate-x-0 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="border-b px-5 py-5">
        <div className="flex items-center justify-between">
          <h1 className="font-black text-[#001e40]">{companyName}</h1>
          <button aria-label="Fechar menu" className="lg:hidden" onClick={() => setMenuOpen(false)}>
            ✕
          </button>
        </div>
        <p className="mt-2 inline-flex rounded bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-900">
          {displayMode}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm ${
              activeTab === item.id
                ? 'border-r-4 border-primary bg-slate-200 font-black text-primary'
                : 'font-semibold text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="space-y-3 border-t p-4 text-xs">
        <div>
          <p className="truncate font-black">{userLabel}</p>
          <p className="truncate text-slate-500">
            {roleLabel}
            {warehouseLabel ? ` · ${warehouseLabel}` : ''}
          </p>
        </div>
        <button onClick={onSignOut} className="block font-bold text-red-700">
          Terminar sessão
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {sidebar}
      {menuOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
        />
      )}
      <header className="fixed inset-x-0 top-0 z-20 flex min-h-16 items-center gap-2 border-b bg-white px-3 sm:px-5 lg:left-[240px]">
        <button
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="rounded p-2 lg:hidden"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{title}</p>
          <p className="text-[10px] font-bold text-emerald-700">{displayMode}</p>
        </div>

        {/* Global Search Input */}
        <div className="relative hidden w-full max-w-xs sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            search
          </span>
          <input
            aria-label="Pesquisa global"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Pesquisar…"
            className="w-full rounded-lg border bg-slate-50 py-1.5 pl-9 pr-3 text-xs"
          />
        </div>

        {/* User Profile Badge */}
        <button
          onClick={onSignOut}
          title="Terminar sessão"
          className="grid h-9 w-9 place-items-center rounded-full bg-[#003366] text-xs font-black text-white hover:brightness-125 shadow"
        >
          {userLabel.slice(0, 2).toUpperCase()}
        </button>
      </header>

      <main className="min-h-screen px-3 pb-6 pt-20 sm:px-5 lg:ml-[240px] lg:p-6 lg:pb-6 lg:pt-20">
        {children}
      </main>
    </div>
  );
};
