import React, { useState } from 'react';
import { Article } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface InventoryProps {
  articles: Article[];
  globalSearch: string;
  onOpenNewArticleModal: () => void;
  setActiveTab: (tab: string) => void;
}

export const Inventory: React.FC<InventoryProps> = ({
  articles,
  globalSearch,
  onOpenNewArticleModal,
  setActiveTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [localSearch, setLocalSearch] = useState<string>('');

  const searchTerm = (globalSearch || localSearch).toLowerCase();

  const filteredArticles = articles.filter((art) => {
    const matchesCategory = selectedCategory === 'todos' || art.category === selectedCategory;
    const matchesSearch =
      art.code.toLowerCase().includes(searchTerm) ||
      art.description.toLowerCase().includes(searchTerm) ||
      (art.brand && art.brand.toLowerCase().includes(searchTerm));
    return matchesCategory && matchesSearch;
  });

  const totalArticlesCount = filteredArticles.length;
  const totalCostValue = filteredArticles.reduce((acc, a) => acc + (a.costPrice * a.stock), 0);
  const totalSalesValue = filteredArticles.reduce((acc, a) => acc + (a.sellPriceWithIva * a.stock), 0);
  const outOfStockCount = articles.filter((a) => a.stock === 0).length;

  return (
    <div className="space-y-6">
      {/* Toolbar / Actions */}
      <div className="p-4 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737780]">
              search
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Pesquisar por código, medida ou descrição de pneu..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#f8f9fa] dark:bg-[#282c2e] border border-[#c3c6d1] dark:border-[#43474f] rounded text-sm focus-ring"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'pneus', label: 'Pneus' },
              { id: 'camaras', label: 'Câmaras' },
              { id: 'servicos', label: 'Serviços' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-[#003366] text-white'
                    : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] hover:bg-[#e7e8e9]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenNewArticleModal}
              className="flex items-center px-4 py-2 bg-[#006e25] text-white font-bold rounded text-xs uppercase hover:brightness-110 shadow-sm"
            >
              <span className="material-symbols-outlined mr-1.5 text-base">add_circle</span>
              Novo Artigo (F3)
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center px-3 py-2 bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-white font-bold rounded text-xs uppercase hover:bg-[#c3c6d1]"
            >
              <span className="material-symbols-outlined mr-1.5 text-base">print</span>
              Imprimir
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className="flex items-center px-3 py-2 bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-white font-bold rounded text-xs uppercase hover:bg-[#c3c6d1]"
            >
              <span className="material-symbols-outlined mr-1.5 text-base">swap_horiz</span>
              Movimentos
            </button>
          </div>
        </div>
      </div>

      {/* Data Grid Container */}
      <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] border-b border-[#c3c6d1] dark:border-[#43474f] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase">
              <tr>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Código</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Descrição do Artigo</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-center">Un.</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Stock Mín.</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Existência</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Custo</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">% Margem</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Venda</th>
                <th className="px-3 py-3 text-right">P. c/ IVA (16%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {filteredArticles.map((art) => {
                const isCritical = art.stock <= art.minStock;
                return (
                  <tr
                    key={art.id}
                    className={`transition-colors font-mono ${
                      isCritical
                        ? 'bg-[#ffdad6]/20 dark:bg-[#450009]/30 hover:bg-[#ffdad6]/40'
                        : 'hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]'
                    }`}
                  >
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {art.code}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans font-medium text-[#191c1d] dark:text-white">
                      {art.description}
                      {isCritical && (
                        <span className="ml-2 text-[10px] bg-[#ba1a1a] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                          {art.stock === 0 ? 'Esgotado' : 'Crítico'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-center font-bold">
                      {art.unit}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-[#737780]">
                      {art.minStock}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-extrabold text-sm">
                      <span className={isCritical ? 'text-[#ba1a1a]' : 'text-[#006e25]'}>
                        {art.stock}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.costPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-gray-500">
                      {art.profitMargin}%
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.sellPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {art.sellPriceWithIva.toFixed(2)} MZN
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats (Bento Style Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase mb-1">Total de Artigos</p>
          <p className="text-2xl font-extrabold text-[#001e40] dark:text-[#a7c8ff] font-mono">{totalArticlesCount}</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase mb-1">Valor Custo (Stock Total)</p>
          <p className="text-2xl font-extrabold text-[#003366] dark:text-[#a7c8ff] font-mono">{formatMZN(totalCostValue)}</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#006e25] uppercase mb-1">Valor Venda (Stock Total)</p>
          <p className="text-2xl font-extrabold text-[#006e25] font-mono">{formatMZN(totalSalesValue)}</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] p-4 border border-[#ffdad6] dark:border-[#ba1a1a]/40 bg-[#ffdad6]/10 rounded">
          <p className="text-xs font-bold text-[#ba1a1a] uppercase mb-1">Artigos Sem Stock (Esgotados)</p>
          <p className="text-2xl font-extrabold text-[#ba1a1a] font-mono">{outOfStockCount}</p>
        </div>
      </div>
    </div>
  );
};
