import { useMemo, useState } from 'react';
import type {
  Article,
  Client,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  Supplier,
} from '../types';
import { formatMZN } from '../stitch/stitchConfig';

type ReportId = 'sales' | 'stock' | 'receivables' | 'payables' | 'vat';

interface ReportsProps {
  sales: SaleInvoice[];
  clients: Client[];
  suppliers: Supplier[];
  articles: Article[];
  payments: PaymentRecord[];
  ledger: LedgerRecord[];
  permissions: string[];
}

const csvCell = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

export function Reports({
  sales,
  clients,
  suppliers,
  articles,
  payments,
  ledger,
  permissions,
}: ReportsProps) {
  const availableReports = useMemo(
    () =>
      [
        { id: 'sales' as const, label: 'Vendas', permission: 'reports.sales' },
        { id: 'stock' as const, label: 'Stock', permission: 'reports.stock' },
        { id: 'receivables' as const, label: 'Contas a receber', permission: 'reports.receivables' },
        { id: 'payables' as const, label: 'Contas a pagar', permission: 'reports.payables' },
        { id: 'vat' as const, label: 'IVA', permission: 'reports.tax' },
      ].filter((report) => permissions.includes(report.permission)),
    [permissions],
  );
  const [selected, setSelected] = useState<ReportId>('sales');
  const active = availableReports.some((report) => report.id === selected)
    ? selected
    : availableReports[0]?.id;

  const exportRows = () => {
    let headers: string[] = [];
    let rows: Array<Array<unknown>> = [];

    if (active === 'sales' || active === 'vat') {
      headers = ['Documento', 'Data', 'Cliente', 'Subtotal', 'IVA', 'Total', 'Pago', 'Pendente', 'Estado'];
      rows = sales.map((sale) => [
        sale.docNumber,
        sale.date,
        sale.clientName,
        sale.subtotalBruto,
        sale.ivaTotal,
        sale.totalAmount,
        sale.paidAmount,
        sale.pendingAmount,
        sale.status,
      ]);
    } else if (active === 'stock') {
      headers = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Stock mínimo', 'Preço venda'];
      rows = articles.map((article) => [
        article.code,
        article.description,
        article.unit,
        article.stock,
        article.minStock,
        article.sellPriceWithIva,
      ]);
    } else if (active === 'receivables') {
      headers = ['Cliente', 'NUIT', 'Saldo'];
      rows = clients.map((client) => [client.name, client.nuit, client.pendingBalance]);
    } else {
      headers = ['Fornecedor', 'NUIT', 'Saldo'];
      rows = suppliers.map((supplier) => [supplier.name, supplier.nuit, supplier.totalPurchases]);
    }

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `casa-de-pneus-${active}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalVat = sales.reduce((sum, sale) => sum + sale.ivaTotal, 0);
  const totalReceivables = clients.reduce((sum, client) => sum + client.pendingBalance, 0);
  const totalPayables = suppliers.reduce((sum, supplier) => sum + supplier.totalPurchases, 0);
  const stockUnits = articles.reduce((sum, article) => sum + article.stock, 0);

  if (!active) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-5 text-amber-900">
        A sessão não possui permissões para gerar relatórios.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#c3c6d1] bg-white p-4 dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="flex flex-wrap gap-2">
          {availableReports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelected(report.id)}
              className={`rounded px-3 py-2 text-xs font-black uppercase ${
                active === report.id
                  ? 'bg-[#003366] text-white'
                  : 'bg-[#e7e8e9] text-[#43474f]'
              }`}
            >
              {report.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {permissions.includes('reports.export') && (
            <button onClick={exportRows} className="rounded bg-[#006e25] px-3 py-2 text-xs font-black uppercase text-white">
              Exportar CSV
            </button>
          )}
          <button onClick={() => window.print()} className="rounded bg-[#003366] px-3 py-2 text-xs font-black uppercase text-white">
            Imprimir
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ['Vendas', formatMZN(totalSales)],
          ['IVA', formatMZN(totalVat)],
          ['A receber', formatMZN(totalReceivables)],
          ['A pagar', formatMZN(totalPayables)],
          ['Unidades em stock', stockUnits.toFixed(3)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-[#c3c6d1] bg-white p-4 dark:border-[#43474f] dark:bg-[#1f2325]">
            <p className="text-[10px] font-black uppercase text-[#737780]">{label}</p>
            <p className="mt-2 font-mono text-lg font-black text-[#001e40] dark:text-[#a7c8ff]">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325]">
        <header className="border-b border-[#c3c6d1] bg-[#e7e8e9] px-4 py-3 dark:border-[#43474f] dark:bg-[#282c2e]">
          <h2 className="text-sm font-black uppercase text-[#001e40] dark:text-[#a7c8ff]">
            Relatório — {availableReports.find((report) => report.id === active)?.label}
          </h2>
        </header>

        <div className="overflow-x-auto">
          {(active === 'sales' || active === 'vat') && (
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-[#737780]">
                <tr>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Pendente</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="p-3 font-mono font-bold">{sale.docNumber}</td>
                    <td className="p-3">{sale.date}</td>
                    <td className="p-3">{sale.clientName}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(sale.subtotalBruto)}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(sale.ivaTotal)}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatMZN(sale.totalAmount)}</td>
                    <td className="p-3 text-right font-mono text-[#ba1a1a]">{formatMZN(sale.pendingAmount)}</td>
                    <td className="p-3">{sale.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {active === 'stock' && (
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-[#737780]">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Unidade</th>
                  <th className="p-3 text-right">Quantidade</th>
                  <th className="p-3 text-right">Mínimo</th>
                  <th className="p-3 text-right">Preço c/ IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td className="p-3 font-mono font-bold">{article.code}</td>
                    <td className="p-3">{article.description}</td>
                    <td className="p-3">{article.unit}</td>
                    <td className="p-3 text-right font-mono">{article.stock.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{article.minStock.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{formatMZN(article.sellPriceWithIva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {active === 'receivables' && (
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-[#737780]"><tr><th className="p-3">Cliente</th><th className="p-3">NUIT</th><th className="p-3 text-right">Saldo</th></tr></thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {clients.map((client) => <tr key={client.id}><td className="p-3 font-bold">{client.name}</td><td className="p-3 font-mono">{client.nuit}</td><td className="p-3 text-right font-mono">{formatMZN(client.pendingBalance)}</td></tr>)}
              </tbody>
            </table>
          )}

          {active === 'payables' && (
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-[#737780]"><tr><th className="p-3">Fornecedor</th><th className="p-3">NUIT</th><th className="p-3 text-right">Saldo</th></tr></thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {suppliers.map((supplier) => <tr key={supplier.id}><td className="p-3 font-bold">{supplier.name}</td><td className="p-3 font-mono">{supplier.nuit}</td><td className="p-3 text-right font-mono">{formatMZN(supplier.totalPurchases)}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-right text-[10px] text-[#737780]">
        Pagamentos carregados: {payments.length} • Movimentos de conta: {ledger.length}
      </p>
    </div>
  );
}
