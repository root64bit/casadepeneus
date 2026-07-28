import { useMemo, useState } from 'react';
import type { DocumentRecord, SaleInvoice } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface DocumentsProps {
  documents: DocumentRecord[];
  sales: SaleInvoice[];
  onPrint: (sale: SaleInvoice) => void;
  onPrintRecord: (document: DocumentRecord) => void;
}

export function Documents({ documents, sales, onPrint, onPrintRecord }: DocumentsProps) {
  const [search, setSearch] = useState('');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [status, setStatus] = useState('ALL');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesSearch =
        !term ||
        document.displayNumber.toLowerCase().includes(term) ||
        document.partyName.toLowerCase().includes(term) ||
        document.typeName.toLowerCase().includes(term);
      return (
        matchesSearch &&
        (partyType === 'ALL' || document.partyType === partyType) &&
        (status === 'ALL' || document.status === status)
      );
    });
  }, [documents, partyType, search, status]);

  return (
    <div className="space-y-5">
      <section className="rounded border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="grid gap-3 md:grid-cols-4">
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
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">
              Entidade
            </span>
            <select
              value={partyType}
              onChange={(event) => setPartyType(event.target.value as typeof partyType)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todos</option>
              <option value="CUSTOMER">Clientes</option>
              <option value="SUPPLIER">Fornecedores</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">
              Estado
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PARTIALLY_PAID">Parcialmente pago</option>
              <option value="PAID">Pago</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="REVERSED">Revertido</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <header className="flex items-center justify-between border-b border-[#c3c6d1] bg-[#e7e8e9] px-4 py-3 dark:border-[#43474f] dark:bg-[#282c2e]">
          <h2 className="flex items-center text-sm font-bold text-[#001e40] dark:text-[#a7c8ff]">
            <span className="material-symbols-outlined mr-2">description</span>
            Pesquisa de Documentos
          </h2>
          <span className="text-xs font-bold text-[#737780]">{filtered.length} registos</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[#c3c6d1] bg-[#f8f9fa] uppercase text-[#737780] dark:bg-[#282c2e]">
              <tr>
                <th className="p-3">Documento</th>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Entidade</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Pago</th>
                <th className="p-3 text-right">Pendente</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {filtered.map((document) => {
                const printable = sales.find((sale) => sale.id === document.id);
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
                      <span className="rounded bg-[#e7e8e9] px-2 py-1 text-[10px] font-black">
                        {document.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => printable ? onPrint(printable) : onPrintRecord(document)}
                        className="rounded bg-[#003366] px-2 py-1 font-bold text-white"
                      >
                        Imprimir
                      </button>
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
    </div>
  );
}
