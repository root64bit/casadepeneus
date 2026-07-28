import React, { useState } from 'react';
import { Article, SaleInvoice, SaleItem, Client } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface NewSaleProps {
  articles: Article[];
  clients: Client[];
  onCompleteSale: (sale: SaleInvoice) => Promise<SaleInvoice>;
  onOpenPrintModal: (sale: SaleInvoice) => void;
  canReceivePayment: boolean;
}

export const NewSale: React.FC<NewSaleProps> = ({
  articles,
  clients,
  onCompleteSale,
  onOpenPrintModal,
  canReceivePayment,
}) => {
  const [docNumber] = useState(`VD 24/${Math.floor(1000 + Math.random() * 9000)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [selectedClientName, setSelectedClientName] = useState(clients[0]?.name ?? '');
  const [clientNuit, setClientNuit] = useState(clients[0]?.nuit ?? '');
  const [clientAddress, setClientAddress] = useState(clients[0]?.address ?? '');
  const [paymentMethod, setPaymentMethod] = useState<'Pronto Pagamento (Numerário)' | 'Transferência Bancária (M-Pesa)' | 'Crédito 30 Dias'>(
    canReceivePayment ? 'Pronto Pagamento (Numerário)' : 'Crédito 30 Dias',
  );
  const [sellerName] = useState('Operador Balcão');

  // Active items in the POS cart
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // State for new item selector row
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputDiscount, setInputDiscount] = useState<number>(0);

  const handleSelectClient = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = clients.find(c => c.id === e.target.value);
    if (found) {
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit);
      setClientAddress(found.address);
    } else {
      setSelectedClientId('');
      setSelectedClientName('');
    }
  };

  const handleAddItem = () => {
    const art = articles.find(a => a.id === selectedArticleId);
    if (!art) return;

    const basePrice = art.sellPrice;
    const discountedPrice = basePrice * (1 - inputDiscount / 100);
    const itemTotalWithIva = discountedPrice * inputQty * 1.16;

    const newItem: SaleItem = {
      articleId: art.id,
      code: art.code,
      description: art.description,
      quantity: inputQty,
      unitPrice: art.sellPrice,
      discountPercent: inputDiscount,
      ivaPercent: 16,
      total: Math.round(itemTotalWithIva * 100) / 100
    };

    setItems([...items, newItem]);
    setInputQty(1);
    setInputDiscount(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotalBruto = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const descontoTotal = items.reduce((acc, item) => acc + ((item.unitPrice * item.quantity) * (item.discountPercent / 100)), 0);
  const totalAfterDiscount = subtotalBruto - descontoTotal;
  const ivaTotal = totalAfterDiscount * 0.16;
  const totalFinalAmount = totalAfterDiscount + ivaTotal;

  const handleSaveAndConfirm = async () => {
    if (items.length === 0) {
      alert('Adicione pelo menos 1 item à venda.');
      return;
    }
    if (!selectedClientId) {
      setSaveError('Selecione um cliente válido.');
      return;
    }

    const newSale: SaleInvoice = {
      id: `sale-${Date.now()}`,
      clientId: selectedClientId,
      docNumber,
      date,
      clientName: selectedClientName,
      clientNuit,
      clientAddress,
      paymentMethod,
      sellerName,
      items,
      subtotalBruto,
      descontoTotal,
      ivaTotal,
      totalAmount: Math.round(totalFinalAmount * 100) / 100,
      paidAmount: paymentMethod === 'Crédito 30 Dias' ? 0 : Math.round(totalFinalAmount * 100) / 100,
      pendingAmount: paymentMethod === 'Crédito 30 Dias' ? Math.round(totalFinalAmount * 100) / 100 : 0,
      status: paymentMethod === 'Crédito 30 Dias' ? 'Pendente' : 'Concluída',
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    };

    setSaving(true);
    setSaveError('');
    try {
      const savedSale = await onCompleteSale(newSale);
      if (savedSale.paymentMethod === 'Crédito 30 Dias') {
        onOpenPrintModal(savedSale);
      }
      setItems([]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao guardar a fatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info Form */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded shadow-sm">
        <div className="grid grid-cols-12 gap-3 text-xs">
          {/* Row 1 */}
          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Nº Documento</label>
            <input
              type="text"
              readOnly
              value={docNumber}
              className="w-full bg-[#f3f4f5] dark:bg-[#282c2e] dark:text-white font-mono font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Data Emissão</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1">Selecionar Cliente Registado</label>
            <select
              value={selectedClientId}
              onChange={handleSelectClient}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} (NUIT: {c.nuit})</option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1">Condição de Pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring font-bold text-[#003366] dark:text-[#a7c8ff]"
            >
              {canReceivePayment && <option value="Pronto Pagamento (Numerário)">Pronto Pagamento (Numerário)</option>}
              {canReceivePayment && <option value="Transferência Bancária (M-Pesa)">Transferência Bancária (M-Pesa / TPA)</option>}
              <option value="Crédito 30 Dias">Crédito 30 Dias</option>
            </select>
            {!canReceivePayment && (
              <p className="mt-1 text-[10px] text-[#737780]">Recebimentos exigem perfil de caixa.</p>
            )}
          </div>

          {/* Row 2 */}
          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1">Nome na Fatura</label>
            <input
              type="text"
              value={selectedClientName}
              onChange={(e) => setSelectedClientName(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1">Morada / Endereço</label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">NUIT Cliente</label>
            <input
              type="text"
              value={clientNuit}
              onChange={(e) => setClientNuit(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Vendedor</label>
            <input
              type="text"
              readOnly
              value={sellerName}
              className="w-full bg-[#f3f4f5] dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* POS Table Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#001e40] text-white font-bold uppercase">
              <tr>
                <th className="p-3 w-44">Código Artigo</th>
                <th className="p-3">Descrição do Item / Pneu</th>
                <th className="p-3 w-20 text-center">Qtd</th>
                <th className="p-3 w-32 text-right">Preço Unit.</th>
                <th className="p-3 w-20 text-center">Desc %</th>
                <th className="p-3 w-20 text-center">IVA</th>
                <th className="p-3 w-36 text-right">Total c/ IVA</th>
                <th className="p-3 w-12 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {/* Interactive Row to Add Items */}
              <tr className="bg-[#f8f9fa] dark:bg-[#282c2e]">
                <td className="p-2" colSpan={2}>
                  <select
                    value={selectedArticleId}
                    onChange={(e) => setSelectedArticleId(e.target.value)}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-2 text-xs font-sans focus-ring font-bold text-[#003366]"
                  >
                    {articles.map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.description} - {a.sellPrice.toFixed(2)} MZN (Stock: {a.stock})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={inputQty}
                    onChange={(e) => setInputQty(Number(e.target.value))}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-2 text-center text-xs font-bold"
                  />
                </td>
                <td className="p-2 text-right font-bold text-gray-500">
                  {articles.find(a => a.id === selectedArticleId)?.sellPrice.toFixed(2)}
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={inputDiscount}
                    onChange={(e) => setInputDiscount(Number(e.target.value))}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-2 text-center text-xs text-red-600"
                  />
                </td>
                <td className="p-2 text-center text-gray-500 font-bold">16%</td>
                <td className="p-2 text-right font-extrabold text-[#006e25]">
                  {(
                    ((articles.find(a => a.id === selectedArticleId)?.sellPrice || 0) * (1 - inputDiscount / 100)) * inputQty * 1.16
                  ).toFixed(2)}
                </td>
                <td className="p-2 text-center">
                  <button
                    onClick={handleAddItem}
                    className="p-1 bg-[#006e25] text-white rounded hover:brightness-110 flex items-center justify-center mx-auto"
                    title="Adicionar Item à Fatura"
                  >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                  </button>
                </td>
              </tr>

              {/* Added Line Items */}
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                  <td className="p-3 font-sans font-medium text-[#191c1d] dark:text-white">{item.description}</td>
                  <td className="p-3 text-center font-bold text-base text-[#001e40] dark:text-white">{item.quantity}</td>
                  <td className="p-3 text-right">{item.unitPrice.toFixed(2)}</td>
                  <td className="p-3 text-center text-red-600 font-bold">{item.discountPercent}%</td>
                  <td className="p-3 text-center text-gray-500">{item.ivaPercent}%</td>
                  <td className="p-3 text-right font-extrabold text-[#006e25] text-sm">{item.total.toFixed(2)} MZN</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-[#ba1a1a] hover:opacity-80 p-1"
                      title="Remover linha"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals & Summary Bento */}
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="p-4 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded shadow-sm">
            <h3 className="text-xs font-bold text-[#003366] dark:text-[#a7c8ff] uppercase mb-2">
              Observações / Notas da Garantia
            </h3>
            <textarea
              placeholder="Escreva detalhes da garantia dos pneus (ex: 50.000 km ou 12 meses contra defeitos de fabricação)..."
              className="w-full h-24 border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-xs focus-ring"
            ></textarea>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-5 shadow-sm space-y-3 font-mono">
          <div className="flex justify-between items-center text-xs text-[#737780] dark:text-[#c3c6d1]">
            <span>Subtotal Bruto:</span>
            <span className="font-bold text-[#191c1d] dark:text-white">{formatMZN(subtotalBruto)}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-[#ba1a1a]">
            <span>Desconto Total:</span>
            <span className="font-bold">-{formatMZN(descontoTotal)}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-[#737780] dark:text-[#c3c6d1] pb-3 border-b border-[#c3c6d1] dark:border-[#43474f]">
            <span>IVA (16% Moçambique):</span>
            <span className="font-bold">{formatMZN(ivaTotal)}</span>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-base font-extrabold text-[#001e40] dark:text-[#a7c8ff] uppercase font-sans">
              TOTAL FINAL:
            </span>
            <span className="text-2xl font-black text-[#001e40] dark:text-[#a7c8ff]">
              {formatMZN(totalFinalAmount)}
            </span>
          </div>

          {/* Checkout Trigger Actions */}
          <div className="pt-4 space-y-2 font-sans">
            {saveError && (
              <p role="alert" className="rounded bg-red-50 p-2 text-xs font-bold text-red-700">
                {saveError}
              </p>
            )}
            <button
              onClick={handleSaveAndConfirm}
              disabled={saving || items.length === 0 || !selectedClientId}
              className="w-full py-3 bg-[#006e25] text-white font-bold text-xs uppercase rounded hover:brightness-110 shadow-md flex items-center justify-center space-x-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined">check_circle</span>
              <span>{saving ? 'A guardar…' : 'Confirmar & Guardar Fatura (F2)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
