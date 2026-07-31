import React, { useEffect, useMemo, useState } from 'react';
import type { AccessScope, Article, StockMovement } from '../types';
import { ArticleSearchSelect } from '../components/ArticleSearchSelect';

interface StockMovementsProps {
  movements: StockMovement[];
  articles: Article[];
  warehouses: AccessScope[];
  operatorName: string;
  onAddMovement: (movement: StockMovement) => Promise<void>;
  canPostEntry: boolean;
  canPostExit: boolean;
}

export const StockMovements: React.FC<StockMovementsProps> = ({
  movements, articles, warehouses, operatorName, onAddMovement, canPostEntry, canPostExit,
}) => {
  const [type, setType] = useState<'entrada' | 'saida'>(canPostEntry ? 'entrada' : 'saida');
  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [guideNumber, setGuideNumber] = useState('');
  const [priceWithIvaStr, setPriceWithIvaStr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const article = useMemo(() => articles.find((item) => item.id === articleId), [articles, articleId]);
  const quantity = Number(quantityStr) || 0;
  const expectedStock = article ? article.stock + (type === 'entrada' ? quantity : -quantity) : 0;

  useEffect(() => { if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id); }, [warehouses, warehouseId]);
  useEffect(() => { if (!articleId && articles[0]) setArticleId(articles[0].id); }, [articles, articleId]);
  useEffect(() => { if (!canPostEntry && canPostExit) setType('saida'); }, [canPostEntry, canPostExit]);

  useEffect(() => {
    if (article) {
      setPriceWithIvaStr(article.sellPriceWithIva ? String(article.sellPriceWithIva) : '');
    }
  }, [article]);

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'F2') {
      e.preventDefault();
      e.currentTarget.requestSubmit();
      return;
    }

    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' && (target as HTMLButtonElement).type === 'submit') {
        return;
      }

      e.preventDefault();
      const form = e.currentTarget;
      const focusable = Array.from(
        form.querySelectorAll<HTMLElement>(
          'select:not([disabled]), input:not([disabled]):not([readonly]), textarea:not([disabled]), button[type="submit"]'
        )
      ).filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);

      const index = focusable.indexOf(target);
      if (index > -1 && index < focusable.length - 1) {
        const nextEl = focusable[index + 1];
        nextEl.focus();
        if (nextEl instanceof HTMLInputElement) {
          nextEl.select?.();
        }
      } else {
        form.requestSubmit();
      }
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!article || !warehouseId || quantity <= 0) return;
    if (type === 'saida' && expectedStock < 0) {
      setError('A saída excede o stock disponível.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await onAddMovement({
        id: '',
        type,
        warehouseId,
        warehouseName: warehouses.find((item) => item.id === warehouseId)?.name,
        docRef: guideNumber ? `Guia: ${guideNumber}` : '—',
        date: new Date().toISOString(),
        articleCode: article.code,
        articleDescription: article.description,
        quantity,
        entityName: '',
        operator: operatorName,
        reason: type === 'entrada' ? 'Entrada direta por Guia' : 'Saída direta de stock',
        notes: [
          priceWithIvaStr ? `Preço Compra c/ IVA: ${priceWithIvaStr} MZN` : '',
          notes,
        ].filter(Boolean).join(' | '),
      });
      setGuideNumber('');
      setQuantityStr('');
      setNotes('');
      setSuccess('Movimento de stock registado com sucesso.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registar movimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {(canPostEntry || canPostExit) && (
        <section className="rounded-lg border bg-white p-4 shadow-sm dark:bg-[#1f2325] sm:p-5">
          <h2 className="mb-4 text-sm font-black text-primary dark:text-blue-200 uppercase">Registar Movimento de Stock</h2>
          <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <label className="font-bold text-xs uppercase">Operação
              <select value={type} onChange={(event) => setType(event.target.value as 'entrada' | 'saida')} className="mt-1 w-full rounded border p-2.5 dark:bg-[#282c2e]">
                {canPostEntry && <option value="entrada">Entrada direta</option>}
                {canPostExit && <option value="saida">Saída direta</option>}
              </select>
            </label>

            <label className="font-bold text-xs uppercase sm:col-span-2">Código do Artigo (Pesquisa por Código)
              <ArticleSearchSelect
                articles={articles}
                selectedArticleId={articleId}
                onSelect={setArticleId}
                searchByCodeOnly={true}
                placeholder="Introduza o Código do Artigo (ex: ART-001)…"
                className="mt-1"
              />
            </label>

            <label className="font-bold text-xs uppercase">Quantidade
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={quantityStr}
                onChange={(event) => setQuantityStr(event.target.value)}
                placeholder="Ex: 10"
                className="mt-1 w-full rounded border p-2 text-right font-bold dark:bg-[#282c2e]"
              />
            </label>

            <label className="font-bold text-xs uppercase">Número da Guia
              <input
                type="text"
                value={guideNumber}
                onChange={(event) => setGuideNumber(event.target.value)}
                placeholder="Ex: GUIA-2026/001"
                className="mt-1 w-full rounded border p-2 font-mono uppercase dark:bg-[#282c2e]"
              />
            </label>

            <label className="font-bold text-xs uppercase">Preço Compra c/ IVA (MZN)
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceWithIvaStr}
                onChange={(event) => setPriceWithIvaStr(event.target.value)}
                placeholder="Ex: 3200.00"
                className="mt-1 w-full rounded border p-2 text-right font-mono text-blue-600 font-bold dark:bg-[#282c2e]"
              />
            </label>

            <label className="font-bold text-xs uppercase">Operador
              <input readOnly value={operatorName} className="mt-1 w-full rounded border bg-slate-100 p-2 dark:bg-slate-800" />
            </label>

            <label className="font-bold text-xs uppercase sm:col-span-2 xl:col-span-4">Observações
              <input maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas adicionais do movimento..." className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]" />
            </label>

            <div className="rounded bg-slate-100 p-3 text-xs sm:col-span-2 xl:col-span-3 dark:bg-slate-800 flex items-center justify-between font-mono">
              <span>Stock atual: <b>{article?.stock ?? 0}</b></span>
              <span>Stock previsto após {type}: <b className={expectedStock < 0 ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>{expectedStock}</b></span>
            </div>

            <button
              type="submit"
              disabled={saving || !articleId || quantity <= 0}
              className="rounded bg-[#006e25] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50 hover:brightness-110 shadow"
            >
              {saving ? 'A registar…' : 'Confirmar Movimento (F2)'}
            </button>

            {error && <p role="alert" className="rounded bg-red-50 p-3 text-xs font-bold text-red-700 sm:col-span-2 xl:col-span-4">{error}</p>}
            {success && <p role="status" className="rounded bg-green-50 p-3 text-xs font-bold text-green-800 sm:col-span-2 xl:col-span-4">{success}</p>}
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-[#1f2325]">
        <div className="flex items-center justify-between border-b bg-slate-100 px-4 py-3 dark:bg-slate-800">
          <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
            Histórico de movimentos de stock ({movements.length})
          </h2>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            ● Dados em tempo real (Supabase)
          </span>
        </div>
        {movements.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Sem movimentos para apresentar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 uppercase font-bold dark:bg-slate-800">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Documento / Guia</th>
                  <th className="p-3">Artigo</th>
                  <th className="p-3 text-right">Quantidade</th>
                  <th className="p-3">Operador</th>
                </tr>
              </thead>
              <tbody className="font-mono divide-y">
                {[...movements]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {new Date(item.date).toLocaleString('pt-PT')}
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
                      <td className="p-3 font-semibold">{item.docRef || '—'}</td>
                      <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">
                        [{item.articleCode}] {item.articleDescription}
                      </td>
                      <td className="p-3 text-right font-black text-sm">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {item.operator || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
