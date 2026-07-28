import type { CompanyProfile, DocumentRecord, PaymentRecord } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface PrintRecordModalProps {
  company: CompanyProfile;
  document: DocumentRecord | null;
  payment: PaymentRecord | null;
  onClose: () => void;
}

export function PrintRecordModal({
  company,
  document,
  payment,
  onClose,
}: PrintRecordModalProps) {
  const record = document ?? payment;
  if (!record) return null;

  const number = document?.displayNumber ?? payment?.displayNumber ?? '';
  const title = document
    ? document.typeName || document.typeCode
    : payment?.direction === 'CUSTOMER_RECEIPT'
      ? 'Recibo de Cliente'
      : 'Comprovativo de Pagamento a Fornecedor';
  const partyName = document?.partyName ?? payment?.partyName ?? '';
  const total = document?.grandTotal ?? payment?.totalAmount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white text-black shadow-2xl">
        <div className="flex items-center justify-between bg-[#001e40] px-6 py-3 text-white print:hidden">
          <strong className="text-sm">Visualização de impressão — {number}</strong>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="rounded bg-[#006e25] px-4 py-2 text-xs font-bold">
              Imprimir
            </button>
            <button onClick={onClose} aria-label="Fechar impressão" className="px-2">×</button>
          </div>
        </div>
        <article className="space-y-6 p-10 print:p-0">
          <header className="flex justify-between border-b-2 border-[#003366] pb-4">
            <div>
              <h1 className="text-2xl font-black uppercase text-[#001e40]">{company.name}</h1>
              <p className="text-xs text-gray-600">
                {[company.address, company.city, company.country].filter(Boolean).join(', ')}
              </p>
              {company.taxNumber && <p className="text-xs text-gray-600">NUIT: {company.taxNumber}</p>}
              <p className="text-xs text-gray-600">
                {[company.phone, company.email].filter(Boolean).join(' • ')}
              </p>
            </div>
            <div className="text-right">
              <span className="rounded bg-[#001e40] px-3 py-1 text-sm font-bold text-white">{title}</span>
              <p className="mt-2 font-mono font-bold">{number}</p>
              <p className="text-xs text-gray-600">Data: {record.date}</p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 rounded border bg-gray-50 p-4 text-sm">
            <div>
              <span className="block text-xs font-bold uppercase text-gray-500">Entidade</span>
              <strong>{partyName}</strong>
              {document && <p className="text-xs text-gray-600">{document.partyType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'}</p>}
            </div>
            <div className="text-right">
              <span className="block text-xs font-bold uppercase text-gray-500">Estado</span>
              <strong>{document?.status ?? payment?.status}</strong>
            </div>
          </section>

          <section className="ml-auto w-full max-w-sm space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between text-lg font-black">
              <span>Total</span><span>{formatMZN(total)}</span>
            </div>
            {document && (
              <>
                <div className="flex justify-between"><span>Pago</span><span>{formatMZN(document.paidAmount)}</span></div>
                <div className="flex justify-between"><span>Pendente</span><span>{formatMZN(document.outstandingAmount)}</span></div>
              </>
            )}
            {payment && (
              <>
                <div className="flex justify-between"><span>Alocado</span><span>{formatMZN(payment.allocatedAmount)}</span></div>
                <div className="flex justify-between"><span>Não aplicado</span><span>{formatMZN(payment.unappliedAmount)}</span></div>
              </>
            )}
          </section>

          <footer className="border-t pt-4 text-center text-[10px] text-gray-500">
            Documento emitido pelo sistema Casa de Pneus. Conserve para reconciliação.
          </footer>
        </article>
      </div>
    </div>
  );
}
