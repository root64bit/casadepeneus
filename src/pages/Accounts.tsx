import { useMemo, useState } from 'react';
import type { LedgerRecord, PaymentRecord } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface AccountsProps {
  payments: PaymentRecord[];
  ledger: LedgerRecord[];
  onPrintPayment: (payment: PaymentRecord) => void;
}

export function Accounts({ payments, ledger, onPrintPayment }: AccountsProps) {
  const [view, setView] = useState<'payments' | 'ledger'>('payments');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          partyType === 'ALL' ||
          (partyType === 'CUSTOMER' && payment.direction === 'CUSTOMER_RECEIPT') ||
          (partyType === 'SUPPLIER' && payment.direction === 'SUPPLIER_PAYMENT'),
      ),
    [partyType, payments],
  );
  const filteredLedger = useMemo(
    () => ledger.filter((entry) => partyType === 'ALL' || entry.partyType === partyType),
    [ledger, partyType],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#c3c6d1] bg-white p-4 dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="flex gap-2">
          <button
            onClick={() => setView('payments')}
            className={`rounded px-4 py-2 text-xs font-black uppercase ${view === 'payments' ? 'bg-[#003366] text-white' : 'bg-[#e7e8e9]'}`}
          >
            Pagamentos e recibos
          </button>
          <button
            onClick={() => setView('ledger')}
            className={`rounded px-4 py-2 text-xs font-black uppercase ${view === 'ledger' ? 'bg-[#003366] text-white' : 'bg-[#e7e8e9]'}`}
          >
            Contas correntes
          </button>
        </div>
        <select
          value={partyType}
          onChange={(event) => setPartyType(event.target.value as typeof partyType)}
          className="rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
        >
          <option value="ALL">Clientes e fornecedores</option>
          <option value="CUSTOMER">Clientes</option>
          <option value="SUPPLIER">Fornecedores</option>
        </select>
      </div>

      <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="overflow-x-auto">
          {view === 'payments' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]">
                <tr>
                  <th className="p-3">Número</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Direção</th>
                  <th className="p-3">Entidade</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Alocado</th>
                  <th className="p-3 text-right">Não aplicado</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="p-3 font-mono font-bold">{payment.displayNumber}</td>
                    <td className="p-3">{payment.date}</td>
                    <td className="p-3">{payment.direction}</td>
                    <td className="p-3 font-bold">{payment.partyName}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(payment.totalAmount)}</td>
                    <td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(payment.allocatedAmount)}</td>
                    <td className="p-3 text-right font-mono text-[#ba1a1a]">{formatMZN(payment.unappliedAmount)}</td>
                    <td className="p-3">{payment.status}</td>
                    <td className="p-3">
                      <button onClick={() => onPrintPayment(payment)} className="rounded bg-[#003366] px-2 py-1 font-bold text-white">
                        Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Entidade</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Débito</th>
                  <th className="p-3 text-right">Crédito</th>
                  <th className="p-3 text-right">Pendente</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {filteredLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="p-3">{entry.date}</td>
                    <td className="p-3 font-bold">{entry.partyName}</td>
                    <td className="p-3">{entry.entryType}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(entry.debitAmount)}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(entry.creditAmount)}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(entry.outstandingAmount)}</td>
                    <td className="p-3">{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
