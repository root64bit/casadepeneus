import React from 'react';
import { SaleInvoice, Client } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface ReportsProps {
  sales: SaleInvoice[];
  clients: Client[];
}

export const Reports: React.FC<ReportsProps> = ({ sales, clients }) => {
  const completedSales = sales.filter(s => s.status === 'Concluída');
  const pendingSales = sales.filter(s => s.status === 'Pendente');

  const totalRevenue = completedSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalPending = pendingSales.reduce((acc, s) => acc + s.pendingAmount, 0);
  const totalIva = sales.reduce((acc, s) => acc + s.ivaTotal, 0);
  const totalDebt = clients.reduce((acc, c) => acc + c.pendingBalance, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-5 rounded shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase">Receita Total (Pagas)</p>
            <span className="material-symbols-outlined text-[#006e25] text-xl">trending_up</span>
          </div>
          <p className="text-2xl font-black text-[#006e25] font-mono">{formatMZN(totalRevenue)}</p>
          <p className="text-[10px] text-[#737780] mt-1">{completedSales.length} vendas concluídas</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-5 rounded shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase">Vendas a Crédito (Pendentes)</p>
            <span className="material-symbols-outlined text-[#ba1a1a] text-xl">pending_actions</span>
          </div>
          <p className="text-2xl font-black text-[#ba1a1a] font-mono">{formatMZN(totalPending)}</p>
          <p className="text-[10px] text-[#737780] mt-1">{pendingSales.length} faturas em aberto</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-5 rounded shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#737780] dark:text-[#c3c6d1] uppercase">IVA Cobrado (16%)</p>
            <span className="material-symbols-outlined text-[#003366] dark:text-[#a7c8ff] text-xl">account_balance</span>
          </div>
          <p className="text-2xl font-black text-[#003366] dark:text-[#a7c8ff] font-mono">{formatMZN(totalIva)}</p>
          <p className="text-[10px] text-[#737780] mt-1">Total IVA apurado em {sales.length} documentos</p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#ffdad6] dark:border-[#ba1a1a]/40 p-5 rounded shadow-sm bg-[#ffdad6]/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#ba1a1a] uppercase">Dívida Total Clientes</p>
            <span className="material-symbols-outlined text-[#ba1a1a] text-xl">warning</span>
          </div>
          <p className="text-2xl font-black text-[#ba1a1a] font-mono">{formatMZN(totalDebt)}</p>
          <p className="text-[10px] text-[#737780] mt-1">{clients.filter(c => c.pendingBalance > 0).length} clientes com saldo em dívida</p>
        </div>
      </div>

      {/* All Sales History */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
          <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
            <span className="material-symbols-outlined mr-2">analytics</span>
            Registo Geral de Vendas & Pagamentos
          </h3>
          <button
            onClick={() => window.print()}
            className="flex items-center px-3 py-1.5 bg-[#003366] text-white font-bold rounded text-[11px] uppercase hover:brightness-110"
          >
            <span className="material-symbols-outlined mr-1.5 text-sm">print</span>
            Exportar / Imprimir (F9)
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] text-[#737780] dark:text-[#c3c6d1] uppercase border-b border-[#c3c6d1] dark:border-[#43474f]">
              <tr>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Nº Documento</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans">Data</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans">Cliente</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans">Pagamento</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Subtotal</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">IVA</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Total</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Pago</th>
                <th className="p-3 text-center font-sans">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#003366] dark:text-[#a7c8ff]">
                    {sale.docNumber}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans text-[#737780]">
                    {sale.date}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans font-bold text-[#191c1d] dark:text-white">
                    {sale.clientName}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans text-[#737780] text-[11px]">
                    {sale.paymentMethod}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                    {sale.subtotalBruto.toFixed(2)}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-[#737780]">
                    {sale.ivaTotal.toFixed(2)}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-bold text-[#001e40] dark:text-white">
                    {formatMZN(sale.totalAmount)}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-bold text-[#006e25]">
                    {formatMZN(sale.paidAmount)}
                  </td>
                  <td className="p-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      sale.status === 'Concluída'
                        ? 'bg-[#80f98b]/30 text-[#007327]'
                        : sale.status === 'Pendente'
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : 'bg-[#e7e8e9] text-[#737780]'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
