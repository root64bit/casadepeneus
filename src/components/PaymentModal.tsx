import React, { useEffect, useState } from 'react';
import { formatMZN } from '../stitch/stitchConfig';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  clientName: string;
  onConfirmPayment: (
    paymentMethod: 'Pronto Pagamento (Numerário)' | 'Transferência Bancária (M-Pesa)',
    paidAmount: number,
    reference: string,
  ) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  clientName,
  onConfirmPayment
}) => {
  const [method, setMethod] = useState<'Pronto Pagamento (Numerário)' | 'Transferência Bancária (M-Pesa)' | 'Crédito 30 Dias'>('Pronto Pagamento (Numerário)');
  const [paidInput, setPaidInput] = useState<number>(totalAmount);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPaidInput(totalAmount);
      setReference('');
      setError('');
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const changeDue = Math.max(0, paidInput - totalAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'Crédito 30 Dias') return;
    if (method === 'Transferência Bancária (M-Pesa)' && !reference.trim()) {
      setError('Introduza a referência da transferência ou pagamento móvel.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirmPayment(method, paidInput, reference);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao confirmar pagamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f2325] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#c3c6d1] dark:border-[#43474f]">
        <div className="bg-[#001e40] text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <span className="material-symbols-outlined mr-2">payments</span>
            Finalizar Pagamento - Venda Balcão
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-[#f3f4f5] dark:bg-[#282c2e] p-4 rounded border border-[#c3c6d1] dark:border-[#43474f] text-center">
            <span className="text-xs uppercase text-[#43474f] dark:text-[#c3c6d1] font-bold tracking-wider block mb-1">
              Cliente: {clientName || 'Consumidor Final'}
            </span>
            <div className="text-3xl font-extrabold text-[#001e40] dark:text-[#a7c8ff] font-mono">
              {formatMZN(totalAmount)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-2">
              Método de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('Pronto Pagamento (Numerário)')}
                className={`p-3 rounded text-xs font-bold border text-center flex flex-col items-center justify-center space-y-1 transition-all ${
                  method === 'Pronto Pagamento (Numerário)'
                    ? 'border-[#003366] bg-[#003366] text-white'
                    : 'border-[#c3c6d1] dark:border-[#43474f] text-[#191c1d] dark:text-white hover:bg-[#edeeef]'
                }`}
              >
                <span className="material-symbols-outlined">payments</span>
                <span>Numerário</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('Transferência Bancária (M-Pesa)')}
                className={`p-3 rounded text-xs font-bold border text-center flex flex-col items-center justify-center space-y-1 transition-all ${
                  method === 'Transferência Bancária (M-Pesa)'
                    ? 'border-[#003366] bg-[#003366] text-white'
                    : 'border-[#c3c6d1] dark:border-[#43474f] text-[#191c1d] dark:text-white hover:bg-[#edeeef]'
                }`}
              >
                <span className="material-symbols-outlined">phone_android</span>
                <span>M-Pesa / TPA</span>
              </button>

            </div>
          </div>

          {method === 'Transferência Bancária (M-Pesa)' && (
            <div>
              <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
                Referência da Transação
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-3 font-mono focus-ring"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
              Valor Entregue (MZN)
            </label>
            <input
              type="number"
              step="0.01"
              value={paidInput}
              onChange={(e) => setPaidInput(Number(e.target.value))}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-3 text-lg font-mono text-right font-bold focus-ring"
            />
          </div>

          {method === 'Pronto Pagamento (Numerário)' && (
            <div className="flex justify-between items-center bg-[#80f98b]/20 text-[#007327] p-3 rounded border border-[#006e25]/30">
              <span className="text-xs font-bold uppercase">Troco a Devolver:</span>
              <strong className="text-xl font-mono">{formatMZN(changeDue)}</strong>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#c3c6d1] dark:border-[#43474f]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:brightness-90 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || paidInput <= 0}
              className="px-6 py-2.5 bg-[#006e25] text-white rounded font-bold text-xs uppercase hover:brightness-110 transition-all shadow-md flex items-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-2">check_circle</span>
              {saving ? 'A confirmar…' : 'Confirmar & Emitir Recibo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
