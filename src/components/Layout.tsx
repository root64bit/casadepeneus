import React, { useEffect, useMemo, useState } from 'react';

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
}

export const Layout: React.FC<LayoutProps> = ({
  children, activeTab, setActiveTab, globalSearch, setGlobalSearch,
  onTriggerShortcut, userLabel = 'Utilizador', roleLabel = '',
  companyName = 'Casa de Pneus', systemMode = 'MIGRATION',
  warehouseLabel = '', onSignOut, permissions = [],
}) => {
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const has = (...codes: string[]) => codes.some((code) => permissions.includes(code));

  const navItems = useMemo(() => [
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
  ].filter((item) => item.visible), [permissions]);

  useEffect(() => {
    setMenuOpen(false);
  }, [activeTab]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    window.history.pushState({ tab }, '', `/${tab === 'dashboard' ? '' : tab}`);
  };
  const title = navItems.find((item) => item.id === activeTab)?.label || 'Acesso não autorizado';

  const sidebar = (
    <aside aria-label="Navegação principal" className={`fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[86vw] flex-col border-r border-slate-300 bg-slate-50 transition-transform lg:w-[240px] lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="border-b px-5 py-5">
        <div className="flex items-center justify-between"><h1 className="font-black text-[#001e40]">{companyName}</h1><button aria-label="Fechar menu" className="lg:hidden" onClick={() => setMenuOpen(false)}>✕</button></div>
        <p className="mt-2 inline-flex rounded bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-900">{systemMode}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm ${activeTab === item.id ? 'border-r-4 border-primary bg-slate-200 font-black text-primary' : 'font-semibold text-slate-700 hover:bg-slate-100'}`}><span className="material-symbols-outlined">{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="space-y-3 border-t p-4 text-xs">
        <div><p className="truncate font-black">{userLabel}</p><p className="truncate text-slate-500">{roleLabel}{warehouseLabel ? ` · ${warehouseLabel}` : ''}</p></div>
        <button onClick={() => { setDarkMode((value) => !value); document.documentElement.classList.toggle('dark'); }} className="font-bold text-primary">{darkMode ? 'Modo claro' : 'Modo escuro'}</button>
        <button onClick={onSignOut} className="block font-bold text-red-700">Terminar sessão</button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#191c1d] dark:text-slate-100">
      {sidebar}
      {menuOpen && <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-black/45 lg:hidden" />}
      <header className="fixed inset-x-0 top-0 z-20 flex min-h-16 items-center gap-3 border-b bg-white px-3 dark:bg-[#1f2325] sm:px-5 lg:left-[240px]">
        <button aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="rounded p-2 lg:hidden"><span className="material-symbols-outlined">menu</span></button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{title}</p><p className="text-[10px] font-bold text-amber-800">{systemMode}</p></div>
        <div className="relative hidden w-full max-w-md sm:block"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span><input aria-label="Pesquisa global" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Pesquisar…" className="w-full rounded-lg border bg-slate-50 py-2 pl-10 pr-3 text-sm dark:bg-slate-800" /></div>
        <button onClick={onSignOut} title="Terminar sessão" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-xs font-black text-white">{userLabel.slice(0, 2).toUpperCase()}</button>
      </header>
      <main className="min-h-screen px-3 pb-6 pt-20 sm:px-5 lg:ml-[240px] lg:p-6 lg:pt-20">{children}</main>
      <footer className="fixed bottom-0 left-[240px] right-0 hidden h-10 items-center gap-5 bg-[#001e40] px-6 text-xs text-white lg:flex">
        {has('sales.create') && <button onClick={() => { navigate('sales'); onTriggerShortcut?.('F2'); }}><b>F2</b> Nova venda</button>}
        <button onClick={() => navigate('inventory')}><b>F3</b> Artigos</button>
        <button onClick={() => navigate('reports')}><b>F4</b> Relatórios</button>
        <span className="ml-auto truncate">{companyName} · {systemMode}</span>
      </footer>
    </div>
  );
};
