import React, { useEffect, useMemo, useState } from 'react';
import type {
  Article,
  DocumentRecord,
  PurchaseInvoiceInput,
  PurchaseItem,
  Supplier,
  ReferenceOption,
} from '../types';
import { formatMZN } from '../stitch/stitchConfig';
import { ArticleSearchSelect } from '../components/ArticleSearchSelect';

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
  paymentTerms: ReferenceOption[];
}

export const Purchases: React.FC<PurchasesProps> = ({
  articles,
  suppliers,
  documents,
  canCreate,
  canPay,
  onCreateInvoice,
  onPayInvoice,
  paymentTerms,
}) => {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [supplierCodeInput, setSupplierCodeInput] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateFilter, setDateFilter] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [requisitionNo, setRequisitionNo] = useState('');
  const [term, setTerm] = useState(paymentTerms.find((item) => !item.requiresImmediatePayment)?.code ?? paymentTerms[0]?.code ?? '');
  const [articleId, setArticleId] = useState(articles[0]?.id ?? '');
  const [quantityStr, setQuantityStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [purchaseTaxRate, setPurchaseTaxRate] = useState<number>(articles[0]?.taxRate ?? 16);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState('');

  // Keep supplierCodeInput in sync when supplierId changes
  useEffect(() => {
    if (supplierId) {
      const found = suppliers.find((s) => s.id === supplierId);
      if (found) {
        setSupplierCodeInput(found.code || found.number || '');
      }
    }
  }, [supplierId, suppliers]);

  const supplierDocuments = useMemo(() => {
    let list = documents.filter((document) => document.typeCode.startsWith('SUPPLIER_'));
    if (dateFilter) {
      list = list.filter((doc) => doc.date.startsWith(dateFilter));
    }
    return list;
  }, [documents, dateFilter]);

  const total = items.reduce((sum, item) => sum + item.total, 0);

  const handleSupplierCodeChange = (query: string) => {
    setSupplierCodeInput(query);
    const clean = query.trim().toLowerCase();
    if (!clean) return;
    const found = suppliers.find(
      (s) => s.code?.toLowerCase() === clean || s.number?.toLowerCase() === clean || s.id.toLowerCase() === clean
    );
    if (found) {
      setSupplierId(found.id);
    }
  };

  const selectArticle = (id: string) => {
    setArticleId(id);
    const target = articles.find((article) => article.id === id);
    setUnitCostStr(target?.costPrice ? String(target.costPrice) : '');
    setPurchaseTaxRate(target?.taxRate ?? 16);
  };

  const addItem = () => {
    const article = articles.find((candidate) => candidate.id === articleId);
    const quantity = Number(quantityStr);
    const unitCost = Number(unitCostStr);
    if (!article || quantity <= 0 || isNaN(quantity) || isNaN(unitCost) || unitCost < 0) return;
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
        taxPercent: purchaseTaxRate,
        total: Math.round(net * (1 + purchaseTaxRate / 100) * 100) / 100,
      },
    ]);
    setQuantityStr('');
    setUnitCostStr('');
  };

  const saveInvoice = async () => {
    let currentItems = [...items];
    const quantity = Number(quantityStr);
    const unitCost = Number(unitCostStr);
    const pendingArticle = articles.find((candidate) => candidate.id === articleId);

    if (pendingArticle && quantity > 0 && !isNaN(quantity) && !isNaN(unitCost) && unitCost >= 0) {
      const net = quantity * unitCost;
      const newItem: PurchaseItem = {
        articleId: pendingArticle.id,
        code: pendingArticle.code,
        description: pendingArticle.description,
        quantity,
        unitCost,
        discountPercent: 0,
        taxPercent: purchaseTaxRate,
        total: Math.round(net * (1 + purchaseTaxRate / 100) * 100) / 100,
      };
      currentItems.push(newItem);
      setItems(currentItems);
      setQuantityStr('');
      setUnitCostStr('');
    }

    if (!supplierId || !supplierReference.trim() || currentItems.length === 0) {
      setError('Selecione o fornecedor, indique a referência e adicione pelo menos um artigo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreateInvoice({
        supplierId,
        date,
        supplierInvoiceNumber: requisitionNo ? `${supplierReference} (Req: ${requisitionNo})` : supplierReference,
        paymentTermCode: term,
        items: currentItems,
      });
      setItems([]);
      setSupplierReference('');
      setRequisitionNo('');
      setQuantityStr('');
      setUnitCostStr('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao confirmar a compra.');
    } finally {
      setSaving(false);
    }
  };

  const payInvoice = async (document: DocumentRecord) => {
    const amountToPay = document.outstandingAmount;
    if (amountToPay <= 0) return;

    setPayingId(document.id);
    setError('');
    try {
      await onPayInvoice(
        document,
        'CASH',
        amountToPay,
        '',
      );
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Falha ao pagar a factura.');
    } finally {
      setPayingId('');
    }
  };

  const handleSectionKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (items.length > 0 && !saving) void saveInvoice();
      return;
    }

    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' && !target.classList.contains('add-btn')) return;

      e.preventDefault();
      const section = e.currentTarget;
      const focusable = Array.from(
        section.querySelectorAll<HTMLElement>(
          'input:not([disabled]):not([readonly]), select:not([disabled]), button.add-btn'
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
        addItem();
      }
    }
  };

  const resetForm = () => {
    setItems([]);
    setSupplierReference('');
    setRequisitionNo('');
    setQuantityStr('');
    setUnitCostStr('');
    setError('');
  };

  // Global Keyboard shortcuts: F2=Gravar, F5/ESC=Novo/Sair, F9=Imprimir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void saveInvoice();
      } else if (e.key === 'F5' || e.key === 'Escape') {
        e.preventDefault();
        resetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, saving, quantityStr, unitCostStr, articleId, supplierId, supplierReference]);

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
        <section
          onKeyDown={handleSectionKeyDown}
          className="space-y-4 rounded-lg border border-[#c3c6d1] bg-white p-5 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]"
        >
          <div className="grid gap-3 md:grid-cols-5">
            <label className="text-xs font-bold uppercase">Código Fornecedor
              <input
                type="text"
                placeholder="Ex: F001"
                value={supplierCodeInput}
                onChange={(e) => handleSupplierCodeChange(e.target.value)}
                className="mt-1 w-full rounded border p-2 font-mono font-bold dark:bg-[#282c2e]"
              />
            </label>
            <label className="text-xs font-bold uppercase">Fornecedor
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]">
                <option value="">Selecionar…</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.code || supplier.number})</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Data
              <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setDateFilter(event.target.value); }} className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Factura do Fornecedor *
              <input required value={supplierReference} onChange={(event) => setSupplierReference(event.target.value)} placeholder="Nº Factura Fornecedor" className="mt-1 w-full rounded border p-2 font-mono dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Guia de Requisição
              <input value={requisitionNo} onChange={(event) => setRequisitionNo(event.target.value)} placeholder="Nº Requisição Casa de Pneus" className="mt-1 w-full rounded border p-2 font-mono dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Condição
              <select
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.stopPropagation();
                  }
                }}
                className="mt-1 w-full rounded border p-2 dark:bg-[#282c2e]"
              >
                {paymentTerms.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid items-end gap-3 md:grid-cols-[1fr_100px_140px_100px_auto]">
            <label className="text-xs font-bold uppercase">Artigo
              <ArticleSearchSelect
                articles={articles}
                selectedArticleId={articleId}
                onSelect={selectArticle}
                renderLabel={(a) => `${a.code} — ${a.description}`}
                placeholder="Pesquisar artigo…"
                className="mt-1"
              />
            </label>
            <label className="text-xs font-bold uppercase">Quantidade
              <input type="number" min="0.001" step="0.001" value={quantityStr} onChange={(event) => setQuantityStr(event.target.value)} placeholder="Ex: 10" className="mt-1 w-full rounded border p-2 text-right font-bold dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">Custo sem IVA
              <input type="number" min="0" step="0.01" value={unitCostStr} onChange={(event) => setUnitCostStr(event.target.value)} placeholder="Ex: 2500.00" className="mt-1 w-full rounded border p-2 text-right font-mono font-bold dark:bg-[#282c2e]" />
            </label>
            <label className="text-xs font-bold uppercase">IVA %
              <input type="number" min="0" max="100" step="0.01" value={purchaseTaxRate} onChange={(event) => setPurchaseTaxRate(Number(event.target.value))} className="mt-1 w-full rounded border p-2 text-center font-bold dark:bg-[#282c2e]" />
            </label>
            <button type="button" onClick={addItem} className="add-btn rounded bg-[#003366] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-blue-800">Adicionar</button>
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
            <button
              disabled={saving || (items.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
              onClick={() => void saveInvoice()}
              className="rounded bg-[#006e25] px-5 py-3 text-xs font-bold uppercase text-white disabled:opacity-50 hover:bg-green-700"
            >
              {saving ? 'A confirmar…' : 'Gravar Fatura (F2)'}
            </button>
          </div>
        </section>
      )}

      {!canCreate && <p className="rounded border bg-white p-4 text-sm">O seu perfil permite consultar compras, mas não criar ou confirmar facturas.</p>}

      <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325] pb-16">
        <div className="flex flex-wrap items-center justify-between border-b p-4 gap-2">
          <h3 className="font-bold">Documentos de fornecedor</h3>
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span>Filtrar por Data:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded border p-1 font-normal dark:bg-[#282c2e]"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-red-600 hover:underline text-xs">Ver Todos</button>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#f3f4f5] text-xs uppercase dark:bg-[#282c2e]"><tr><th className="p-3 text-left">Documento</th><th className="p-3 text-left">Fornecedor</th><th className="p-3 text-left">Estado</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Pendente</th><th /></tr></thead>
          <tbody>{supplierDocuments.map((document) => <tr key={document.id} className="border-t"><td className="p-3 font-mono">{document.displayNumber}</td><td className="p-3">{document.partyName}</td><td className="p-3">{document.status}</td><td className="p-3 text-right">{formatMZN(document.grandTotal)}</td><td className="p-3 text-right font-bold">{formatMZN(document.outstandingAmount)}</td><td className="p-3 text-right">{canPay && document.outstandingAmount > 0 && <button disabled={payingId === document.id} onClick={() => void payInvoice(document)} className="rounded bg-[#003366] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{payingId === document.id ? 'A pagar…' : 'Pagar'}</button>}</td></tr>)}</tbody>
        </table>
        {supplierDocuments.length === 0 && <p className="p-6 text-center text-sm text-[#737780]">Sem documentos de fornecedor para a data selecionada.</p>}
      </section>

      {/* Bottom Status Bar */}
      <div className="mt-4 rounded border border-[#c3c6d1] bg-[#e7e8e9] dark:border-[#43474f] dark:bg-[#282c2e] px-4 py-2 text-xs font-mono font-bold flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3 text-[#191c1d] dark:text-white">
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            title="Limpar formulário e cancelar entrada atual"
          >
            ESC=Sair
          </button>
          <button
            type="button"
            onClick={() => void saveInvoice()}
            disabled={saving || (items.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
            className="rounded bg-[#003366] px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            title="Gravar factura de compra"
          >
            F2=Gravar
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            title="Iniciar nova entrada de factura de compra"
          >
            F5=Novo
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-[#003366] px-3 py-1 text-white hover:bg-blue-800 transition-colors cursor-pointer"
            title="Imprimir ecrã"
          >
            F9=Imp
          </button>
        </div>
        <div className="text-[#737780] text-[11px]">
          Fatura de Fornecedor | Itens: <b>{items.length}</b> | Total: <b className="text-[#191c1d] dark:text-white">{formatMZN(total)}</b>
        </div>
      </div>
    </div>
  );
};
