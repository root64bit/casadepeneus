import React, { useEffect, useMemo, useState } from 'react';
import type { AccessScope, Article, StockMovement } from '../types';

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
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const article = useMemo(() => articles.find((item) => item.id === articleId), [articles, articleId]);
  const expectedStock = article ? article.stock + (type === 'entrada' ? quantity : -quantity) : 0;

  useEffect(() => { if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id); }, [warehouses, warehouseId]);
  useEffect(() => { if (!articleId && articles[0]) setArticleId(articles[0].id); }, [articles, articleId]);
  useEffect(() => { if (!canPostEntry && canPostExit) setType('saida'); }, [canPostEntry, canPostExit]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!article || !warehouseId) return;
    if (type === 'saida' && expectedStock < 0) {
      setError('A saída excede o stock disponível.');
      return;
    }
    const confirmed = window.confirm(`Confirmar ${type} de ${quantity} unidade(s) de ${article.code}? Stock previsto: ${expectedStock}.`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await onAddMovement({
        id: '', type, warehouseId, warehouseName: warehouses.find((item) => item.id === warehouseId)?.name,
        docRef: reference, date: new Date().toISOString(), articleCode: article.code,
        articleDescription: article.description, quantity, entityName: '', operator: operatorName,
        reason, notes,
      });
      setReason('');
      setReference('');
      setNotes('');
      setQuantity(1);
      setSuccess('Movimento registado e confirmado no stock.');
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
          <h2 className="mb-4 text-sm font-black text-primary dark:text-blue-200">Registar entrada ou saída direta</h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <label className="font-bold">Operação<select value={type} onChange={(event) => setType(event.target.value as 'entrada' | 'saida')} className="mt-1 w-full rounded border p-3 dark:bg-slate-800">{canPostEntry && <option value="entrada">Entrada direta</option>}{canPostExit && <option value="saida">Saída direta</option>}</select></label>
            <label className="font-bold">Armazém<select required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-1 w-full rounded border p-3 dark:bg-slate-800"><option value="">Selecione</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
            <label className="font-bold sm:col-span-2">Artigo<select required value={articleId} onChange={(event) => setArticleId(event.target.value)} className="mt-1 w-full rounded border p-3 dark:bg-slate-800"><option value="">Selecione</option>{articles.map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.description} · Stock {item.stock}</option>)}</select></label>
            <label className="font-bold">Quantidade<input required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded border p-3 dark:bg-slate-800" /></label>
            <label className="font-bold">Motivo<input required maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo operacional" className="mt-1 w-full rounded border p-3 dark:bg-slate-800" /></label>
            <label className="font-bold">Referência opcional<input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 w-full rounded border p-3 dark:bg-slate-800" /></label>
            <label className="font-bold">Utilizador<input readOnly value={operatorName} className="mt-1 w-full rounded border bg-slate-100 p-3 dark:bg-slate-800" /></label>
            <label className="font-bold sm:col-span-2 xl:col-span-4">Notas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded border p-3 dark:bg-slate-800" /></label>
            <div className="rounded bg-slate-100 p-3 text-sm sm:col-span-2 xl:col-span-3 dark:bg-slate-800">Stock atual: <b>{article?.stock ?? 0}</b> · Stock previsto: <b className={expectedStock < 0 ? 'text-red-700' : ''}>{expectedStock}</b></div>
            <button disabled={saving || !articleId || !warehouseId || !reason.trim() || quantity <= 0} className="rounded bg-primary px-4 py-3 font-black text-white disabled:opacity-50">{saving ? 'A registar…' : 'Confirmar movimento'}</button>
            {error && <p role="alert" className="rounded bg-red-50 p-3 font-bold text-red-700 sm:col-span-2 xl:col-span-4">{error}</p>}
            {success && <p role="status" className="rounded bg-green-50 p-3 font-bold text-green-800 sm:col-span-2 xl:col-span-4">{success}</p>}
          </form>
        </section>
      )}
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-[#1f2325]">
        <h2 className="border-b bg-slate-100 px-4 py-3 text-sm font-black uppercase dark:bg-slate-800">Histórico de movimentos</h2>
        {movements.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Sem movimentos para apresentar.</p> : (
          <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead><tr className="border-b bg-slate-50 uppercase dark:bg-slate-800"><th className="p-3">Data</th><th className="p-3">Tipo</th><th className="p-3">Referência</th><th className="p-3">Artigo</th><th className="p-3 text-right">Quantidade</th><th className="p-3">Operador</th></tr></thead><tbody>{movements.map((item) => <tr key={item.id} className="border-b"><td className="p-3">{new Date(item.date).toLocaleString('pt-PT')}</td><td className="p-3 font-bold">{item.type}</td><td className="p-3">{item.docRef || '—'}</td><td className="p-3">[{item.articleCode}] {item.articleDescription}</td><td className="p-3 text-right font-bold">{item.quantity}</td><td className="p-3">{item.operator || '—'}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
};
