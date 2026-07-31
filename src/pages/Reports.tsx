import React, { useMemo, useState, useEffect } from 'react';
import type { SaleInvoice, DocumentRecord, Article, Client } from '../types';
import { formatMZN } from '../stitch/stitchConfig';
import { fetchSalesOperationalReport } from '../lib/appData';

interface ReportsProps {
  permissions: string[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  articles?: Article[];
  clients?: Client[];
  onPrintRecord?: (doc: DocumentRecord) => void;
  canViewCost?: boolean;
}

type SalesReportMode = 'DOCUMENT' | 'ARTICLE' | 'SUMMARY';

export const Reports: React.FC<ReportsProps> = ({
  permissions,
  sales = [],
  documents = [],
  articles = [],
  clients = [],
  onPrintRecord,
  canViewCost = true,
}) => {
  // Report Mode (Por Documento | Por Artigo | Resumo Financeiro)
  const [reportMode, setReportMode] = useState<SalesReportMode>('DOCUMENT');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | 'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CREDIT_NOTE'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'PENDING' | 'CANCELLED'>('ALL');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  // Clear all filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDocTypeFilter('ALL');
    setPaymentStatusFilter('ALL');
    setClientSearchQuery('');
    setArticleSearchQuery('');
    setShowCancelled(false);
  };

