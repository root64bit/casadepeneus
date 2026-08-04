import React, { useMemo, useState } from 'react';
import type { SaleInvoice, DocumentRecord, Article, Client } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface ReportsProps {
  permissions: string[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  articles?: Article[];
  clients?: Client[];
  onPrintRecord?: (doc: DocumentRecord) => void;
  canViewCost?: boolean;
}

export const Reports: React.FC<ReportsProps> = ({
  permissions,
  sales = [],
  documents = [],
  articles = [],
  clients = [],
  onPrintRecord,
  canViewCost = true,
}) => {
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [codeFrom, setCodeFrom] = useState('');
  const [codeTo, setCodeTo] = useState('');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');

  // Clear all filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCodeFrom('');
    setCodeTo('');
    setArticleSearchQuery('');
  };

  // Helper for Code Range matching (supports numeric and alphanumeric ranges)
  const matchCodeRange = (code: string, from: string, to: string): boolean => {
    if (!from && !to) return true;
    const cleanCode = code.trim().toLowerCase();
    const cleanFrom = from.trim().toLowerCase();
    const cleanTo = to.trim().toLowerCase();

    const numCode = parseInt(cleanCode.replace(/\D/g, ''), 10);
    const numFrom = cleanFrom ? parseInt(cleanFrom.replace(/\D/g, ''), 10) : null;
    const numTo = cleanTo ? parseInt(cleanTo.replace(/\D/g, ''), 10) : null;

    if (!isNaN(numCode) && ((numFrom !== null && !isNaN(numFrom)) || (numTo !== null && !isNaN(numTo)))) {
      if (numFrom !== null && !isNaN(numFrom) && numCode < numFrom) return false;
      if (numTo !== null && !isNaN(numTo) && numCode > numTo) return false;
      return true;
    }

    if (cleanFrom && cleanCode < cleanFrom) return false;
    if (cleanTo && cleanCode > cleanTo) return false;
    return true;
  };

  // Filter Sales Documents by Date Range
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (sale.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE') return false;
      if (sale.status === 'Cancelada') return false;

      if (dateFrom && sale.date < dateFrom) return false;
      if (dateTo && sale.date > dateTo) return false;

      return true;
    });
  }, [sales, dateFrom, dateTo]);

  // Aggregate Sales by Article
  const salesByArticle = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        description: string;
        quantity: number;
        netTotal: number;
      }
    >();

    filteredSales.forEach((sale) => {
      if (sale.documentTypeCode === 'CUSTOMER_CREDIT_NOTE') return;

      sale.items.forEach((item) => {
        // Filter by Code Range
        if (!matchCodeRange(item.code, codeFrom, codeTo)) return;

        // Filter by Article Search Query
        if (articleSearchQuery.trim()) {
          const q = articleSearchQuery.trim().toLowerCase();
          const matchCode = item.code.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          if (!matchCode && !matchDesc) return;
        }

        const existing = map.get(item.code) || {
          code: item.code,
          description: item.description,
          quantity: 0,
          netTotal: 0,
        };

        existing.quantity += item.quantity;
        existing.netTotal += item.total;

        map.set(item.code, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [filteredSales, codeFrom, codeTo, articleSearchQuery]);

  // CSV Export Function
  const exportCsv = () => {
    const headers = ['Código', 'Descrição', 'Qtd Vendida', 'Preço Médio (MZN)'];
    const rows = salesByArticle.map((a) => {
      const avgPrice = a.quantity > 0 ? a.netTotal / a.quantity : 0;
      return [
        a.code,
        `"${a.description.replace(/"/g, '""')}"`,
        a.quantity.toFixed(3),
        avgPrice.toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-por-artigo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-2xl text-[#003366] dark:text-[#a7c8ff]">analytics</span>
            <h2 className="text-lg font-black uppercase text-[#191c1d] dark:text-white">
              Relatório de Vendas por Artigo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Vendas discriminadas exclusivamente por artigo com filtro por intervalo de códigos.
          </p>
        </div>
      </section>

      {/* Filter Suite Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-2">
          <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff]">
            Filtros por Data, Código de Artigo e Pesquisa
          </h3>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            🧹 LIMPAR FILTROS
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">De Código (X)</label>
            <input
              type="text"
              placeholder="Ex: 1 ou ART-001"
              value={codeFrom}
              onChange={(e) => setCodeFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Até Código (Y)</label>
            <input
              type="text"
              placeholder="Ex: 50 ou ART-050"
              value={codeTo}
              onChange={(e) => setCodeTo(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Pesquisar Artigo</label>
            <input
              type="text"
              placeholder="Código ou descrição..."
              value={articleSearchQuery}
              onChange={(e) => setArticleSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* POR ARTIGO TABLE */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#001e40] text-white px-4 py-3 text-xs font-bold uppercase flex justify-between items-center">
          <span>Relatório de Vendas Discriminadas por Artigo</span>
          <span>Total de Artigos Distintos: {salesByArticle.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Descrição do Artigo</th>
                <th className="p-3 text-center">Qtd Vendida</th>
                <th className="p-3 text-right">Preço Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {salesByArticle.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-sans italic">
                    Nenhum artigo vendido no período ou intervalo de códigos seleccionado.
                  </td>
                </tr>
              ) : (
                salesByArticle.map((art) => {
                  const avgPrice = art.quantity > 0 ? art.netTotal / art.quantity : 0;

                  return (
                    <tr key={art.code} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                      <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{art.code}</td>
                      <td className="p-3 font-sans font-semibold text-slate-800 dark:text-white">{art.description}</td>
                      <td className="p-3 text-center font-extrabold text-emerald-700 dark:text-emerald-400">{art.quantity.toFixed(3)} UN</td>
                      <td className="p-3 text-right font-bold">{formatMZN(avgPrice)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer Action Controls */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex items-center justify-between">
        <p className="text-xs text-slate-500 font-mono">
          Mostrando {salesByArticle.length} artigo(s) discriminado(s).
        </p>

        <div className="flex items-center space-x-3">
          {permissions.includes('reports.export') && (
            <button
              type="button"
              onClick={exportCsv}
              className="px-4 py-2 bg-green-700 text-white font-bold rounded text-xs hover:bg-green-800"
            >
              📥 Exportar Relatório CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#003366] text-white font-bold rounded text-xs hover:bg-blue-800"
          >
            🖨 Imprimir Relatório
          </button>
        </div>
      </section>
    </div>
  );
};
