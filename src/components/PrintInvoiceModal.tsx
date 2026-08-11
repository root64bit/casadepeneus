import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CompanyProfile, SaleInvoice } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface PrintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SaleInvoice | null;
  company: CompanyProfile;
}

export function numberToExtensoMZN(amount: number): string {
  const intVal = Math.floor(Math.abs(amount));
  const centsVal = Math.round((Math.abs(amount) - intVal) * 100);

  if (intVal === 0) return 'zero meticais';

  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const convertGroup = (n: number): string => {
    if (n === 100) return 'cem';
    if (n < 20) return units[n];
    if (n < 100) {
      const u = n % 10;
      return u ? `${tens[Math.floor(n / 10)]} e ${units[u]}` : tens[Math.floor(n / 10)];
    }
    const rem = n % 100;
    const h = Math.floor(n / 100);
    return rem ? `${hundreds[h]} e ${convertGroup(rem)}` : hundreds[h];
  };

  let result = '';
  if (intVal >= 1000000) {
    const millions = Math.floor(intVal / 1000000);
    const rem = intVal % 1000000;
    result += millions === 1 ? 'um milhão' : `${convertGroup(millions)} milhões`;
    if (rem > 0) result += ` e ${convertGroup(rem)}`;
  } else if (intVal >= 1000) {
    const thousands = Math.floor(intVal / 1000);
    const rem = intVal % 1000;
    const thousandStr = thousands === 1 ? 'mil' : `${convertGroup(thousands)} mil`;
    result += rem ? `${thousandStr} e ${convertGroup(rem)}` : thousandStr;
  } else {
    result = convertGroup(intVal);
  }

  result += ' meticais';
  if (centsVal > 0) {
    result += ` e ${convertGroup(centsVal)} centavos`;
  }
  return result;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({ isOpen, onClose, invoice, company }) => {
  if (!isOpen || !invoice) return null;

  // Editable Bank & Document Details
  const [bankAccounts, setBankAccounts] = useState<import('../types').BankAccount[]>(
    company?.bankAccounts?.length ? company.bankAccounts : [
      { bankName: 'BCI', account: invoice.bankAccountBci || company.bankBciAccount || '9109 8531 0001', nib: invoice.bankNibBci || company.bankBciNib || '0008 0000 0910 9853 101 80' },
      { bankName: 'Millennium BIM', account: invoice.bankAccountBim || company.bankBimAccount || '5579 3819', nib: invoice.bankNibBim || company.bankBimNib || '0001 0000 0005 5793 8195 7' },
    ]
  );
  const [validityDays, setValidityDays] = useState(invoice.validityDays || company.quotationValidityDays || (invoice.documentTypeCode === 'CUSTOMER_QUOTATION' ? '7 dias' : 'Pronto pag.'));
  const [customNotes, setCustomNotes] = useState(invoice.notes || company.quotationDefaultNotes || '');
  const [showEditPanel, setShowEditPanel] = useState(false);

  const isQuotation = invoice.documentTypeCode === 'CUSTOMER_QUOTATION';
  const docTitleName = isQuotation
    ? 'Proposta de Cotação'
    : invoice.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE'
    ? 'Guia de remessa'
    : invoice.documentTypeCode === 'CASH_SALE'
    ? 'Venda a Dinheiro'
    : 'Factura';

  const formattedDate = new Date(invoice.date || Date.now()).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  // Whole-Metical non-decimal calculations for Subtotal, IVA, and Total
  const calculatedItems = invoice.items.map((item) => {
    const ivaRate = item.ivaPercent ?? 16;
    const itemTotalComIva = item.total > 0
      ? item.total
      : item.unitPrice * item.quantity * (1 - item.discountPercent / 100) * (1 + ivaRate / 100);

    const lineTotalRounded = Math.round(itemTotalComIva);
    const lineSubtotal = Math.round((lineTotalRounded / (1 + ivaRate / 100)) * 100) / 100;
    const lineIva = Math.round((lineTotalRounded - lineSubtotal) * 100) / 100;
    const lineUnitPriceExcl = item.quantity > 0 ? lineSubtotal / item.quantity : item.unitPrice;

    return {
      ...item,
      lineTotalRounded,
      lineSubtotal,
      lineIva,
      lineUnitPriceExcl,
    };
  });

  const totalDocAmount = Math.round(calculatedItems.reduce((acc, i) => acc + i.lineTotalRounded, 0));
  const subtotalDocCalculated = Math.round(calculatedItems.reduce((acc, i) => acc + i.lineSubtotal, 0) * 100) / 100;
  const ivaDocCalculated = Math.round((totalDocAmount - subtotalDocCalculated) * 100) / 100;
  const totalItemDiscounts = calculatedItems.reduce((acc, i) => acc + (i.discountAmount || 0), 0);
  const descontoTotalCalculado = (invoice.descontoTotal && invoice.descontoTotal > 0) ? invoice.descontoTotal : totalItemDiscounts;

  const minRows = 8;
  const fillerCount = Math.max(0, minRows - calculatedItems.length);
  const fillerRows = Array.from({ length: fillerCount });

  const handlePrint = () => {
    const wasDarkDoc = document.documentElement.classList.contains('dark');
    const wasDarkBody = document.body.classList.contains('dark');

    if (wasDarkDoc) document.documentElement.classList.remove('dark');
    if (wasDarkBody) document.body.classList.remove('dark');
    document.body.classList.add('printing-modal');

    window.print();

    setTimeout(() => {
      document.body.classList.remove('printing-modal');
      if (wasDarkDoc) document.documentElement.classList.add('dark');
      if (wasDarkBody) document.body.classList.add('dark');
    }, 500);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:p-0 print:static print:block print:inset-auto print:backdrop-blur-none print-document-modal">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden text-black print:shadow-none print:max-w-none print:w-full print:rounded-none print:p-0 print:m-0 print:border-none">
        {/* Modal Top Bar - Hidden during printing */}
        <div className="bg-[#001e40] text-white px-6 py-3 flex justify-between items-center print:hidden">
          <span className="font-bold text-sm flex items-center">
            <span className="material-symbols-outlined mr-2">print</span>
            Visualização de Impressão — {docTitleName} {invoice.docNumber}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEditPanel((prev) => !prev)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded flex items-center transition-all"
            >
              <span className="material-symbols-outlined text-sm mr-1">edit</span>
              {showEditPanel ? 'Ocultar Edição' : '✏️ Editar Bancos & Validade'}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#006e25] text-white text-xs font-bold rounded hover:brightness-110 flex items-center"
            >
              <span className="material-symbols-outlined text-sm mr-1">print</span> Imprimir (F9)
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white ml-2">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Inline Admin Edit Panel for Quotation Bank Account & Notes */}
        {showEditPanel && (
          <div className="bg-amber-50 dark:bg-[#1a2332] p-4 border-b border-amber-200 text-xs font-sans space-y-3 print:hidden">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold uppercase text-[#003366] dark:text-[#a7c8ff] flex items-center">
                <span className="material-symbols-outlined text-sm mr-1">account_balance</span>
                Personalização de Dados Bancários, Validade e Observações da Cotação
              </h4>
              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">
                As alterações aplicam-se imediatamente no impresso abaixo.
              </span>
            </div>
            <div className="grid grid-cols-12 gap-3">
              {bankAccounts.map((bank, idx) => (
                <React.Fragment key={idx}>
                  <div className="col-span-12 sm:col-span-3">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Conta {bank.bankName}</label>
                    <input
                      type="text"
                      value={bank.account}
                      onChange={(e) => { const updated = [...bankAccounts]; updated[idx] = {...updated[idx], account: e.target.value}; setBankAccounts(updated); }}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#282c2e] font-mono text-xs"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">NIB {bank.bankName}</label>
                    <input
                      type="text"
                      value={bank.nib}
                      onChange={(e) => { const updated = [...bankAccounts]; updated[idx] = {...updated[idx], nib: e.target.value}; setBankAccounts(updated); }}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#282c2e] font-mono text-xs"
                    />
                  </div>
                </React.Fragment>
              ))}
              <div className="col-span-12 sm:col-span-4">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Validade / Condição</label>
                <input
                  type="text"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  placeholder="ex: 7 dias, 15 dias"
                  className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#282c2e] font-sans text-xs"
                />
              </div>
              <div className="col-span-12 sm:col-span-8">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Observações Adicionais</label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="ex: Preços sujeitos a confirmação de stock."
                  className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#282c2e] font-sans text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Printable Area matching official invoice/quotation structure */}
        <div className="p-8 font-sans space-y-3 max-h-[85vh] overflow-y-auto print:max-h-none print:p-0 print:space-y-2 text-xs">
          
          {/* Top Address Banner Header matching Image 3 Model */}
          <div className="text-center font-serif text-lg print:text-base font-black tracking-wide text-black uppercase">
            Casa de Pneus, Lda
          </div>
          <div className="text-center border-b border-black pb-1.5 text-[11px] print:text-[10px] text-gray-800 font-medium">
            Maputo - Av. Karl Marx, no 1772, R/C, Cel: 87 580 5555, Email: casadepneus.mz@gmail.com
          </div>

          {/* Company Contacts & Client Information Box */}
          <div className="grid grid-cols-12 gap-4 items-start pt-1 text-[11px] print:text-[10px]">
            {/* Left Block: Company Details & Bank Accounts */}
            <div className="col-span-7 space-y-1">
              <div className="flex gap-4">
                <span className="font-bold">NUIT:</span>
                <span>400 064 253</span>
              </div>
              <div className="flex gap-4">
                <span className="font-bold">CEL:</span>
                <span>87 580 5555</span>
              </div>
              <div className="flex gap-4">
                <span className="font-bold">Email:</span>
                <span>casadepneus.mz@gmail.com</span>
              </div>
              <div className="flex gap-4">
                <span className="font-bold">Fax:</span>
                <span>0</span>
              </div>

              <div className="pt-1">
                <p className="font-bold">Contas bancárias: Casa de Pneus, Lda.</p>
                <div className="grid grid-cols-12 gap-1 text-[10px] print:text-[9px]">
                  {bankAccounts.map((bank, idx) => (
                    <React.Fragment key={idx}>
                      <span className="col-span-3 font-bold">{bank.bankName}</span>
                      <span className="col-span-4 font-mono font-bold">{bank.account}</span>
                      <span className="col-span-1 font-bold">NIB</span>
                      <span className="col-span-4 font-mono">{bank.nib}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Block: Client Box */}
            <div className="col-span-5 border border-black rounded p-2 space-y-1 bg-white">
              <p className="font-bold">Exmo.(s) Sr.(s) - {invoice.clientName || 'Consumidor Final'}</p>
              <p>Tel: {invoice.clientPhone || '0'}</p>
              <p>NUIT: {invoice.clientNuit || '0'}</p>
              <p>Nº da requisição: -</p>
            </div>
          </div>

          {/* Document Title & Reference Line */}
          <div className="border-t border-dashed border-gray-400 pt-2 flex justify-between items-baseline">
            <div>
              <h2 className="text-base print:text-sm font-bold text-black uppercase">
                {docTitleName} N.º {invoice.docNumber}
              </h2>
              <p className="text-[11px] print:text-[10px]">Data doc.: {formattedDate}</p>
            </div>
            <div className="text-right text-[11px] print:text-[10px]">
              <p>- Validade: {validityDays}</p>
            </div>
          </div>

          {/* Table Headers Line */}
          <div className="grid grid-cols-12 border-y border-black py-1 text-[10px] font-bold text-center uppercase bg-gray-100 print:bg-transparent">
            <span className="col-span-2">Moeda</span>
            <span className="col-span-2">Desc. Cli.</span>
            <span className="col-span-2">Desc. Fin.</span>
            <span className="col-span-3">Condição de pag.</span>
            <span className="col-span-3">Comercial</span>
          </div>
          <div className="grid grid-cols-12 py-1 text-[10px] text-center font-mono">
            <span className="col-span-2">MT</span>
            <span className="col-span-2">00,00</span>
            <span className="col-span-2">00,00</span>
            <span className="col-span-3 font-sans font-medium">{isQuotation ? 'pronto pagamento' : 'Pronto pag.'}</span>
            <span className="col-span-3 font-sans font-medium">{invoice.sellerName || 'usuario'}</span>
          </div>

          {/* Items Table with Full Vertical and Horizontal Grid Lines */}
          <div className="border border-black rounded overflow-hidden my-2">
            <table className="w-full text-left border-collapse text-[10px] print:text-[9.5px]">
              <thead className="bg-gray-800 text-white print:bg-gray-200 print:text-black font-bold uppercase border-b border-black">
                <tr>
                  <th className="p-1 w-8 text-center border-r border-black">Nº</th>
                  <th className="p-1 w-24 border-r border-black">Referência</th>
                  <th className="p-1 border-r border-black">Descrição</th>
                  <th className="p-1 w-12 text-center border-r border-black">Quant.</th>
                  <th className="p-1 w-20 text-right border-r border-black">Preço Un.</th>
                  <th className="p-1 w-14 text-right border-r border-black">Desc.</th>
                  <th className="p-1 w-16 text-right border-r border-black">IVA</th>
                  <th className="p-1 w-20 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-mono">
                {calculatedItems.map((item, idx) => (
                  <tr key={idx} className="h-8 print:h-8">
                    <td className="p-1 text-center border-r border-black font-bold">{idx + 1}</td>
                    <td className="p-1 border-r border-black font-bold">{item.code}</td>
                    <td className="p-1 border-r border-black font-sans font-medium">{item.description}</td>
                    <td className="p-1 text-center border-r border-black font-bold">{item.quantity}</td>
                    <td className="p-1 text-right border-r border-black">{item.lineUnitPriceExcl.toFixed(2)}</td>
                    <td className="p-1 text-right border-r border-black font-bold">
                      {item.discountAmount && item.discountAmount > 0
                        ? item.discountAmount.toFixed(2)
                        : item.discountPercent > 0
                          ? ((item.unitPrice * (item.discountPercent / 100)) * item.quantity).toFixed(2)
                          : '0,00'}
                    </td>
                    <td className="p-1 text-right border-r border-black">{item.lineIva.toFixed(2)}</td>
                    <td className="p-1 text-right font-bold">{item.lineTotalRounded.toFixed(2)}</td>
                  </tr>
                ))}

                {fillerRows.map((_, idx) => (
                  <tr key={`filler-${idx}`} className="h-8 print:h-8">
                    <td className="p-1 text-center border-r border-black">&nbsp;</td>
                    <td className="p-1 border-r border-black">&nbsp;</td>
                    <td className="p-1 border-r border-black">&nbsp;</td>
                    <td className="p-1 text-center border-r border-black">&nbsp;</td>
                    <td className="p-1 text-right border-r border-black">&nbsp;</td>
                    <td className="p-1 text-right border-r border-black">&nbsp;</td>
                    <td className="p-1 text-right border-r border-black">&nbsp;</td>
                    <td className="p-1 text-right">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Computer processing note */}
          <p className="text-[9px] print:text-[8px] italic text-gray-700 pt-1">
            Documento processado por computador / SEIP(v1.0) - Licença Nº DAFM1 - 01/04/2018
          </p>
          {(customNotes || invoice.notes) && <p className="text-[10px] print:text-[9px] font-medium">Obs.: {customNotes || invoice.notes}</p>}

          {/* Quadro Resumo do IVA & Totals Box */}
          <div className="grid grid-cols-12 gap-4 items-start pt-1 font-mono text-[10px] print:text-[9px] break-inside-avoid">
            {/* Left: Quadro Resumo do IVA */}
            <div className="col-span-6 border border-black rounded overflow-hidden">
              <div className="bg-gray-100 print:bg-transparent font-bold text-center uppercase p-1 border-b border-black text-[9px]">
                Quadro Resumo do IVA
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-black font-bold">
                  <tr>
                    <th className="p-1 text-center border-r border-black">Taxa</th>
                    <th className="p-1 text-right border-r border-black">Incidência</th>
                    <th className="p-1 text-right border-r border-black">Valor IVA</th>
                    <th className="p-1 text-left">Motivo da Isenção</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1 text-center border-r border-black">16%</td>
                    <td className="p-1 text-right border-r border-black font-bold">{subtotalDocCalculated.toFixed(2)}</td>
                    <td className="p-1 text-right border-r border-black">{ivaDocCalculated.toFixed(2)}</td>
                    <td className="p-1 text-left">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Mercadoria / serviços totals box */}
            <div className="col-span-6 border border-black rounded p-2 space-y-1">
              <div className="flex justify-between">
                <span>Mercadoria/serviços | subtotal</span>
                <span className="font-bold">{formatMZN(subtotalDocCalculated)}</span>
              </div>
              <div className="flex justify-between">
                <span>Mão-de-obra</span>
                <span>0,00</span>
              </div>
              <div className="flex justify-between">
                <span>Total descontos</span>
                <span>{formatMZN(descontoTotalCalculado)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Iva</span>
                <span>{formatMZN(ivaDocCalculated)}</span>
              </div>
              <div className="flex justify-between text-sm print:text-xs font-black border-t border-black pt-1">
                <span>Total [MT]</span>
                <span>{formatMZN(totalDocAmount)}</span>
              </div>
            </div>
          </div>

          {/* Total Extenso */}
          <div className="text-[11px] print:text-[10px] font-bold border-t border-gray-300 pt-1">
            Total Extenso: <span className="underline italic lowercase font-normal">{numberToExtensoMZN(totalDocAmount)}</span>
          </div>

          {/* Promotional Free Service Banners matching Image 3 Model */}
          <div className="border border-black rounded p-3 text-center font-bold uppercase text-sm print:text-xs tracking-wider my-3 max-w-lg mx-auto">
            OFERTA DE NITROGÉNIO
          </div>
          <div className="text-center text-[10px] print:text-[9px] font-bold uppercase tracking-widest text-gray-700 pt-1">
            MONTAGEM/BALANCEAMENTO GRATUITO
          </div>
        </div>
      </div>
    </div>,
    window.document.body
  );
};