  // Filter Sales Documents according to audit rules:
  // - Includes: Factura (CUSTOMER_INVOICE), Venda a Dinheiro (CASH_SALE), Credit Notes.
  // - Excludes: Guia de Remessa (CUSTOMER_DELIVERY_NOTE - logistical only!), DRAFT, CANCELLED (unless filter active).
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 1. Exclude Guia de Remessa from financial sales report before being invoiced
      if (sale.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE') return false;

      // 2. Date Range Filter
      if (dateFrom && sale.date < dateFrom) return false;
      if (dateTo && sale.date > dateTo) return false;

      // 3. Document Type Filter
      if (docTypeFilter === 'CUSTOMER_INVOICE' && sale.documentTypeCode !== 'CUSTOMER_INVOICE') return false;
      if (docTypeFilter === 'CASH_SALE' && sale.documentTypeCode !== 'CASH_SALE') return false;
      if (docTypeFilter === 'CREDIT_NOTE' && sale.documentTypeCode !== 'CUSTOMER_CREDIT_NOTE') return false;

      // 4. Payment Status Filter
      if (paymentStatusFilter === 'PAID' && sale.pendingAmount > 0) return false;
      if (paymentStatusFilter === 'PENDING' && (sale.pendingAmount === 0 || sale.paidAmount > 0)) return false;
      if (paymentStatusFilter === 'PARTIAL' && (sale.paidAmount === 0 || sale.pendingAmount === 0)) return false;
      if (paymentStatusFilter === 'CANCELLED' && sale.status !== 'Cancelada') return false;

      // 5. Exclude Cancelled unless explicitly requested
      if (!showCancelled && sale.status === 'Cancelada') return false;

      // 6. Client Search Filter
      if (clientSearchQuery.trim()) {
        const q = clientSearchQuery.trim().toLowerCase();
        const clientMatch = sale.clientName.toLowerCase().includes(q) || sale.clientNuit.toLowerCase().includes(q);
        if (!clientMatch) return false;
      }

      // 7. Article Search Filter
      if (articleSearchQuery.trim()) {
        const q = articleSearchQuery.trim().toLowerCase();
        const articleMatch = sale.items.some((item) => item.code.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
        if (!articleMatch) return false;
      }

      return true;
    });
  }, [sales, dateFrom, dateTo, docTypeFilter, paymentStatusFilter, showCancelled, clientSearchQuery, articleSearchQuery]);

  // Aggregate Metrics & Totals
  const summaryMetrics = useMemo(() => {
    let countInvoices = 0;
    let countVDs = 0;
    let countCredits = 0;
    let grossSales = 0;
    let totalCreditsVal = 0;
    let totalIliquido = 0;
    let totalDescontos = 0;
    let totalIva = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalCostOfGoods = 0;
    let totalQty = 0;

    const uniqueClients = new Set<string>();

    filteredSales.forEach((sale) => {
      uniqueClients.add(sale.clientName);

      const isCreditNote = sale.documentTypeCode === 'CUSTOMER_CREDIT_NOTE';

      if (isCreditNote) {
        countCredits++;
        totalCreditsVal += sale.totalAmount;
      } else {
        if (sale.documentTypeCode === 'CASH_SALE') countVDs++;
        else countInvoices++;

        grossSales += sale.totalAmount;
        totalIliquido += sale.subtotalBruto;
        totalDescontos += sale.descontoTotal;
        totalIva += sale.ivaTotal;
        totalPaid += sale.paidAmount;
        totalPending += sale.pendingAmount;

        sale.items.forEach((item) => {
          totalQty += item.quantity;
          const art = articles.find((a) => a.id === item.articleId || a.code === item.code);
          const cost = art?.costPrice ?? 0;
          totalCostOfGoods += cost * item.quantity;
        });
      }
    });

    const netSales = grossSales - totalCreditsVal;
    const grossMargin = netSales - totalCostOfGoods;
    const grossMarginPct = netSales > 0 ? (grossMargin / netSales) * 100 : 0;
    const ticketMedio = (countInvoices + countVDs) > 0 ? netSales / (countInvoices + countVDs) : 0;

    return {
      countInvoices,
      countVDs,
      countCredits,
      grossSales,
      totalCreditsVal,
      netSales,
      totalIliquido,
      totalDescontos,
      totalIva,
      totalPaid,
      totalPending,
      totalCostOfGoods,
      grossMargin,
      grossMarginPct,
      ticketMedio,
      totalQty,
      uniqueClientsCount: uniqueClients.size,
    };
  }, [filteredSales, articles]);

  // Aggregate Sales by Article for Visão B
  const salesByArticle = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        description: string;
        quantity: number;
        grossTotal: number;
        discountTotal: number;
        ivaTotal: number;
        netTotal: number;
        totalCost: number;
      }
    >();

    filteredSales.forEach((sale) => {
      if (sale.documentTypeCode === 'CUSTOMER_CREDIT_NOTE') return;

      sale.items.forEach((item) => {
        const existing = map.get(item.code) || {
          code: item.code,
          description: item.description,
          quantity: 0,
          grossTotal: 0,
          discountTotal: 0,
          ivaTotal: 0,
          netTotal: 0,
          totalCost: 0,
        };

        const art = articles.find((a) => a.id === item.articleId || a.code === item.code);
        const cost = art?.costPrice ?? 0;

        existing.quantity += item.quantity;
        existing.grossTotal += item.unitPrice * item.quantity;
        existing.discountTotal += (item.unitPrice * item.quantity * (item.discountPercent / 100));
        existing.ivaTotal += ((item.unitPrice * item.quantity * (1 - item.discountPercent / 100)) * item.ivaPercent / 100);
        existing.netTotal += item.total;
        existing.totalCost += cost * item.quantity;

        map.set(item.code, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.netTotal - a.netTotal);
  }, [filteredSales, articles]);

  // CSV Export Function
  const exportCsv = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportMode === 'DOCUMENT') {
      headers = ['Data', 'Documento', 'Tipo Documento', 'Cliente', 'NUIT', 'Vendedor', 'Subtotal (MZN)', 'Desconto (MZN)', 'IVA (MZN)', 'Total Líquido (MZN)', 'Pago (MZN)', 'Pendente (MZN)', 'Estado'];
      rows = filteredSales.map((s) => [
        s.date,
        `"${s.docNumber}"`,
        s.documentTypeCode || 'FACTURA',
        `"${s.clientName.replace(/"/g, '""')}"`,
        s.clientNuit || '—',
        `"${s.sellerName.replace(/"/g, '""')}"`,
        s.subtotalBruto.toFixed(2),
        s.descontoTotal.toFixed(2),
        s.ivaTotal.toFixed(2),
        s.totalAmount.toFixed(2),
        s.paidAmount.toFixed(2),
        s.pendingAmount.toFixed(2),
        s.status,
      ]);
    } else if (reportMode === 'ARTICLE') {
      headers = ['Código', 'Descrição', 'Qtd Vendida', 'Preço Médio (MZN)', 'Desconto (MZN)', 'IVA (MZN)', 'Valor Total (MZN)', 'Custo Total (MZN)', 'Margem Bruta (MZN)', 'Margem %'];
      rows = salesByArticle.map((a) => {
        const avgPrice = a.quantity > 0 ? a.netTotal / a.quantity : 0;
        const margin = a.netTotal - a.totalCost;
        const marginPct = a.netTotal > 0 ? (margin / a.netTotal) * 100 : 0;
        return [
          a.code,
          `"${a.description.replace(/"/g, '""')}"`,
          a.quantity.toFixed(3),
          avgPrice.toFixed(2),
          a.discountTotal.toFixed(2),
          a.ivaTotal.toFixed(2),
          a.netTotal.toFixed(2),
          canViewCost ? a.totalCost.toFixed(2) : '0.00',
          canViewCost ? margin.toFixed(2) : '0.00',
          canViewCost ? `${marginPct.toFixed(1)}%` : '0.0%',
        ];
      });
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-${reportMode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header & View Mode Switcher */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-2xl text-[#003366] dark:text-[#a7c8ff]">analytics</span>
            <h2 className="text-lg font-black uppercase text-[#191c1d] dark:text-white">
              Relatório Comercial e Financeiro de Vendas
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Acompanhamento de Facturas, Vendas a Dinheiro (VD) e Notas de Crédito emitidas.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 bg-[#f3f4f5] dark:bg-[#282c2e] p-1.5 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] text-xs font-bold">
          <button
            type="button"
            onClick={() => setReportMode('DOCUMENT')}
            className={`px-4 py-2 rounded-md uppercase transition-all ${
              reportMode === 'DOCUMENT'
                ? 'bg-[#003366] text-white shadow-md'
                : 'text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Visão A: Por Documento
          </button>

          <button
            type="button"
            onClick={() => setReportMode('ARTICLE')}
            className={`px-4 py-2 rounded-md uppercase transition-all ${
              reportMode === 'ARTICLE'
                ? 'bg-[#003366] text-white shadow-md'
                : 'text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Visão B: Por Artigo
          </button>

          <button
            type="button"
            onClick={() => setReportMode('SUMMARY')}
            className={`px-4 py-2 rounded-md uppercase transition-all ${
              reportMode === 'SUMMARY'
                ? 'bg-[#003366] text-white shadow-md'
                : 'text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Visão C: Resumo & KPIs
          </button>
        </div>
      </section>

      {/* Filter Suite Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-2">
          <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff]">
            Filtros do Relatório de Vendas
          </h3>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            🧹 LIMPAR FILTROS
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Tipo de Documento</label>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value as any)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-bold text-[#003366]"
            >
              <option value="ALL">Todos (Factura, VD, Nota)</option>
              <option value="CUSTOMER_INVOICE">Factura a Cliente</option>
              <option value="CASH_SALE">Venda a Dinheiro (VD)</option>
              <option value="CREDIT_NOTE">Nota de Crédito</option>
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Estado Pagamento</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-bold"
            >
              <option value="ALL">Todos os Estados</option>
              <option value="PAID">Totalmente Pago</option>
              <option value="PENDING">Totalmente Pendente</option>
              <option value="PARTIAL">Parcialmente Pago</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Cliente / NUIT</label>
            <input
              type="text"
              placeholder="Pesquisar cliente..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Artigo / Código</label>
            <input
              type="text"
              placeholder="Pesquisar artigo..."
              value={articleSearchQuery}
              onChange={(e) => setArticleSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* KPI Cards Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Venda Bruta (FT + VD)</span>
          <span className="text-xl font-black text-[#003366] dark:text-[#a7c8ff]">
            {formatMZN(summaryMetrics.grossSales)}
          </span>
          <p className="text-[10px] text-slate-500">
            Facturas: <b>{summaryMetrics.countInvoices}</b> | VDs: <b>{summaryMetrics.countVDs}</b>
          </p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-2">
          <span className="text-[11px] font-bold text-red-600 uppercase block">Notas de Crédito</span>
          <span className="text-xl font-black text-red-600">
            -{formatMZN(summaryMetrics.totalCreditsVal)}
          </span>
          <p className="text-[10px] text-slate-500">
            Documentos de crédito: <b>{summaryMetrics.countCredits}</b>
          </p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-2">
          <span className="text-[11px] font-bold text-[#006e25] uppercase block">Venda Líquida Efectiva</span>
          <span className="text-2xl font-black text-[#006e25]">
            {formatMZN(summaryMetrics.netSales)}
          </span>
          <p className="text-[10px] text-slate-500">
            Ilíquido: <b>{formatMZN(summaryMetrics.totalIliquido)}</b> | IVA: <b>{formatMZN(summaryMetrics.totalIva)}</b>
          </p>
        </div>

        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-2">
          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase block">Recebido vs Pendente</span>
          <div className="text-xs font-bold space-y-1">
            <div className="flex justify-between text-green-700">
              <span>Pago:</span>
              <span>{formatMZN(summaryMetrics.totalPaid)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Pendente:</span>
              <span>{formatMZN(summaryMetrics.totalPending)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area according to selected Report Mode */}

      {/* VISÃO A: POR DOCUMENTO */}
      {reportMode === 'DOCUMENT' && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
          <div className="bg-[#001e40] text-white px-4 py-3 text-xs font-bold uppercase flex justify-between items-center">
            <span>[ Visão A — Lista de Documentos de Venda ]</span>
            <span>Documentos filtrados: {filteredSales.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">NUIT</th>
                  <th className="p-3">Vendedor</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right text-red-600">Desconto</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right font-bold">Total Líquido</th>
                  <th className="p-3 text-right text-green-700">Pago</th>
                  <th className="p-3 text-right text-red-600">Pendente</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400 font-sans italic">
                      Nenhuma venda encontrada para os filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => {
                    const matchedDoc = documents.find((d) => d.displayNumber === s.docNumber || d.id === s.id);
                    return (
                      <tr key={s.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                        <td className="p-3 whitespace-nowrap text-slate-600">{s.date}</td>
                        <td className="p-3 font-bold">
                          {matchedDoc && onPrintRecord ? (
                            <button
                              type="button"
                              onClick={() => onPrintRecord(matchedDoc)}
                              className="text-[#003366] dark:text-[#a7c8ff] hover:underline font-extrabold"
                              title="Clique para consultar o documento oficial"
                            >
                              {s.docNumber} 🔗
                            </button>
                          ) : (
                            <span className="text-[#003366] dark:text-[#a7c8ff]">{s.docNumber}</span>
                          )}
                        </td>
                        <td className="p-3 font-sans text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              s.documentTypeCode === 'CASH_SALE'
                                ? 'bg-green-100 text-green-800'
                                : s.documentTypeCode === 'CUSTOMER_CREDIT_NOTE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {s.documentTypeCode === 'CASH_SALE'
                              ? 'VD'
                              : s.documentTypeCode === 'CUSTOMER_CREDIT_NOTE'
                              ? 'Crédito'
                              : 'Factura'}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-semibold">{s.clientName}</td>
                        <td className="p-3 text-slate-500">{s.clientNuit || '—'}</td>
                        <td className="p-3 font-sans text-slate-600">{s.sellerName}</td>
                        <td className="p-3 text-right">{formatMZN(s.subtotalBruto)}</td>
                        <td className="p-3 text-right text-red-600">-{formatMZN(s.descontoTotal)}</td>
                        <td className="p-3 text-right">{formatMZN(s.ivaTotal)}</td>
                        <td className="p-3 text-right font-black text-[#006e25] text-sm">
                          {formatMZN(s.totalAmount)}
                        </td>
                        <td className="p-3 text-right font-bold text-green-700">{formatMZN(s.paidAmount)}</td>
                        <td className="p-3 text-right font-bold text-red-600">{formatMZN(s.pendingAmount)}</td>
                        <td className="p-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'Concluída' || s.pendingAmount === 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {s.pendingAmount === 0 ? 'Paga' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VISÃO B: POR ARTIGO */}
      {reportMode === 'ARTICLE' && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
          <div className="bg-[#001e40] text-white px-4 py-3 text-xs font-bold uppercase flex justify-between items-center">
            <span>[ Visão B — Vendas Discriminadas por Artigo ]</span>
            <span>Artigos distintos vendidos: {salesByArticle.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Descrição do Artigo</th>
                  <th className="p-3 text-center">Qtd Vendida</th>
                  <th className="p-3 text-right">Preço Médio</th>
                  <th className="p-3 text-right text-red-600">Desconto Total</th>
                  <th className="p-3 text-right">IVA Total</th>
                  <th className="p-3 text-right font-extrabold text-[#006e25]">Valor Total Vendas</th>
                  {canViewCost && <th className="p-3 text-right">Custo Histórico</th>}
                  {canViewCost && <th className="p-3 text-right text-purple-700">Margem Bruta</th>}
                  {canViewCost && <th className="p-3 text-center">Margem %</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {salesByArticle.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-sans italic">
                      Nenhum artigo vendido no período seleccionado.
                    </td>
                  </tr>
                ) : (
                  salesByArticle.map((art) => {
                    const avgPrice = art.quantity > 0 ? art.netTotal / art.quantity : 0;
                    const margin = art.netTotal - art.totalCost;
                    const marginPct = art.netTotal > 0 ? (margin / art.netTotal) * 100 : 0;

                    return (
                      <tr key={art.code} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                        <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{art.code}</td>
                        <td className="p-3 font-sans font-semibold text-slate-800 dark:text-white">{art.description}</td>
                        <td className="p-3 text-center font-extrabold">{art.quantity.toFixed(3)} UN</td>
                        <td className="p-3 text-right">{formatMZN(avgPrice)}</td>
                        <td className="p-3 text-right text-red-600">-{formatMZN(art.discountTotal)}</td>
                        <td className="p-3 text-right">{formatMZN(art.ivaTotal)}</td>
                        <td className="p-3 text-right font-black text-[#006e25] text-sm">
                          {formatMZN(art.netTotal)}
                        </td>
                        {canViewCost && <td className="p-3 text-right text-slate-600">{formatMZN(art.totalCost)}</td>}
                        {canViewCost && (
                          <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-300">
                            {formatMZN(margin)}
                          </td>
                        )}
                        {canViewCost && (
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                marginPct >= 20
                                  ? 'bg-green-100 text-green-800'
                                  : marginPct > 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {marginPct.toFixed(1)}%
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VISÃO C: RESUMO & KPIS */}
      {reportMode === 'SUMMARY' && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-5 rounded-lg shadow-sm space-y-6">
          <h3 className="font-black text-sm uppercase text-[#003366] dark:text-[#a7c8ff] border-b pb-2">
            Visão C — Resumo da Actividade Comercial & Análise Financeira
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-xs">
            <div className="bg-[#f3f4f5] dark:bg-[#282c2e] p-4 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
              <h4 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff] border-b pb-1">
                Volume de Vendas & Documentos
              </h4>
              <div className="flex justify-between"><span>Facturas Emitidas:</span><b>{summaryMetrics.countInvoices}</b></div>
              <div className="flex justify-between"><span>Vendas a Dinheiro (VD):</span><b>{summaryMetrics.countVDs}</b></div>
              <div className="flex justify-between"><span>Quantidade Total Artigos:</span><b>{summaryMetrics.totalQty.toFixed(3)} UN</b></div>
              <div className="flex justify-between text-purple-700"><span>Clientes Atendidos:</span><b>{summaryMetrics.uniqueClientsCount}</b></div>
              <div className="flex justify-between text-[#006e25] font-bold"><span>Ticket Médio por Venda:</span><b>{formatMZN(summaryMetrics.ticketMedio)}</b></div>
            </div>

            <div className="bg-[#f3f4f5] dark:bg-[#282c2e] p-4 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
              <h4 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff] border-b pb-1">
                Totais Fiscais & Impostos
              </h4>
              <div className="flex justify-between"><span>Valor Ilíquido Total:</span><b>{formatMZN(summaryMetrics.totalIliquido)}</b></div>
              <div className="flex justify-between text-red-600"><span>Descontos Concedidos:</span><b>-{formatMZN(summaryMetrics.totalDescontos)}</b></div>
              <div className="flex justify-between text-blue-700"><span>IVA Cobrado (16%):</span><b>{formatMZN(summaryMetrics.totalIva)}</b></div>
              <div className="flex justify-between font-black text-lg text-[#006e25] pt-2 border-t">
                <span>Venda Líquida:</span>
                <span>{formatMZN(summaryMetrics.netSales)}</span>
              </div>
            </div>

            {canViewCost && (
              <div className="bg-[#f3f4f5] dark:bg-[#282c2e] p-4 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
                <h4 className="font-bold text-xs uppercase text-purple-700 dark:text-purple-300 border-b pb-1">
                  Lucratividade & Margem Bruta
                </h4>
                <div className="flex justify-between"><span>Venda Líquida:</span><b>{formatMZN(summaryMetrics.netSales)}</b></div>
                <div className="flex justify-between text-slate-500"><span>Custo da Mercadoria:</span><b>-{formatMZN(summaryMetrics.totalCostOfGoods)}</b></div>
                <div className="flex justify-between font-black text-lg text-purple-700 dark:text-purple-300 pt-2 border-t">
                  <span>Margem Bruta:</span>
                  <span>{formatMZN(summaryMetrics.grossMargin)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs text-green-700">
                  <span>Margem Percentual:</span>
                  <span>{summaryMetrics.grossMarginPct.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer Action Controls */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex items-center justify-between">
        <p className="text-xs text-slate-500 font-mono">
          Mostrando {filteredSales.length} documento(s) de venda processados.
        </p>

        <div className="flex items-center space-x-3">
          {permissions.includes('reports.export') && (
            <button
              type="button"
              onClick={exportCsv}
              className="px-4 py-2 bg-green-700 text-white font-bold rounded text-xs hover:bg-green-800"
            >
              📥 Exportar Relatório CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#003366] text-white font-bold rounded text-xs hover:bg-blue-800"
          >
            🖨 Imprimir Relatório
          </button>
        </div>
      </section>
    </div>
  );
};
