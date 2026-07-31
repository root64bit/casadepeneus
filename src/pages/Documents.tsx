import { useMemo, useState } from 'react';
import type { DocumentRecord, SaleInvoice } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface DocumentsProps {
  documents: DocumentRecord[];
  sales: SaleInvoice[];
  onPrint: (sale: SaleInvoice) => void;
  onPrintRecord: (document: DocumentRecord) => void;
  canCancelAdvice?: boolean;
  onCancelAdvice?: (documentId: string, reason: string) => Promise<void>;
}

export function Documents({
  documents,
  sales,
  onPrint,
  onPrintRecord,
  canCancelAdvice,
  onCancelAdvice,
}: DocumentsProps) {
  const [search, setSearch] = useState('');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [status, setStatus] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Cancel Modal State
  const [cancellingDoc, setCancellingDoc] = useState<DocumentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesSearch =
        !term ||
        document.displayNumber.toLowerCase().includes(term) ||
        document.partyName.toLowerCase().includes(term) ||
        (document.partyCode && document.partyCode.toLowerCase().includes(term)) ||
        document.typeName.toLowerCase().includes(term);
      return (
        matchesSearch &&
        (partyType === 'ALL' || document.partyType === partyType) &&
        (status === 'ALL' || document.status === status) &&
        (typeFilter === 'ALL' || document.typeName === typeFilter || document.typeCode === typeFilter)
      );
    });
  }, [documents, partyType, search, status, typeFilter]);

  const handleExecuteCancel = async () => {
    if (!cancellingDoc || !cancelReason.trim() || !onCancelAdvice || isSubmittingCancel) return;
    try {
      setIsSubmittingCancel(true);
      setCancelError('');
      await onCancelAdvice(cancellingDoc.id, cancelReason.trim());
      setCancellingDoc(null);
      setCancelReason('');
    } catch (err: any) {
      setCancelError(err?.message || 'Falha ao cancelar aviso financeiro.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <section className="rounded border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">
              Pesquisar documentos
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, cliente, fornecedor ou tipo"
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Entidade</span>
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value as any)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todas</option>
              <option value="CUSTOMER">Clientes</option>
              <option value="SUPPLIER">Fornecedores</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todos os estados</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PAID">Pago</option>
              <option value="PARTIALLY_PAID">Parcialmente Pago</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Tipo de Documento</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="CUSTOMER_INVOICE">Factura a Cliente</option>
              <option value="CASH_SALE">Venda a Dinheiro</option>
              <option value="CUSTOMER_DELIVERY_NOTE">Guia de Remessa</option>
              <option value="CUSTOMER_CREDIT_ADVICE">Aviso de Crédito a Cliente</option>
              <option value="SUPPLIER_INVOICE">Factura de Fornecedor</option>
              <option value="SUPPLIER_CREDIT_ADVICE">Aviso de Crédito Fornecedor</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#e7e8e9] font-bold uppercase text-[#191c1d] dark:bg-[#282c2e] dark:text-[#e1e2e4]">
              <tr>
                <th className="p-3">Nº Documento</th>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Entidade</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Pago</th>
                <th className="p-3 text-right">Pendente</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {filtered.map((document) => {
                const printable = sales.find((sale) => sale.id === document.id);
                const isAdviceDoc = document.typeCode === 'CUSTOMER_CREDIT_ADVICE' || document.typeCode === 'SUPPLIER_CREDIT_ADVICE';
                const canCancelThisDoc = canCancelAdvice && isAdviceDoc && document.status === 'CONFIRMED';

                return (
                  <tr key={document.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                    <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {document.displayNumber}
                    </td>
                    <td className="p-3">{document.date}</td>
                    <td className="p-3 font-bold">{document.typeName || document.typeCode}</td>
                    <td className="p-3">{document.partyName}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatMZN(document.grandTotal)}</td>
                    <td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(document.paidAmount)}</td>
                    <td className="p-3 text-right font-mono text-[#ba1a1a]">{formatMZN(document.outstandingAmount)}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded px-2 py-1 text-[10px] font-black ${document.status === 'CANCELLED' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-[#e7e8e9] text-slate-800'}`}>
                        {document.status}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1">
                      <button
                        type="button"
                        onClick={() => printable ? onPrint(printable) : onPrintRecord(document)}
                        className="rounded bg-[#003366] px-2.5 py-1 font-bold text-white text-[11px] hover:bg-[#002244]"
                      >
                        Imprimir
                      </button>

                      {canCancelThisDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingDoc(document);
                            setCancelReason('');
                            setCancelError('');
                          }}
                          className="rounded bg-red-700 px-2 py-1 font-bold text-white text-[11px] hover:bg-red-800"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-[#737780]">
                    Nenhum documento corresponde aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cancellation Modal */}
      {cancellingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center space-x-2 border-b pb-3 text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined text-2xl">cancel</span>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Cancelar Aviso {cancellingDoc.displayNumber}
              </h3>
            </div>

            {cancelError && (
              <div className="p-3 rounded bg-red-100 border border-red-300 text-red-800 font-bold text-xs">
                ⚠️ {cancelError}
              </div>
            )}

            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-[#282c2e] p-3 rounded border">
              <div>Documento: <b>{cancellingDoc.displayNumber}</b></div>
              <div>Entidade: <b>{cancellingDoc.partyName}</b></div>
              <div>Total do Aviso: <b>{formatMZN(cancellingDoc.grandTotal)}</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Motivo Obrigatório de Cancelamento *
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Emissão por lapso, erro de cálculo..."
                className="w-full rounded border p-2 text-xs font-sans dark:bg-[#282c2e]"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => setCancellingDoc(null)}
                className="px-4 py-2 rounded border font-bold text-xs uppercase hover:bg-slate-100 dark:hover:bg-[#282c2e]"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isSubmittingCancel}
                onClick={handleExecuteCancel}
                className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase shadow disabled:opacity-50"
              >
                {isSubmittingCancel ? 'A Reverter...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
