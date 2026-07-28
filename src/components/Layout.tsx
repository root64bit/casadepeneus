import React, { useState, useEffect } from 'react';
import { STITCH_CONFIG } from '../stitch/stitchConfig';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  onTriggerShortcut?: (key: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  globalSearch,
  setGlobalSearch,
  onTriggerShortcut
}) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: 'home' },
    { id: 'inventory', label: 'Artigos e Stock', icon: 'inventory_2' },
    { id: 'sales', label: 'Nova Venda', icon: 'sell', highlight: true },
    { id: 'movements', label: 'Entradas & Saídas', icon: 'swap_horiz' },
    { id: 'entities', label: 'Clientes & Fornecedores', icon: 'groups' },
    { id: 'reports', label: 'Pagamentos & Relatórios', icon: 'analytics' },
    { id: 'stitch', label: 'Conexão Stitch', icon: 'hub' },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-[#191c1d] text-[#e1e3e4]' : 'bg-[#f8f9fa] text-[#191c1d]'}`}>
      {/* 1. SIDE NAV BAR (240px Fixed) */}
      <aside className="w-[240px] h-screen fixed left-0 top-0 bg-[#f8f9fa] dark:bg-[#1f2325] border-r border-[#c3c6d1] dark:border-[#43474f] flex flex-col py-6 px-0 z-20 transition-colors duration-200">
        <div className="px-6 mb-6">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#003366] dark:text-[#a7c8ff] text-2xl">tire_repair</span>
            <h1 className="font-bold text-lg text-[#001e40] dark:text-[#a7c8ff] leading-tight">Casa de Pneus</h1>
          </div>
          <p className="text-xs text-[#43474f] dark:text-[#c3c6d1] opacity-75 mt-0.5">Gestão Operacional Lda.</p>
          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#80f98b]/30 text-[#007327] border border-[#006e25]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006e25] mr-1.5 animate-pulse"></span>
            Supabase Online
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-all duration-150 text-left ${
                  isActive
                    ? 'text-[#003366] dark:text-[#a7c8ff] font-bold border-r-4 border-[#003366] dark:border-[#a7c8ff] bg-[#e7e8e9] dark:bg-[#383d41]'
                    : 'text-[#43474f] dark:text-[#c3c6d1] hover:bg-[#edeeef] dark:hover:bg-[#2e3336]'
                }`}
              >
                <span className="material-symbols-outlined mr-3 text-xl">{item.icon}</span>
                <span>{item.label}</span>
                {item.highlight && (
                  <span className="ml-auto bg-[#003366] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">F2</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-6 pt-4 mt-auto border-t border-[#c3c6d1] dark:border-[#43474f] space-y-2">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between text-xs text-[#43474f] dark:text-[#c3c6d1] hover:text-[#003366] py-1.5"
          >
            <span className="flex items-center">
              <span className="material-symbols-outlined mr-2 text-base">{darkMode ? 'light_mode' : 'dark_mode'}</span>
              {darkMode ? 'Modo Claro' : 'Modo Escuro'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#edeeef] dark:bg-[#383d41] rounded">
              {darkMode ? 'ON' : 'OFF'}
            </span>
          </button>

          <a
            href={`https://stitch.withgoogle.com/projects/${STITCH_CONFIG.projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs text-[#003366] dark:text-[#a7c8ff] hover:underline pt-1"
          >
            <span className="material-symbols-outlined mr-2 text-sm">open_in_new</span>
            Projeto Stitch #{STITCH_CONFIG.projectId.slice(0, 6)}...
          </a>
        </div>
      </aside>

      {/* 2. TOP NAV BAR (Fixed header) */}
      <header className="h-16 fixed top-0 right-0 left-[240px] z-10 bg-white dark:bg-[#1f2325] border-b border-[#c3c6d1] dark:border-[#43474f] flex items-center justify-between px-6 transition-colors duration-200">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737780] text-xl">
              search
            </span>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Pesquisar artigos por código, pneu, fatura ou cliente (F1)..."
              className="w-full bg-[#f3f4f5] dark:bg-[#282c2e] border border-[#c3c6d1] dark:border-[#43474f] rounded pl-10 pr-4 py-2 text-sm text-[#191c1d] dark:text-[#e1e3e4] focus:outline-none focus:border-[#003366] focus:ring-1 focus:ring-[#003366] transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center text-xs text-[#43474f] dark:text-[#c3c6d1] space-x-1 bg-[#f3f4f5] dark:bg-[#282c2e] px-3 py-1.5 rounded border border-[#c3c6d1] dark:border-[#43474f]">
            <span className="material-symbols-outlined text-sm mr-1">calendar_today</span>
            <span>{new Date().toLocaleDateString('pt-PT')}</span>
            <span className="mx-1.5">•</span>
            <span className="font-semibold text-[#003366] dark:text-[#a7c8ff]">{currentTime}</span>
          </div>

          <div className="flex items-center space-x-3 border-l border-[#c3c6d1] dark:border-[#43474f] pl-4">
            <div className="text-right">
              <p className="text-xs font-bold text-[#001e40] dark:text-[#a7c8ff] leading-none">Operador Balcão</p>
              <p className="text-[10px] text-[#43474f] dark:text-[#c3c6d1] mt-0.5">Sessão Ativa</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              OP
            </div>
          </div>
        </div>
      </header>

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="ml-[240px] pt-16 pb-12 min-h-screen p-6">
        {children}
      </main>

      {/* 4. FOOTER KEYBOARD SHORTCUTS BAR */}
      <footer className="fixed bottom-0 right-0 left-[240px] h-10 bg-[#001e40] dark:bg-[#003366] text-white flex items-center justify-between px-6 z-20 text-xs shadow-lg">
        <div className="flex items-center space-x-5 font-mono">
          <button
            onClick={() => onTriggerShortcut && onTriggerShortcut('ESC')}
            className="flex items-center hover:text-[#80f98b] transition-colors"
          >
            <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold mr-1.5 text-[10px]">Esc</span>
            <span>Sair</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('sales');
              onTriggerShortcut && onTriggerShortcut('F2');
            }}
            className="flex items-center text-[#80f98b] font-bold hover:underline"
          >
            <span className="bg-[#80f98b] text-[#001e40] px-1.5 py-0.5 rounded font-bold mr-1.5 text-[10px]">F2</span>
            <span>Nova Venda / Guardar</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('inventory');
              onTriggerShortcut && onTriggerShortcut('F3');
            }}
            className="flex items-center hover:text-[#80f98b] transition-colors"
          >
            <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold mr-1.5 text-[10px]">F3</span>
            <span>Artigos</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('reports');
              onTriggerShortcut && onTriggerShortcut('F4');
            }}
            className="flex items-center hover:text-[#80f98b] transition-colors"
          >
            <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold mr-1.5 text-[10px]">F4</span>
            <span>Relatórios</span>
          </button>
          <button
            onClick={() => onTriggerShortcut && onTriggerShortcut('F9')}
            className="flex items-center hover:text-[#80f98b] transition-colors"
          >
            <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold mr-1.5 text-[10px]">F9</span>
            <span>Imprimir</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <span className="font-bold tracking-wider uppercase text-[10px] text-white/80">Casa de Pneus, Lda.</span>
          <span className="text-white/40">|</span>
          <a
            href="https://github.com/root64bit/casadepeneus"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-white/80 hover:text-white text-[11px]"
          >
            Suporte Técnico
          </a>
        </div>
      </footer>
    </div>
  );
};
