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
        { id: 'dashboard', label: 'Início', icon: 'home', visible: has('dashboard.read', 'products.view') },
        { id: 'inventory', label: 'Artigos e Stock', icon: 'inventory_2', visible: has('products.read', 'products.view', 'stock.read', 'stock.view') },
        { id: 'sales', label: 'Nova Venda', icon: 'sell', visible: has('sales.create') && has('sales.confirm') },
        { id: 'purchases', label: 'Compras', icon: 'shopping_cart', visible: has('purchases.read', 'purchases.invoice.create') },
        { id: 'movements', label: 'Entradas e Saídas', icon: 'swap_horiz', visible: has('stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit') },
        { id: 'entities', label: 'Clientes e Fornecedores', icon: 'groups', visible: has('customers.read', 'customers.view', 'suppliers.read', 'suppliers.view') },
        { id: 'documents', label: 'Documentos', icon: 'description', visible: has('documents.view', 'sales.read', 'purchases.read') },
        { id: 'accounts', label: 'Pagamentos e Contas', icon: 'account_balance_wallet', visible: has('payments.read', 'payments.view', 'accounts.read') },
        { id: 'reports', label: 'Relatórios', icon: 'analytics', visible: has('reports.read', 'reports.sales', 'reports.stock') },
        { id: 'administration', label: 'Administração', icon: 'admin_panel_settings', visible: has('settings.manage', 'users.manage') },
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
  const displayMode = systemMode === 'MIGRATION' ? 'PRODUCTION' : systemMode;

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

        {/* Modern Notification Center Bell Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notificações do Sistema"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {totalNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-md animate-pulse">
                {totalNotifications > 99 ? '99+' : totalNotifications}
              </span>
            )}
          </button>

          {/* Premium Glassmorphic Notification Center Drawer Popover */}
          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-[#43474f] bg-white/95 dark:bg-[#1f2325]/95 p-4 shadow-2xl backdrop-blur-md font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-amber-500">notifications_active</span>
                  <h3 className="font-bold text-sm text-[#001e40] dark:text-[#a7c8ff]">
                    Central de Notificações
                  </h3>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Notification Tab Bar */}
              <div className="mt-3 flex space-x-2 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs font-bold">
                <button
                  onClick={() => setNotifTab('stock')}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded ${
                    notifTab === 'stock'
                      ? 'bg-[#003366] text-white shadow'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Stock Baixo</span>
                  {lowStockArticles.length > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white">
                      {lowStockArticles.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setNotifTab('receivables')}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded ${
                    notifTab === 'receivables'
                      ? 'bg-[#003366] text-white shadow'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Cobranças Pendentes</span>
                  {pendingReceivables.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">
                      {pendingReceivables.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab 1: Low Stock Alerts */}
              {notifTab === 'stock' && (
                <div className="mt-3 max-h-72 overflow-y-auto space-y-2 text-xs">
                  {lowStockArticles.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1">check_circle</span>
                      <p className="font-bold">Todos os níveis de stock estão normais.</p>
                    </div>
                  ) : (
                    lowStockArticles.map((art) => (
                      <div
                        key={art.id}
                        className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 transition-all hover:bg-amber-100/50"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {art.code} — {art.description}
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            Stock Actual: <b>{art.stock} UN</b> | Mínimo: <b>{art.minStock} UN</b>
                          </p>
                        </div>
                        <button
                          onClick={() => navigate('inventory')}
                          className="shrink-0 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
                        >
                          Ver
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Receivables Alerts */}
              {notifTab === 'receivables' && (
                <div className="mt-3 max-h-72 overflow-y-auto space-y-2 text-xs">
                  {pendingReceivables.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1">verified</span>
                      <p className="font-bold">Não existem saldos de clientes pendentes.</p>
                    </div>
                  ) : (
                    pendingReceivables.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-2.5 transition-all hover:bg-red-100/50"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {client.name} {client.code ? `(${client.code})` : ''}
                          </p>
                          <p className="text-[11px] text-red-600 dark:text-red-400 font-extrabold">
                            A Cobrar: {formatMZN(client.pendingBalance)}
                          </p>
                        </div>
                        <button
                          onClick={() => navigate('accounts')}
                          className="shrink-0 rounded bg-[#003366] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#001e40]"
                        >
                          Cobrar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
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

      <main className="min-h-screen px-3 pb-20 pt-20 sm:px-5 lg:ml-[240px] lg:p-6 lg:pb-20 lg:pt-20">
        {children}
      </main>

      <footer className="fixed bottom-0 left-[240px] right-0 hidden h-10 items-center gap-5 bg-[#001e40] px-6 text-xs text-white lg:flex font-mono">
        {has('sales.create') && (
          <button onClick={() => { navigate('sales'); onTriggerShortcut?.('F2'); }}>
            <b>F2</b> Nova venda
          </button>
        )}
        <button onClick={() => navigate('inventory')}>
          <b>F3</b> Artigos
        </button>
        <button onClick={() => navigate('reports')}>
          <b>F4</b> Relatórios
        </button>
        <span className="ml-auto truncate">
          {companyName} · {displayMode}
        </span>
      </footer>
    </div>
  );
};
