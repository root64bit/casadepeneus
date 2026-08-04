import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AccessScope, Article, StockMovement, DocumentRecord } from '../types';
import { ArticleSearchSelect } from '../components/ArticleSearchSelect';
import { ArticleLedgerModal } from '../components/ArticleLedgerModal';
import { formatMZN } from '../stitch/stitchConfig';

export interface GuideLineItem {
  articleId: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  priceWithIva?: number;
  currentStock: number;
}

interface StockMovementsProps {
  movements: StockMovement[];
  articles: Article[];
  documents?: DocumentRecord[];
  warehouses: AccessScope[];
  operatorName: string;
  onAddMovement: (movement: StockMovement) => Promise<void>;
  onOpenDocument?: (doc: DocumentRecord) => void;
  canPostEntry: boolean;
  canPostExit: boolean;
  canViewCost?: boolean;
}

export const StockMovements: React.FC<StockMovementsProps> = ({
  movements, articles, documents = [], warehouses, operatorName, onAddMovement, onOpenDocument, canPostEntry, canPostExit, canViewCost = true,
}) => {
  const [type, setType] = useState<'entrada' | 'saida'>(canPostEntry ? 'entrada' : 'saida');
  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [guideNumber, setGuideNumber] = useState('');
  const [priceWithIvaStr, setPriceWithIvaStr] = useState('');
  const [notes, setNotes] = useState('');
  
  // Batch guide items (up to 99 items per guide)
  const [guideItems, setGuideItems] = useState<GuideLineItem[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ledgerArticle, setLedgerArticle] = useState<Article | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const guideNumberRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Date and Text Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'entrada' | 'saida'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Total Available Stock in System
  const totalStockInSystem = useMemo(() => {
    return articles.reduce((acc, art) => acc + (art.stock || 0), 0);
  }, [articles]);

  // Calculate running balance (saldo) for each movement per article
  const movementsWithSaldo = useMemo(() => {
    const movementsByArticle: Record<string, StockMovement[]> = {};
    movements.forEach((m) => {
      if (!movementsByArticle[m.articleCode]) {
        movementsByArticle[m.articleCode] = [];
      }
      movementsByArticle[m.articleCode].push(m);
    });

    const mapWithSaldo = new Map<string, number>();

    Object.entries(movementsByArticle).forEach(([code, articleMovs]) => {
      const matchedArt = articles.find((a) => a.code === code);
      const currentStock = matchedArt?.stock ?? 0;

      // Sort descending (newest first)
      const sortedDesc = [...articleMovs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      let running = currentStock;
      sortedDesc.forEach((m) => {
        mapWithSaldo.set(m.id, running);
        if (m.type === 'entrada') {
          running -= m.quantity;
        } else {
          running += m.quantity;
        }
      });
    });

    return mapWithSaldo;
  }, [movements, articles]);

  // Clear Filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  // Helper to extract local YYYY-MM-DD from ISO or date string
  const getLocalDateString = (isoOrDateStr: string): string => {
    if (!isoOrDateStr) return '';
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return isoOrDateStr.substring(0, 10);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filtered movements based on date, type and search query
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const itemDate = getLocalDateString(m.date);
      if (dateFrom && itemDate < dateFrom) return false;
      if (dateTo && itemDate > dateTo) return false;
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = m.articleCode.toLowerCase().includes(q);
        const descMatch = m.articleDescription.toLowerCase().includes(q);
        const refMatch = m.docRef.toLowerCase().includes(q);
        const operatorMatch = m.operator.toLowerCase().includes(q);
        const typeMatch = m.type.toLowerCase().includes(q);
        const qtyMatch = String(m.quantity).includes(q);
        if (!codeMatch && !descMatch && !refMatch && !operatorMatch && !typeMatch && !qtyMatch) return false;
      }
      return true;
    });
  }, [movements, dateFrom, dateTo, typeFilter, searchQuery]);

  const exportMovementsToCSV = () => {
    const headers = ['Data', 'Tipo', 'Documento / Guia', 'Código Artigo', 'Descrição Artigo', 'Entrada (Qtd)', 'Saída (Qtd)', 'Saldo Final'];
    const sorted = [...filteredMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const rows = sorted.map((item) => {
      const saldo = movementsWithSaldo.get(item.id) ?? 0;
      const formattedDate = new Date(item.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return [
        `"${formattedDate}"`,
        item.type.toUpperCase(),
        `"${(item.docRef || (item.type === 'entrada' ? 'Entrada Directa' : 'Saída Directa')).replace(/"/g, '""')}"`,
        `"${item.articleCode.replace(/"/g, '""')}"`,
        `"${item.articleDescription.replace(/"/g, '""')}"`,
        item.type === 'entrada' ? item.quantity.toFixed(3) : '0',
        item.type === 'saida' ? item.quantity.toFixed(3) : '0',
        saldo.toFixed(3),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const dateSuffix = dateFrom || dateTo ? `_${dateFrom || 'inicio'}_a_${dateTo || 'hoje'}` : '';
    link.download = `movimentos-stock${dateSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const article = useMemo(() => articles.find((item) => item.id === articleId), [articles, articleId]);
  const quantity = Number(quantityStr) || 0;
  const expectedStock = article ? article.stock + (type === 'entrada' ? quantity : -quantity) : 0;

  useEffect(() => { if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id); }, [warehouses, warehouseId]);
  useEffect(() => { if (!canPostEntry && canPostExit) setType('saida'); }, [canPostEntry, canPostExit]);

  useEffect(() => {
    if (article) {
      setPriceWithIvaStr(article.sellPriceWithIva ? String(article.sellPriceWithIva) : '');
    }
  }, [article]);

  const handleSelectArticle = (id: string) => {
    setArticleId(id);
    const target = articles.find((a) => a.id === id);
    if (target) {
      setPriceWithIvaStr(target.sellPriceWithIva ? String(target.sellPriceWithIva) : '');
    }
  };

  const handleAfterArticleSelect = () => {
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  const addItemToGuide = () => {
    if (guideItems.length >= 99) {
      setError('Limite máximo de 99 artigos por guia atingido.');
      return;
    }
    const targetArticle = articles.find((a) => a.id === articleId);
    const qty = Number(quantityStr);
    const price = priceWithIvaStr ? Number(priceWithIvaStr) : undefined;
    if (!targetArticle || qty <= 0 || isNaN(qty)) {
      setError('Seleccione um artigo e indique uma quantidade válida.');
      return;
    }
    if (type === 'saida' && qty > targetArticle.stock) {
      setError(`A quantidade de saída (${qty}) excede o stock disponível (${targetArticle.stock}) para o artigo ${targetArticle.code}.`);
      return;
    }

    setError('');
    setGuideItems((prev) => [
      ...prev,
      {
        articleId: targetArticle.id,
        articleCode: targetArticle.code,
        articleDescription: targetArticle.description,
        quantity: qty,
        priceWithIva: price,
        currentStock: targetArticle.stock,
      },
    ]);

    setArticleId('');
    setQuantityStr('');
    setPriceWithIvaStr('');

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Código do Artigo"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select?.();
      }
    }, 40);
  };

  const removeItemFromGuide = (index: number) => {
    setGuideItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitGuide = async () => {
    let currentGuideItems = [...guideItems];

    // If user has typed an item in the input row but hasn't clicked "Adicionar" yet, include it
    const targetArticle = articles.find((a) => a.id === articleId);
    const qty = Number(quantityStr);
    if (targetArticle && qty > 0 && !isNaN(qty)) {
      if (type === 'saida' && qty > targetArticle.stock) {
        setError(`A quantidade de saída (${qty}) excede o stock disponível (${targetArticle.stock}) para o artigo ${targetArticle.code}.`);
        return;
      }
      if (currentGuideItems.length < 99) {
        currentGuideItems.push({
          articleId: targetArticle.id,
          articleCode: targetArticle.code,
          articleDescription: targetArticle.description,
          quantity: qty,
          priceWithIva: priceWithIvaStr ? Number(priceWithIvaStr) : undefined,
          currentStock: targetArticle.stock,
        });
      }
    }

    if (currentGuideItems.length === 0) {
      setError('Adicione pelo menos um artigo à guia (até 99 artigos) antes de confirmar.');
      return;
    }

    if (!warehouseId) {
      setError('Seleccione o armazém antes de confirmar.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const guideDocRef = guideNumber.trim()
        ? `Guia: ${guideNumber.trim()}`
        : `${type === 'entrada' ? 'Guia Entrada' : 'Guia Saída'} ${new Date().toLocaleDateString('pt-PT')}`;

      for (const item of currentGuideItems) {
        await onAddMovement({
          id: '',
          type,
          warehouseId,
          warehouseName: warehouses.find((item) => item.id === warehouseId)?.name,
          docRef: guideDocRef,
          date: new Date().toISOString(),
          articleCode: item.articleCode,
          articleDescription: item.articleDescription,
          quantity: item.quantity,
          entityName: '',
          operator: operatorName,
          reason: type === 'entrada' ? 'Entrada direta por Guia' : 'Saída direta por Guia',
          notes: [
            item.priceWithIva ? `Preço Compra c/ IVA: ${item.priceWithIva} MZN` : '',
            notes,
          ].filter(Boolean).join(' | '),
        });
      }

      setGuideItems([]);
      setArticleId('');
      setQuantityStr('');
      setPriceWithIvaStr('');
      setGuideNumber('');
      setNotes('');
      setSuccess(`Guia (${guideDocRef}) com ${currentGuideItems.length} artigo(s) registada com sucesso.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registar movimento de stock.');
    } finally {
      setSaving(false);
    }
  };

  // Global Keyboard shortcut F2 to submit guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void submitGuide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideItems, articleId, quantityStr, priceWithIvaStr, guideNumber, notes, type, warehouseId, saving]);

  return (
    <div className="space-y-6 font-sans">
      {(canPostEntry || canPostExit) && (
        <section className="rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] sm:p-5 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f] gap-2">
            <h2 className="text-sm font-black text-primary dark:text-blue-200 uppercase flex items-center gap-2">
              📦 Registar Guia de {type === 'entrada' ? 'Entrada' : 'Saída'} de Stock (até 99 itens)
            </h2>
            <div className="flex items-center space-x-3">
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                Stock Total Disponível: <b>{totalStockInSystem} UN</b>
              </span>
              <span className="text-xs font-bold text-slate-500">
                Artigos na Guia: <b className="text-primary font-mono text-sm">{guideItems.length} / 99</b>
              </span>
            </div>
          </div>

          {/* Header Controls (Operação, Nº da Guia, Observações, Operador) */}
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-4">
            <label className="font-bold text-xs uppercase text-[#737780]">
              Operação
              <select
                value={type}
                onChange={(event) => setType(event.target.value as 'entrada' | 'saida')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    guideNumberRef.current?.focus();
                    guideNumberRef.current?.select();
                  }
                }}
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
              >
                {canPostEntry && <option value="entrada">Entrada direta por Guia</option>}
                {canPostExit && <option value="saida">Saída direta por Guia</option>}
              </select>
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Número da Guia
              <input
                ref={guideNumberRef}
                type="text"
                value={guideNumber}
                onChange={(event) => setGuideNumber(event.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    notesRef.current?.focus();
                    notesRef.current?.select();
                  }
                }}
                placeholder="Ex: GUIA-2026/001"
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 font-mono uppercase dark:bg-[#282c2e]"
              />
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Operador
              <input readOnly value={operatorName} className="mt-1 w-full rounded border bg-slate-100 dark:bg-slate-800 p-2 font-medium" />
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Observações
              <input
                ref={notesRef}
                maxLength={500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Código do Artigo"]');
                    if (searchInput) {
                      searchInput.focus();
                      searchInput.select?.();
                    }
                  }
                }}
                placeholder="Notas da guia..."
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
              />
            </label>
          </div>

          {/* Item entry input row - Fast Enter key navigation */}
          <div className="bg-[#0000aa]/5 dark:bg-[#282c2e] p-3 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
            <span className="text-[11px] font-bold uppercase text-[#003366] dark:text-[#a7c8ff] block">
              + Inserir Artigo na Guia (Enter para saltar campos / adicionar)
            </span>

            <div className="grid items-end gap-2 grid-cols-1 sm:grid-cols-12">
              <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-6">
                Código do Artigo (Pesquisa por Código)
                <ArticleSearchSelect
                  articles={articles}
                  selectedArticleId={articleId}
                  onSelect={handleSelectArticle}
                  onAfterSelect={handleAfterArticleSelect}
                  searchByCodeOnly={true}
                  placeholder="Introduza o Código do Artigo (ex: ART-001)…"
                  className="mt-1"
                />
              </label>

              <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-2">
                Quantidade
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantityStr}
                  onChange={(event) => setQuantityStr(event.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (priceInputRef.current) {
                        priceInputRef.current.focus();
                        priceInputRef.current.select();
                      } else {
                        addItemToGuide();
                      }
                    }
                  }}
                  placeholder="Ex: 10"
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-right font-bold bg-yellow-100 dark:bg-[#1f2325] text-black dark:text-white"
                />
              </label>

              <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-2">
                Preço c/ IVA (MZN)
                <input
                  ref={priceInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceWithIvaStr}
                  onChange={(event) => setPriceWithIvaStr(event.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItemToGuide();
                    }
                  }}
                  placeholder="Ex: 928.00"
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-right font-mono text-blue-600 font-bold dark:bg-[#282c2e]"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addItemToGuide}
                  disabled={guideItems.length >= 99}
                  className="w-full rounded bg-[#003366] py-2 text-xs font-bold uppercase text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {article && (
              <div className="text-xs font-mono flex items-center gap-4 text-slate-600 dark:text-slate-300 pt-1">
                <span>Stock atual: <b>{article.stock}</b></span>
                <span>
                  Stock previsto após {type}:{' '}
                  <b className={expectedStock < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                    {expectedStock}
                  </b>
                </span>
              </div>
            )}
          </div>

          {/* Active Guide Items Table (up to 99 items) */}
          <div className="border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden">
            <div className="bg-[#f3f4f5] dark:bg-[#282c2e] px-3 py-2 text-xs font-bold uppercase flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
              <span>Artigos Inseridos na Guia ({guideItems.length} / 99)</span>
              {guideItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGuideItems([])}
                  className="text-red-600 hover:underline text-[11px] font-bold"
                >
                  Limpar Guia
                </button>
              )}
            </div>

            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-[#e7e8e9] dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2 text-center w-10">#</th>
                  <th className="p-2 text-left">Código Artigo</th>
                  <th className="p-2 text-left">Descrição Artigo</th>
                  <th className="p-2 text-right">Qtd.</th>
                  <th className="p-2 text-right">Stock Atual</th>
                  <th className="p-2 text-right">Stock Previsto</th>
                  <th className="p-2 text-right">Preço c/ IVA</th>
                  <th className="p-2 text-center w-16">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {guideItems.map((item, index) => {
                  const nextStock = type === 'entrada' ? item.currentStock + item.quantity : item.currentStock - item.quantity;
                  return (
                    <tr key={`${item.articleId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                      <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="p-2 font-bold text-[#003366] dark:text-[#a7c8ff]">{item.articleCode}</td>
                      <td className="p-2 font-sans font-medium">{item.articleDescription}</td>
                      <td className="p-2 text-right font-bold text-emerald-700 dark:text-emerald-400">{item.quantity}</td>
                      <td className="p-2 text-right">{item.currentStock}</td>
                      <td className="p-2 text-right font-bold">{nextStock}</td>
                      <td className="p-2 text-right">{item.priceWithIva ? formatMZN(item.priceWithIva) : '—'}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemFromGuide(index)}
                          className="text-red-600 hover:text-red-800 font-bold text-xs"
                          title="Remover artigo da guia"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {guideItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans italic text-xs">
                      Nenhum artigo inserido na guia. Pesquise e adicione até 99 artigos acima.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <p role="alert" className="rounded bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          {success && <p role="status" className="rounded bg-green-50 p-3 text-xs font-bold text-green-800">{success}</p>}

          {/* Bottom Confirmation Section */}
          <div className="flex justify-between items-center pt-2 border-t border-[#c3c6d1] dark:border-[#43474f]">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {guideItems.length > 0 ? `${guideItems.length} artigo(s) prontos para gravar na guia.` : 'Preencha a guia acima.'}
            </span>
            <button
              type="button"
              disabled={saving || (guideItems.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
              onClick={() => void submitGuide()}
              className="rounded bg-[#006e25] px-6 py-2.5 text-xs font-black uppercase text-white disabled:opacity-50 hover:brightness-110 shadow-md"
            >
              {saving ? 'A gravar guia na BD…' : `Confirmar Guia de ${type === 'entrada' ? 'Entrada' : 'Saída'} (F2)`}
            </button>
          </div>
        </section>
      )}

      {/* History of stock movements */}
      <section className={`overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-[#1f2325] ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none border-none p-6 overflow-auto bg-white dark:bg-[#1f2325]' : ''
      }`}>
        <div className="flex flex-wrap items-center justify-between border-b bg-slate-100 px-4 py-3 dark:bg-slate-800 gap-2">
          <div className="flex items-center space-x-3">
            <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
              Histórico de Movimentos de Stock ({filteredMovements.length})
            </h2>
            <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300">
              Stock Disponível Total: <b>{totalStockInSystem} UN</b>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={exportMovementsToCSV}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center space-x-1 uppercase transition-colors"
              title="Descarregar histórico de movimentos filtrados em formato Excel/CSV"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Baixar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3 py-1.5 rounded bg-[#003366] hover:bg-[#002244] text-white text-xs font-extrabold flex items-center space-x-1 uppercase transition-colors"
              title={isFullScreen ? 'Sair do modo Ecrã Inteiro' : 'Expandir tabela para Ecrã Inteiro'}
            >
              <span className="material-symbols-outlined text-sm">
                {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
              <span>{isFullScreen ? 'Sair Ecrã Inteiro' : 'Ecrã Inteiro'}</span>
            </button>
          </div>
        </div>

        {/* Date & Search Filter Bar */}
        <div className="p-3 bg-slate-50 dark:bg-[#282c2e] border-b flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">De:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-1 border rounded text-xs font-mono dark:bg-[#1f2325]"
              />
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Até:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-1 border rounded text-xs font-mono dark:bg-[#1f2325]"
              />
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Tipo:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="p-1 border rounded text-xs font-bold dark:bg-[#1f2325]"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Pesquisar:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Código, descrição ou guia..."
                className="p-1.5 border rounded text-xs w-64 dark:bg-[#1f2325]"
              />
            </div>

            {(dateFrom || dateTo || typeFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-red-600 hover:underline font-bold text-xs"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="text-[#737780] font-mono text-[11px]">
            Mostrando <b>{filteredMovements.length}</b> de <b>{movements.length}</b> registos
          </div>
        </div>

        {/* Movements Table */}
        {filteredMovements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-sans text-xs">
            Nenhum movimento de stock encontrado para os filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#f3f4f5] dark:bg-[#282c2e] text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300 border-b border-[#c3c6d1] dark:border-[#43474f]">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Documento / Guia</th>
                  <th className="p-3 text-left">Artigo (Código & Descrição)</th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400">Entrada</th>
                  <th className="p-3 text-right text-red-600 dark:text-red-400">Saída</th>
                  <th className="p-3 text-right text-blue-700 dark:text-blue-400">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {[...filteredMovements]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((item) => {
                    const matchedArt = articles.find((a) => a.code === item.articleCode);
                    const matchedDoc = documents.find(
                      (d) => d.displayNumber && item.docRef && item.docRef.includes(d.displayNumber)
                    );
                    const docDisplayRaw = item.docRef || (item.type === 'entrada' ? 'Entrada Directa por Guia' : 'Saída Directa por Guia');
                    const docDisplay = docDisplayRaw
                      .replace(/CUSTOMER_INVOICE/g, 'Factura FT')
                      .replace(/CASH_SALE/g, 'Venda a Dinheiro VD')
                      .replace(/CUSTOMER_DELIVERY_NOTE/g, 'Guia de Remessa GR')
                      .replace(/SUPPLIER_INVOICE/g, 'Factura Fornecedor')
                      .replace(/CUSTOMER_RECEIPT/g, 'Recibo')
                      .replace(/CUSTOMER_CREDIT_NOTE/g, 'Nota de Crédito NC')
                      .replace(/CREDIT_NOTE/g, 'Nota de Crédito NC');
                    const saldo = movementsWithSaldo.get(item.id) ?? (matchedArt?.stock ?? 0);
                    
                    // Format date only (no time: 04/08/2026)
                    const formattedDate = new Date(item.date).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-bold">
                          {formattedDate}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            item.type === 'entrada'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 border border-red-300'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">
                          {matchedDoc && onOpenDocument ? (
                            <button
                              type="button"
                              onClick={() => onOpenDocument(matchedDoc)}
                              className="text-[#000080] dark:text-yellow-300 font-extrabold hover:underline flex items-center gap-1"
                              title="Clique para consultar este documento"
                            >
                              <span>🔗</span> {docDisplay}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-800 dark:text-slate-200">{docDisplay}</span>
                          )}
                        </td>
                        <td className="p-3 font-bold">
                          {matchedArt ? (
                            <button
                              type="button"
                              onClick={() => setLedgerArticle(matchedArt)}
                              className="text-[#003366] dark:text-[#a7c8ff] hover:underline font-extrabold"
                              title="Clique para abrir o Extracto de Movimentos deste Artigo"
                            >
                              [{item.articleCode}] {item.articleDescription} 📊
                            </button>
                          ) : (
                            <span className="text-[#003366] dark:text-[#a7c8ff]">[{item.articleCode}] {item.articleDescription}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-emerald-700 dark:text-emerald-400">
                          {item.type === 'entrada' ? item.quantity : '—'}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-red-600 dark:text-red-400">
                          {item.type === 'saida' ? item.quantity : '—'}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-[#003366] dark:text-[#a7c8ff] bg-blue-50/50 dark:bg-blue-950/20">
                          {saldo}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Extracto Modal */}
      <ArticleLedgerModal
        isOpen={Boolean(ledgerArticle)}
        onClose={() => setLedgerArticle(null)}
        article={ledgerArticle}
        articles={articles}
        movements={movements}
        documents={documents}
        onOpenDocument={onOpenDocument}
        canViewCost={canViewCost}
        onSelectArticleId={(id) => {
          const found = articles.find((a) => a.id === id);
          if (found) setLedgerArticle(found);
        }}
      />
    </div>
  );
};
