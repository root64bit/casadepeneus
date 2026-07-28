import React from 'react';
import { CompanyProfile, SaleInvoice } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface PrintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SaleInvoice | null;
  company: CompanyProfile;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({ isOpen, onClose, invoice, company }) => {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden text-black">
        {/* Modal Controls */}
        <div className="bg-[#001e40] text-white px-6 py-3 flex justify-between items-center print:hidden">
          <span className="font-bold text-sm flex items-center">
            <span className="material-symbols-outlined mr-2">print</span>
            Visualização de Impressão - Documento {invoice.docNumber}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-[#006e25] text-white text-xs font-bold rounded hover:brightness-110 flex items-center"
            >
              <span className="material-symbols-outlined text-sm mr-1">print</span> Imprimir Fatura (F9)
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white ml-2">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 font-sans space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:p-0">
          <div className="flex justify-between items-start border-b-2 border-[#003366] pb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-[#001e40] uppercase tracking-wide">{company.name}</h1>
              <p className="text-xs text-gray-600 font-medium">Venda, Montagem e Calibragem de Pneus</p>
              <p className="text-xs text-gray-500">
                {[company.address, company.city, company.country].filter(Boolean).join(', ')}
                {company.taxNumber ? ` • NUIT: ${company.taxNumber}` : ''}
              </p>
              <p className="text-xs text-gray-500">
                {[company.phone && `Tel: ${company.phone}`, company.email && `Email: ${company.email}`]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-[#001e40] text-white font-bold px-3 py-1 text-sm rounded">
                FATURA / RECIBO
              </span>
              <p className="text-sm font-mono font-bold text-gray-800 mt-2">{invoice.docNumber}</p>
              <p className="text-xs text-gray-600">Data: {invoice.date}</p>
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded text-xs border border-gray-200">
            <div>
              <span className="font-bold text-gray-500 block uppercase">Dados do Cliente:</span>
              <p className="font-bold text-sm text-gray-900">{invoice.clientName || 'Consumidor Final'}</p>
              <p className="text-gray-600">NUIT: {invoice.clientNuit || 'Não indicado'}</p>
              <p className="text-gray-600">Endereço: {invoice.clientAddress || 'Maputo, Moçambique'}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-500 block uppercase">Condições:</span>
              <p className="font-semibold text-gray-800">{invoice.paymentMethod}</p>
              <p className="text-gray-600">Operador: {invoice.sellerName}</p>
              <p className="text-gray-600">Hora Emitida: {invoice.time}</p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#001e40] text-white uppercase text-[10px]">
                <th className="p-2">Código</th>
                <th className="p-2">Descrição</th>
                <th className="p-2 text-center">Qtd</th>
                <th className="p-2 text-right">P. Unit</th>
                <th className="p-2 text-center">Desc %</th>
                <th className="p-2 text-center">IVA</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-2 font-bold">{item.code}</td>
                  <td className="p-2 font-sans">{item.description}</td>
                  <td className="p-2 text-center">{item.quantity}</td>
                  <td className="p-2 text-right">{item.unitPrice.toFixed(2)}</td>
                  <td className="p-2 text-center">{item.discountPercent}%</td>
                  <td className="p-2 text-center">{item.ivaPercent}%</td>
                  <td className="p-2 text-right font-bold">{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end pt-4 border-t-2 border-gray-300">
            <div className="w-64 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal Bruto:</span>
                <span>{formatMZN(invoice.subtotalBruto)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Desconto Total:</span>
                <span>-{formatMZN(invoice.descontoTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA (16%):</span>
                <span>{formatMZN(invoice.ivaTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#001e40] pt-2 border-t border-gray-300">
                <span>TOTAL FINAL:</span>
                <span>{formatMZN(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 text-center text-[10px] text-gray-500">
            <p>Obrigado pela sua preferência! Os artigos têm garantia de fábrica contra defeitos de fabricação.</p>
            <p className="font-bold text-gray-700 mt-1">Processado por Computador • {company.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
