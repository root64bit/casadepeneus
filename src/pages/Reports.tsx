import { useEffect, useMemo, useState } from 'react';
import { loadOperationalReport, type OperationalReportData } from '../lib/appData';
import { formatMZN } from '../stitch/stitchConfig';

type ReportId = 'sales' | 'stock' | 'receivables' | 'payables' | 'vat';
interface ReportsProps { permissions: string[]; }
const PAGE_SIZE = 50;
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const reportDefinitions = {
  sales: { label: 'Vendas', legacyPermission: 'reports.sales', columns: [['document','Documento'],['date','Data'],['party','Cliente'],['net','Subtotal'],['tax','IVA'],['total','Total'],['outstanding','Pendente'],['status','Estado']] },
  vat: { label: 'IVA', legacyPermission: 'reports.tax', columns: [['document','Documento'],['date','Data'],['party','Cliente'],['net','Base tributável'],['tax','IVA'],['total','Total']] },
  stock: { label: 'Stock', legacyPermission: 'reports.stock', columns: [['code','Código'],['description','Descrição'],['unit','Unidade'],['quantity','Quantidade'],['min_stock','Mínimo'],['price','Preço c/ IVA']] },
  receivables: { label: 'Contas a receber', legacyPermission: 'reports.receivables', columns: [['party','Cliente'],['tax_number','NUIT'],['balance','Saldo']] },
  payables: { label: 'Contas a pagar', legacyPermission: 'reports.payables', columns: [['party','Fornecedor'],['tax_number','NUIT'],['balance','Saldo']] },
} satisfies Record<ReportId, { label: string; legacyPermission: string; columns: string[][] }>;

export function Reports({ permissions }: ReportsProps) {
  const available = useMemo(() => (Object.entries(reportDefinitions) as Array<[ReportId, typeof reportDefinitions[ReportId]]>).filter(([, definition]) => permissions.includes('reports.read') || permissions.includes(definition.legacyPermission)), [permissions]);
  const [selected, setSelected] = useState<ReportId>('sales');
  const active = available.some(([id]) => id === selected) ? selected : available[0]?.[0];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try { setData(await loadOperationalReport(active, from, to, PAGE_SIZE, page * PAGE_SIZE)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar relatório.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { setPage(0); }, [active, from, to]);
  useEffect(() => { void load(); }, [active, page]);

  const exportCsv = async () => {
    if (!active) return;
    try {
      const exportData = await loadOperationalReport(active, from, to, 1000, 0);
      const columns = reportDefinitions[active].columns;
      const csv = [columns.map(([, label]) => label), ...exportData.rows.map((row) => columns.map(([key]) => row[key]))].map((row) => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `casa-de-pneus-${active}-${new Date().toISOString().slice(0,10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao exportar relatório.'); }
  };

  if (!active) return <div className="rounded border border-amber-300 bg-amber-50 p-5 text-amber-900">A sessão não possui permissões para gerar relatórios.</div>;
  const definition = reportDefinitions[active];
  const totals = Object.entries(data?.totals ?? {});

  return (
    <div className="space-y-5">
      <section className="rounded border bg-white p-4 dark:bg-[#1f2325]">
        <div className="flex flex-wrap gap-2">{available.map(([id, item]) => <button key={id} onClick={() => setSelected(id)} className={`rounded px-3 py-2 text-xs font-black uppercase ${active === id ? 'bg-primary text-white' : 'bg-slate-200'}`}>{item.label}</button>)}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
          <label className="text-xs font-bold">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-xs font-bold">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <button onClick={() => { setPage(0); void load(); }} className="self-end rounded bg-primary px-4 py-2 text-xs font-black text-white">Aplicar filtros</button>
          <button onClick={() => { setFrom(''); setTo(''); }} className="self-end rounded border px-4 py-2 text-xs font-black">Limpar</button>
          {permissions.includes('reports.export') && <button onClick={() => void exportCsv()} className="self-end rounded bg-green-700 px-4 py-2 text-xs font-black text-white">Exportar CSV</button>}
        </div>
      </section>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}<button onClick={() => void load()} className="ml-3 underline">Tentar novamente</button></p>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{totals.map(([key,value]) => <div key={key} className="rounded border bg-white p-4 dark:bg-[#1f2325]"><p className="text-[10px] font-black uppercase text-slate-500">{key}</p><p className="mt-2 font-mono text-lg font-black">{key === 'quantity' ? Number(value).toFixed(3) : formatMZN(Number(value))}</p></div>)}</section>
      <section className="overflow-hidden rounded border bg-white dark:bg-[#1f2325]">
        <header className="border-b bg-slate-100 px-4 py-3 dark:bg-slate-800"><h2 className="text-sm font-black uppercase">Relatório — {definition.label}</h2></header>
        {loading ? <p className="p-8 text-center text-sm font-bold text-slate-500">A carregar relatório…</p> : !data?.rows.length ? <p className="p-8 text-center text-sm text-slate-500">Não existem dados para os filtros selecionados.</p> : <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-xs"><thead><tr className="uppercase text-slate-500">{definition.columns.map(([key,label]) => <th key={key} className="p-3">{label}</th>)}</tr></thead><tbody>{data.rows.map((row,index) => <tr key={row.id ?? index} className="border-t">{definition.columns.map(([key]) => <td key={key} className="p-3">{['net','tax','total','outstanding','balance','price'].includes(key) ? formatMZN(Number(row[key])) : String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div>}
        <footer className="flex items-center justify-between border-t p-3 text-xs"><span>{data?.totalCount ?? 0} registo(s)</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0,value-1))} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button><button disabled={(page+1)*PAGE_SIZE >= (data?.totalCount ?? 0)} onClick={() => setPage((value) => value+1)} className="rounded border px-3 py-2 disabled:opacity-40">Seguinte</button><button onClick={() => window.print()} className="rounded bg-primary px-3 py-2 font-bold text-white">Imprimir</button></div></footer>
      </section>
    </div>
  );
}
