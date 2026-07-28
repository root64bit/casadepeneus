import React, { useMemo, useState } from 'react';
import type {
  Article,
  DocumentRecord,
  PurchaseInvoiceInput,
  PurchaseItem,
  Supplier,
} from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface PurchasesProps {
  articles: Article[];
  suppliers: Supplier[];
  documents: DocumentRecord[];
  canCreate: boolean;
  canPay: boolean;
  onCreateInvoice: (invoice: PurchaseInvoiceInput) => Promise<DocumentRecord>;
  onPayInvoice: (
    document: DocumentRecord,
    method: 'CASH' | 'BANK_TRANSFER',
    amount: number,
    reference: string,
  ) => Promise<void>;
}

export const Purchases: React.FC<PurchasesProps> = ({
  articles,
  suppliers,
  documents,
  canCreate,
  canPay,
  onCreateInvoice,
  onPayInvoice,
}) => {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierReference, setSupplierReference] = useState('');
  const [term, setTerm] = useState<'DINHEIRO' | '30_DIAS'>('30_DIAS');
  const [articleId, setArticleId] = useState(articles[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(articles[0]?.costPrice ?? 0);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState('');

  const supplierDocuments = useMemo(
    () => documents.filter((document) => document.typeCode.startsWith('SUPPLIER_')),
    [documents],
  );
  const total = items.reduce((sum, item) => sum + item.total, 0);

  const selectArticle = (id: string) => {
    setArticleId(id);
    setUnitCost(articles.find((article) => article.id === id)?.costPrice ?? 0);
  };

  const addItem = () => {
    const article = articles.find((candidate) => candidate.id === articleId);
    if (!article || quantity <= 0 || unitCost < 0) return;
    const net = quantity * unitCost;
    setItems((current) => [
      ...current,
      {
        articleId: article.id,
        code: article.code,
        description: article.description,
        quantity,
        unitCost,
        discountPercent: 0,
        taxPercent: 16,
        total: Math.round(net * 1.16 * 100) / 100,
      },
    ]);
    setQuantity(1);
  };

  const saveInvoice = async () => {
    if (!supplierId || !supplierReference.trim() || items.length === 0) {
      setError('Selecione o fornecedor, indique a referência e adicione pelo menos um artigo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreateInvoice({
        supplierId,
        date,
        supplierInvoiceNumber: supplierReference,
        paymentTermCode: term,
        items,
      });
      setItems([]);
      setSupplierReference('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao confirmar a compra.');
    } finally {
      setSaving(false);
    }
  };

  const payInvoice = async (document: DocumentRecord) => {
    const reference = window.prompt('Referência da transferência (deixe vazio para numerário):', '');
    if (reference === null) return;
    setPayingId(document.id);
    setError('');
    try {
      await onPayInvoice(
        document,
        reference.trim() ? 'BANK_TRANSFER' : 'CASH',
        document.outstandingAmount,
        reference,
      );
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Falha ao pagar a factura.');
    } finally {
      setPayingId('');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-[#a7c8ff]">
          Compras a Fornecedores
        </h2>
        <p className="text-sm text-[#737780]">
          Registo de facturas, entrada automática em stock e contas a pagar.
        </p>
      </header>

      {canCreate && (
        <section className="space-y-4 rounded-lg border border-[#c3c6d1] bg-white p-5 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs font-bold uppercase">Fornecedor
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]">
                <option value="">Selecionar…</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Data
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Factura do fornecedor
              <input value={supplierReference} onChange={(event) => setSupplierReference(event.target.value)} placeholder="TEST-FORN-001" className="mt-1 w-full rounded border p-2 font-mono dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Condição
              <select value={term} onChange={(event) => setTerm(event.target.value as 'DINHEIRO' | '30_DIAS')} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]">
                <option value="30_DIAS">Crédito 30 dias</option>
                <option value="DINHEIRO">Pronto pagamento</option>
              </select>
            </label>
          </div>

          <div className="grid items-end gap-3 md:grid-cols-[1fr_120px_160px_auto]">
            <label className="text-xs font-bold uppercase">Artigo
              <select value={articleId} onChange={(event) => selectArticle(event.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]">
                {articles.map((article) => <option key={article.id} value={article.id}>{article.code} — {article.description}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Quantidade
              <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded border p-2 text-right dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Custo sem IVA
              <input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} className="mt-1 w-full rounded border p-2 text-right dark:bg-[#282c2e]" />
            </label>
            <button type="button" onClick={addItem} className="rounded bg-[#003366] px-4 py-2 text-xs font-bold uppercase text-white">Adicionar</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f3f4f5] text-xs uppercase dark:bg-[#282c2e]"><tr><th className="p-2 text-left">Artigo</th><th className="p-2 text-right">Qtd.</th><th className="p-2 text-right">Custo</th><th className="p-2 text-right">Total c/ IVA</th><th /></tr></thead>
              <tbody>{items.map((item, index) => <tr key={`${item.articleId}-${index}`} className="border-b"><td className="p-2">{item.code} — {item.description}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right">{formatMZN(item.unitCost)}</td><td className="p-2 text-right font-bold">{formatMZN(item.total)}</td><td><button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-700">Remover</button></td></tr>)}</tbody>
            </table>
          </div>
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          <div className="flex items-center justify-end gap-4">
            <strong className="font-mono text-xl">{formatMZN(total)}</strong>
            <button disabled={saving || items.length === 0} onClick={() => void saveInvoice()} className="rounded bg-[#006e25] px-5 py-3 text-xs font-bold uppercase text-white disabled:opacity-50">{saving ? 'A confirmar…' : 'Confirmar factura'}</button>
          </div>
        </section>
      )}

      {!canCreate && <p className="rounded border bg-white p-4 text-sm">O seu perfil permite consultar compras, mas não criar ou confirmar facturas.</p>}

      <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325]">
        <h3 className="border-b p-4 font-bold">Documentos de fornecedor</h3>
        <table className="w-full text-sm">
          <thead className="bg-[#f3f4f5] text-xs uppercase dark:bg-[#282c2e]"><tr><th className="p-3 text-left">Documento</th><th className="p-3 text-left">Fornecedor</th><th className="p-3 text-left">Estado</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Pendente</th><th /></tr></thead>
          <tbody>{supplierDocuments.map((document) => <tr key={document.id} className="border-t"><td className="p-3 font-mono">{document.displayNumber}</td><td className="p-3">{document.partyName}</td><td className="p-3">{document.status}</td><td className="p-3 text-right">{formatMZN(document.grandTotal)}</td><td className="p-3 text-right font-bold">{formatMZN(document.outstandingAmount)}</td><td className="p-3 text-right">{canPay && document.outstandingAmount > 0 && <button disabled={payingId === document.id} onClick={() => void payInvoice(document)} className="rounded bg-[#003366] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{payingId === document.id ? 'A pagar…' : 'Pagar'}</button>}</td></tr>)}</tbody>
        </table>
        {supplierDocuments.length === 0 && <p className="p-6 text-center text-sm text-[#737780]">Sem documentos de fornecedor.</p>}
      </section>
    </div>
  );
};
