import { useMemo, useState } from 'react';
import type { Client, DocumentRecord, LedgerRecord, PaymentRecord } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface AccountsProps {
  payments: PaymentRecord[];
  ledger: LedgerRecord[];
  clients?: Client[];
  documents?: DocumentRecord[];
  onPrintPayment: (payment: PaymentRecord) => void;
  onReceiveDocument?: (document: DocumentRecord) => void;
  onPayDocument?: (document: DocumentRecord) => void;
  canReceive?: boolean;
  canPay?: boolean;
}

export function Accounts({
  payments,
  ledger,
  documents = [],
  onPrintPayment,
  onReceiveDocument,
  onPayDocument,
  canReceive = false,
  canPay = false,
}: AccountsProps) {
  const [view, setView] = useState<'open' | 'payments' | 'ledger'>('open');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const openDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return documents.filter((document) => {
      const isReceivable = document.partyType === 'CUSTOMER' && document.typeCode === 'CUSTOMER_INVOICE';
      const isPayable = document.partyType === 'SUPPLIER' && ['SUPPLIER_INVOICE', 'SUPPLIER_OPENING_BALANCE'].includes(document.typeCode);
      const matchesParty = partyType === 'ALL' || document.partyType === partyType;
      const matchesSearch = !term
        || document.displayNumber.toLowerCase().includes(term)
        || document.partyName.toLowerCase().includes(term)
        || (document.partyCode || '').toLowerCase().includes(term);
      return (isReceivable || isPayable)
        && document.outstandingAmount > 0
        && !['CANCELLED', 'REVERSED'].includes(document.status)
        && matchesParty
        && matchesSearch;
    });
  }, [documents, partyType, searchTerm]);

  const filteredPayments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesParty = partyType === 'ALL'
        || (partyType === 'CUSTOMER' && payment.direction === 'CUSTOMER_RECEIPT')
        || (partyType === 'SUPPLIER' && payment.direction === 'SUPPLIER_PAYMENT');
      const matchesSearch = !term
        || payment.displayNumber.toLowerCase().includes(term)
        || payment.partyName.toLowerCase().includes(term);
      return matchesParty && matchesSearch;
    });
  }, [partyType, payments, searchTerm]);

  const runningBalances = useMemo(() => {
    const balances = new Map<string, number>();
    const byEntry = new Map<string, number>();
    [...ledger].sort((a, b) => a.date.localeCompare(b.date)).forEach((entry) => {
      const key = `${entry.partyType}:${entry.partyName}`;
      const movement = entry.partyType === 'CUSTOMER'
        ? entry.debitAmount - entry.creditAmount
        : entry.creditAmount - entry.debitAmount;
      const next = Math.round(((balances.get(key) || 0) + movement) * 100) / 100;
      balances.set(key, next);
      byEntry.set(entry.id, next);
    });
    return byEntry;
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ledger.filter((entry) => {
      const matchesParty = partyType === 'ALL' || entry.partyType === partyType;
      return matchesParty && (!term || entry.partyName.toLowerCase().includes(term) || entry.entryType.toLowerCase().includes(term));
    });
  }, [ledger, partyType, searchTerm]);

  const receivableTotal = openDocuments
    .filter((document) => document.partyType === 'CUSTOMER')
    .reduce((sum, document) => sum + document.outstandingAmount, 0);
  const payableTotal = openDocuments
    .filter((document) => document.partyType === 'SUPPLIER')
    .reduce((sum, document) => sum + document.outstandingAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#c3c6d1] bg-white p-4 dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="flex flex-wrap gap-2">
          {([
            ['open', 'Contas a receber/pagar'],
            ['payments', 'Pagamentos e recibos'],
            ['ledger', 'Contas correntes'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`rounded px-4 py-2 text-xs font-black uppercase ${view === key ? 'bg-[#003366] text-white' : 'bg-[#e7e8e9]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Pesquisar por código, nome ou nº..." className="w-full min-w-0 rounded border border-[#c3c6d1] bg-white px-3 py-2 text-xs dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white sm:min-w-[220px]" />
          <select value={partyType} onChange={(event) => setPartyType(event.target.value as typeof partyType)} className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e] sm:w-auto">
            <option value="ALL">Clientes e fornecedores</option>
            <option value="CUSTOMER">Clientes</option>
            <option value="SUPPLIER">Fornecedores</option>
          </select>
        </div>
      </div>

      {view === 'open' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800"><span className="block text-xs font-black uppercase">Total a receber</span><strong className="font-mono text-xl">{formatMZN(receivableTotal)}</strong></div>
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-900"><span className="block text-xs font-black uppercase">Total a pagar</span><strong className="font-mono text-xl">{formatMZN(payableTotal)}</strong></div>
        </div>
      )}

      <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="overflow-x-auto">
          {view === 'open' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]"><tr><th className="p-3">Documento</th><th className="p-3">Data</th><th className="p-3">Direção</th><th className="p-3">Entidade</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Pago</th><th className="p-3 text-right">Pendente</th><th className="p-3">Estado</th><th className="p-3">Ação</th></tr></thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {openDocuments.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-[#737780]">Não existem documentos pendentes para este filtro.</td></tr> : openDocuments.map((document) => (
                  <tr key={document.id}>
                    <td className="p-3 font-mono font-bold">{document.displayNumber}</td><td className="p-3">{document.date}</td><td className="p-3">{document.partyType === 'CUSTOMER' ? 'A receber' : 'A pagar'}</td><td className="p-3 font-bold">{document.partyName}</td><td className="p-3 text-right font-mono">{formatMZN(document.grandTotal)}</td><td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(document.paidAmount)}</td><td className="p-3 text-right font-mono font-bold text-[#ba1a1a]">{formatMZN(document.outstandingAmount)}</td><td className="p-3">{document.status}</td>
                    <td className="p-3">{document.partyType === 'CUSTOMER' ? <button disabled={!canReceive} onClick={() => onReceiveDocument?.(document)} className="rounded bg-[#006e25] px-3 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Receber</button> : <button disabled={!canPay} onClick={() => onPayDocument?.(document)} className="rounded bg-[#ba1a1a] px-3 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Pagar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : view === 'payments' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]"><tr><th className="p-3">Número</th><th className="p-3">Data</th><th className="p-3">Direção</th><th className="p-3">Entidade</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Alocado</th><th className="p-3 text-right">Não aplicado</th><th className="p-3">Estado</th><th className="p-3">Ação</th></tr></thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {filteredPayments.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-[#737780]">Ainda não existem pagamentos ou recibos registados.</td></tr> : filteredPayments.map((payment) => (
                  <tr key={payment.id}><td className="p-3 font-mono font-bold">{payment.displayNumber}</td><td className="p-3">{payment.date}</td><td className="p-3">{payment.direction === 'CUSTOMER_RECEIPT' ? 'Recebimento' : 'Pagamento'}</td><td className="p-3 font-bold">{payment.partyName}</td><td className="p-3 text-right font-mono">{formatMZN(payment.totalAmount)}</td><td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(payment.allocatedAmount)}</td><td className="p-3 text-right font-mono text-[#ba1a1a]">{formatMZN(payment.unappliedAmount)}</td><td className="p-3">{payment.status}</td><td className="p-3"><button onClick={() => onPrintPayment(payment)} className="rounded bg-[#003366] px-2 py-1 font-bold text-white">Imprimir</button></td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]"><tr><th className="p-3">Data</th><th className="p-3">Entidade</th><th className="p-3">Tipo</th><th className="p-3 text-right">Débito</th><th className="p-3 text-right">Crédito</th><th className="p-3 text-right">Saldo</th><th className="p-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {filteredLedger.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-[#737780]">Ainda não existem lançamentos para este filtro.</td></tr> : filteredLedger.map((entry) => (
                  <tr key={entry.id}><td className="p-3">{entry.date}</td><td className="p-3 font-bold">{entry.partyName}</td><td className="p-3">{entry.entryType}</td><td className="p-3 text-right font-mono">{formatMZN(entry.debitAmount)}</td><td className="p-3 text-right font-mono">{formatMZN(entry.creditAmount)}</td><td className="p-3 text-right font-mono font-bold">{formatMZN(runningBalances.get(entry.id) || 0)}</td><td className="p-3">{entry.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
