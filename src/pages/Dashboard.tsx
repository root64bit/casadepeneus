import React from 'react';
import { Article, SaleInvoice, Client, DashboardMetrics } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface DashboardProps {
  articles: Article[];
  sales: SaleInvoice[];
  clients: Client[];
  setActiveTab: (tab: string) => void;
  onOpenNewArticleModal: () => void;
  metrics: DashboardMetrics | null;
  permissions: string[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  articles,
  sales,
  clients,
  setActiveTab,
  onOpenNewArticleModal,
  metrics,
  permissions,
}) => {
  const lowStockArticles = articles.filter(a => a.stock <= a.minStock);
  const totalSalesToday = metrics?.salesToday ?? 0;
  const totalPendingDebt = metrics?.receivables ?? 0;
  const canSell = permissions.includes('sales.create') && permissions.includes('sales.confirm');
  const canEntry = permissions.includes('stock.direct_entry') || permissions.includes('stock.entry.confirm');
  const canExit = permissions.includes('stock.direct_exit') || permissions.includes('stock.exit.confirm');
  const canCreateProduct = permissions.includes('products.create');

  return (
    <div className="space-y-6">
      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {canSell && <button
          onClick={() => setActiveTab('sales')}
          className="flex flex-col items-center justify-center p-5 bg-[#001e40] text-white hover:bg-[#003366] transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">sell</span>
          <span className="font-bold text-sm">Nova Venda</span>
          <span className="mt-1 text-[10px] bg-[#80f98b] text-[#001e40] font-extrabold px-1.5 py-0.5 rounded">Atalho F2</span>
        </button>}

        {canEntry && <button
          onClick={() => setActiveTab('movements')}
          className="flex flex-col items-center justify-center p-5 bg-[#001e40] text-white hover:bg-[#003366] transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">input</span>
          <span className="font-bold text-sm">Entrada Stock</span>
        </button>}

        {canExit && <button
          onClick={() => setActiveTab('movements')}
          className="flex flex-col items-center justify-center p-5 bg-[#001e40] text-white hover:bg-[#003366] transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">output</span>
          <span className="font-bold text-sm">Saída Stock</span>
        </button>}

        {canCreateProduct && <button
          onClick={() => setActiveTab('inventory')}
          className="flex flex-col items-center justify-center p-5 bg-[#001e40] text-white hover:bg-[#003366] transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">inventory_2</span>
          <span className="font-bold text-sm">Consultar Artigos</span>
        </button>}

        <button
          onClick={() => setActiveTab('entities')}
          className="flex flex-col items-center justify-center p-5 bg-[#001e40] text-white hover:bg-[#003366] transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">groups</span>
          <span className="font-bold text-sm">Clientes</span>
        </button>

        <button
          onClick={onOpenNewArticleModal}
          className="flex flex-col items-center justify-center p-5 bg-[#006e25] text-white hover:brightness-110 transition-all rounded shadow-sm group text-center"
        >
          <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_circle</span>
          <span className="font-bold text-sm">+ Novo Pneu</span>
        </button>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Vendas do Dia */}
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden">
          <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
            <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
              <span className="material-symbols-outlined mr-2">receipt_long</span>
              Vendas do Dia
            </h3>
            <span className="bg-[#006e25] text-white px-3 py-0.5 rounded-full text-xs font-bold font-mono">
              Total: {formatMZN(totalSalesToday)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] border-b border-[#c3c6d1] dark:border-[#43474f] text-[#737780] dark:text-[#c3c6d1] uppercase">
                <tr>
                  <th className="p-2.5">Doc #</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5 text-right">Valor</th>
                  <th className="p-2.5 text-center">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
                {sales.length === 0 && <tr><td colSpan={4} className="p-6 text-center font-sans text-slate-500">Sem vendas para apresentar.</td></tr>}
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                    <td className="p-2.5 font-bold text-[#003366] dark:text-[#a7c8ff]">{sale.docNumber}</td>
                    <td className="p-2.5 font-sans font-medium">{sale.clientName}</td>
                    <td className="p-2.5 text-right font-bold text-[#006e25]">{formatMZN(sale.totalAmount)}</td>
                    <td className="p-2.5 text-center text-[#737780] dark:text-[#c3c6d1]">{sale.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Produtos com pouco stock (Warning Card) */}
        <section className="bg-white dark:bg-[#1f2325] border border-[#ba1a1a]/30 rounded overflow-hidden shadow-sm animate-stock-warning">
          <div className="bg-[#ffdad6] dark:bg-[#450009] px-4 py-3 flex justify-between items-center border-b border-[#ba1a1a]/20">
            <h3 className="font-bold text-[#93000a] dark:text-[#ffdad9] flex items-center text-sm">
              <span className="material-symbols-outlined mr-2">warning</span>
              Stock Crítico ({lowStockArticles.length})
            </h3>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-[#93000a] dark:text-[#ffdad9] underline font-bold hover:opacity-80"
            >
              Ver todos no inventário
            </button>
          </div>
          <ul className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] text-xs">
            {lowStockArticles.length === 0 && <li className="p-6 text-center text-slate-500">Sem alertas de stock.</li>}
            {lowStockArticles.map((article) => (
              <li key={article.id} className="p-3 flex items-center justify-between hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-[#ffdad6] text-[#ba1a1a] rounded flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-lg">tire_repair</span>
                  </div>
                  <div>
                    <p className="font-bold text-[#191c1d] dark:text-[#e1e3e4]">{article.description}</p>
                    <p className="text-[11px] text-[#737780] dark:text-[#c3c6d1] font-mono">Código: {article.code}</p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <p className="text-sm font-bold text-[#ba1a1a]">{article.stock} {article.unit}</p>
                  <p className="text-[10px] text-[#737780] dark:text-[#c3c6d1]">Mínimo: {article.minStock}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Clientes com pagamentos pendentes */}
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden">
          <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
            <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
              <span className="material-symbols-outlined mr-2">pending_actions</span>
              Pendentes de Cobrança
            </h3>
            <span className="text-[#ba1a1a] font-bold text-xs font-mono">
              {formatMZN(totalPendingDebt)}
            </span>
          </div>
          <div className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] text-xs">
            {clients.filter(c => c.pendingBalance > 0).length === 0 && <p className="p-6 text-center text-slate-500">Sem cobranças pendentes.</p>}
            {clients.filter(c => c.pendingBalance > 0).map((client) => (
              <div key={client.id} className="p-3 flex justify-between items-center hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                <div>
                  <span className="font-bold text-[#191c1d] dark:text-[#e1e3e4] block">{client.name}</span>
                  <span className="text-[11px] text-[#737780] dark:text-[#c3c6d1]">NUIT: {client.nuit}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-[#ba1a1a] block text-sm">{formatMZN(client.pendingBalance)}</span>
                  <span className="text-[10px] text-[#737780]">Cobrança Ativa</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Últimos Documentos Emitidos */}
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden">
          <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 border-b border-[#c3c6d1] dark:border-[#43474f]">
            <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
              <span className="material-symbols-outlined mr-2">history</span>
              Últimos Documentos Emitidos
            </h3>
          </div>
          <div className="p-3 space-y-2.5 text-xs">
            {sales.length === 0 && <p className="p-6 text-center text-slate-500">Sem documentos recentes.</p>}
            {sales.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveTab('sales')}
                className="flex items-center border border-[#c3c6d1] dark:border-[#43474f] p-2.5 rounded hover:border-[#003366] cursor-pointer group transition-colors"
              >
                <div className="p-2 bg-[#f3f4f5] dark:bg-[#282c2e] rounded group-hover:bg-[#003366] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-base">description</span>
                </div>
                <div className="ml-3 flex-1">
                  <p className="font-bold text-[#191c1d] dark:text-white">{s.docNumber}</p>
                  <p className="text-[11px] text-[#737780] dark:text-[#c3c6d1]">{s.clientName}</p>
                </div>
                <div className="text-right font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">
                  {formatMZN(s.totalAmount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
