import React, { useState } from 'react';
import { Article, StockMovement } from '../types';
import { formatMZN } from '../stitch/stitchConfig';
import { ArticleLedgerModal } from '../components/ArticleLedgerModal';

interface InventoryProps {
  articles: Article[];
  movements?: StockMovement[];
  globalSearch: string;
  onOpenNewArticleModal: () => void;
  onEditArticle?: (article: Article) => void;
  onDeleteArticle?: (article: Article) => void;
  setActiveTab: (tab: string) => void;
  canViewCost: boolean;
  canCreate: boolean;
}

export const Inventory: React.FC<InventoryProps> = ({
  articles,
  movements = [],
  globalSearch,
  onOpenNewArticleModal,
  onEditArticle,
  onDeleteArticle,
  setActiveTab,
  canViewCost,
  canCreate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [codeFrom, setCodeFrom] = useState<string>('');
  const [codeTo, setCodeTo] = useState<string>('');
  const [ledgerArticle, setLedgerArticle] = useState<Article | null>(null);

  const searchTerm = (globalSearch || localSearch).toLowerCase();

  const categoryPills = React.useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category.toLowerCase());
    });
    const dynamicList = Array.from(set).map((cat) => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
    }));
    return [{ id: 'todos', label: 'Todos' }, ...dynamicList];
  }, [articles]);

  const filteredArticles = articles.filter((art) => {
    const matchesCategory = selectedCategory === 'todos' || art.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      art.code.toLowerCase().includes(searchTerm) ||
      art.description.toLowerCase().includes(searchTerm) ||
      (art.brand && art.brand.toLowerCase().includes(searchTerm));
    
    let matchesCodeRange = true;
    if (codeFrom.trim()) {
      matchesCodeRange = matchesCodeRange && art.code.toUpperCase() >= codeFrom.trim().toUpperCase();
    }
    if (codeTo.trim()) {
      matchesCodeRange = matchesCodeRange && art.code.toUpperCase() <= codeTo.trim().toUpperCase();
    }

    return matchesCategory && matchesSearch && matchesCodeRange;
  });

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && canCreate) {
        e.preventDefault();
        onOpenNewArticleModal();
      } else if (e.key === 'F3' && filteredArticles.length > 0 && onEditArticle) {
        e.preventDefault();
        onEditArticle(filteredArticles[0]);
      } else if (e.key === 'F4' && filteredArticles.length > 0) {
        e.preventDefault();
        setLedgerArticle(filteredArticles[0]);
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCreate, onOpenNewArticleModal, filteredArticles, onEditArticle]);

  const totalArticlesCount = filteredArticles.length;
  const totalCostValue = filteredArticles.reduce((acc, a) => acc + (a.costPrice * a.stock), 0);
  const totalSalesValue = filteredArticles.reduce((acc, a) => acc + (a.sellPriceWithIva * a.stock), 0);

  return (
    <div className="space-y-6">
      {/* Toolbar / Actions */}
      <div className="p-4 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded shadow-sm space-y-3">
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
              placeholder="Pesquisar por código, marca, medida ou descrição do artigo..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#f8f9fa] dark:bg-[#282c2e] border border-[#c3c6d1] dark:border-[#43474f] rounded text-sm focus-ring"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
            {categoryPills.map((cat) => (
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
            {canCreate && (
              <button
                onClick={onOpenNewArticleModal}
                className="flex items-center px-4 py-2 bg-[#006e25] text-white font-bold rounded text-xs uppercase hover:brightness-110 shadow-sm"
              >
                <span className="material-symbols-outlined mr-1.5 text-base">add_circle</span>
                Novo Artigo (F3)
              </button>
            )}
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

        {/* Code Range Filter */}
        <div className="flex items-center space-x-3 text-xs bg-[#f8f9fa] dark:bg-[#282c2e] p-2 rounded border border-[#c3c6d1] dark:border-[#43474f]">
          <span className="font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase flex items-center">
            <span className="material-symbols-outlined text-sm mr-1">filter_alt</span> Intervalo de Códigos:
          </span>
          <div className="flex items-center space-x-2">
            <label className="font-bold text-gray-500">De:</label>
            <input
              type="text"
              value={codeFrom}
              onChange={(e) => setCodeFrom(e.target.value)}
              placeholder="Ex: ART-001"
              className="p-1 border border-[#c3c6d1] dark:border-[#43474f] rounded uppercase w-28 dark:bg-[#1f2325]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="font-bold text-gray-500">Até:</label>
            <input
              type="text"
              value={codeTo}
              onChange={(e) => setCodeTo(e.target.value)}
              placeholder="Ex: ART-999"
              className="p-1 border border-[#c3c6d1] dark:border-[#43474f] rounded uppercase w-28 dark:bg-[#1f2325]"
            />
          </div>
          {(codeFrom || codeTo) && (
            <button
              onClick={() => { setCodeFrom(''); setCodeTo(''); }}
              className="text-[#ba1a1a] font-bold hover:underline"
            >
              Limpar Filtro
            </button>
          )}
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
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Custo</th>}
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">% Margem</th>}
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Venda</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. c/ IVA</th>
                <th className="px-3 py-3 text-center">Ações</th>
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
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.costPrice.toFixed(2)}
                    </td>}
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-gray-500">
                      {art.profitMargin}%
                    </td>}
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.sellPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {art.sellPriceWithIva.toFixed(2)} MZN
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setLedgerArticle(art)}
                          className="p-1 text-[#000080] dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                          title="Ver Extracto de Movimentos (Foto 2)"
                        >
                          <span className="material-symbols-outlined text-base">receipt_long</span>
                        </button>
                        {onEditArticle && (
                          <button
                            onClick={() => onEditArticle(art)}
                            className="p-1 text-[#003366] dark:text-[#a7c8ff] hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Editar Artigo (F3)"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                        )}
                        {onDeleteArticle && (
                          <button
                            onClick={() => onDeleteArticle(art)}
                            className="p-1 text-[#ba1a1a] hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title="Eliminar Artigo"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
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
        {canViewCost && <div className="bg-[#f8f9fa] dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase mb-1">Total de Artigos Listados</p>
          <p className="text-2xl font-extrabold text-[#001e40] dark:text-[#a7c8ff] font-mono">{totalArticlesCount}</p>
        </div>}

        <div className="bg-[#f8f9fa] dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase mb-1">Valor Custo (Stock Total)</p>
          <p className="text-2xl font-extrabold text-[#003366] dark:text-[#a7c8ff] font-mono">{formatMZN(totalCostValue)}</p>
        </div>

        <div className="bg-[#f8f9fa] dark:bg-[#1f2325] p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded">
          <p className="text-xs font-bold text-[#006e25] uppercase mb-1">Valor Venda c/ IVA (Stock Total)</p>
          <p className="text-2xl font-extrabold text-[#006e25] font-mono">{formatMZN(totalSalesValue)}</p>
        </div>
      </div>

      {/* Extracto de Movimentos Modal (Foto 2) */}
      <ArticleLedgerModal
        isOpen={Boolean(ledgerArticle)}
        onClose={() => setLedgerArticle(null)}
        article={ledgerArticle}
        articles={articles}
        movements={movements}
        onSelectArticleId={(id) => {
          const found = articles.find((a) => a.id === id);
          if (found) setLedgerArticle(found);
        }}
      />

      {/* Bottom Status Bar */}
      <div className="mt-4 rounded border border-[#c3c6d1] bg-[#e7e8e9] dark:border-[#43474f] dark:bg-[#282c2e] px-4 py-2 text-xs font-mono font-bold flex items-center justify-between">
        <div className="flex items-center space-x-4 text-[#191c1d] dark:text-white">
          <span>ESC=Sair</span>
          <span>TAB=Ord</span>
          <span>Barra=Filtro</span>
          <button onClick={onOpenNewArticleModal} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
            F2=Introduzir
          </button>
          {filteredArticles.length > 0 && onEditArticle && (
            <button onClick={() => onEditArticle(filteredArticles[0])} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
              F3=Alterar
            </button>
          )}
          {filteredArticles.length > 0 && (
            <button onClick={() => setLedgerArticle(filteredArticles[0])} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
              F4=Consultar
            </button>
          )}
          <button onClick={() => window.print()} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
            F9=Imp
          </button>
        </div>
        <div className="text-[#737780] text-[11px]">
          Ficheiro de Artigos: <b className="text-[#191c1d] dark:text-white">{filteredArticles.length} Registo(s)</b>
        </div>
      </div>
    </div>
  );
};
