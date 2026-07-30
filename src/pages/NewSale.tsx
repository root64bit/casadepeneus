import React, { useState } from 'react';
import { Article, SaleInvoice, SaleItem, Client, ReferenceOption } from '../types';
import { formatMZN } from '../stitch/stitchConfig';
import { ArticleSearchSelect } from '../components/ArticleSearchSelect';

interface NewSaleProps {
  articles: Article[];
  clients: Client[];
  onCompleteSale: (sale: SaleInvoice) => Promise<SaleInvoice>;
  onOpenPrintModal: (sale: SaleInvoice) => void;
  canReceivePayment: boolean;
  operatorName: string;
  paymentTerms: ReferenceOption[];
  paymentMethods: ReferenceOption[];
}

export const NewSale: React.FC<NewSaleProps> = ({
  articles,
  clients,
  onCompleteSale,
  onOpenPrintModal,
  canReceivePayment,
  operatorName,
  paymentTerms,
  paymentMethods,
}) => {
  const [docNumber] = useState('A atribuir ao confirmar');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [selectedClientName, setSelectedClientName] = useState(clients[0]?.name ?? '');
  const [clientNuit, setClientNuit] = useState(clients[0]?.nuit ?? '');
  const [clientAddress, setClientAddress] = useState(clients[0]?.address ?? '');
  const immediateTerm = paymentTerms.find((item) => item.requiresImmediatePayment);
  const creditTerm = paymentTerms.find((item) => !item.requiresImmediatePayment);
  const receiptMethod = paymentMethods.find((item) => item.allowsCustomerReceipt);
  const [paymentSelection, setPaymentSelection] = useState(
    canReceivePayment && receiptMethod ? `METHOD:${receiptMethod.code}` : `TERM:${creditTerm?.code ?? immediateTerm?.code ?? ''}`,
  );
  const [sellerName] = useState(operatorName);

  // Active items in the POS cart
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // State for new item selector row
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const [inputIva, setInputIva] = useState<number>(articles[0]?.taxRate ?? 16);

  const handleArticleSelect = (id: string) => {
    setSelectedArticleId(id);
    const art = articles.find((a) => a.id === id);
    if (art) setInputIva(art.taxRate ?? 16);
  };

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
    const itemTotalWithIva = discountedPrice * inputQty * (1 + inputIva / 100);

    const newItem: SaleItem = {
      articleId: art.id,
      code: art.code,
      description: art.description,
      quantity: inputQty,
      unitPrice: art.sellPrice,
      discountPercent: inputDiscount,
      ivaPercent: inputIva,
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
  const ivaTotal = items.reduce((acc, item) => {
    const lineNet = (item.unitPrice * item.quantity) * (1 - item.discountPercent / 100);
    return acc + (lineNet * item.ivaPercent / 100);
  }, 0);
  const totalFinalAmount = totalAfterDiscount + ivaTotal;

  // Account Balance calculation
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const previousBalance = selectedClient?.pendingBalance ?? 0;
  const newAccumulatedBalance = previousBalance + totalFinalAmount;

  // Keyboard Shortcuts: F2 (Total / Gravar), F9 (Gravar / Imprimir), ESC (Retificar)
  const [f2Step, setF2Step] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (!f2Step) {
          setF2Step(true);
        } else {
          void handleSaveAndConfirm();
          setF2Step(false);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        void handleSaveAndConfirm(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setF2Step(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [f2Step, items, selectedClientId, totalFinalAmount]);

  const handleClientCodeChange = (codeStr: string) => {
    const found = clients.find((c) => c.number === codeStr.trim() || c.id === codeStr.trim());
    if (found) {
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit);
      setClientAddress(found.address);
    } else {
      // Default to Cliente Pontual
      const pontual = clients.find((c) => c.name.toLowerCase().includes('pontual')) || {
        id: 'client-pontual',
        name: 'Cliente Pontual',
        nuit: '999999999',
        address: 'Consumo Final',
      };
      setSelectedClientId(pontual.id);
      setSelectedClientName(pontual.name);
      setClientNuit(pontual.nuit ?? '');
      setClientAddress(pontual.address ?? '');
    }
  };

  const handleSaveAndConfirm = async (shouldPrint: boolean = false) => {
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
      paymentMethod:
        paymentSelection.startsWith('METHOD:')
          ? paymentMethods.find((item) => item.code === paymentSelection.slice(7))?.name ?? ''
          : paymentTerms.find((item) => item.code === paymentSelection.slice(5))?.name ?? '',
      paymentMethodCode: paymentSelection.startsWith('METHOD:') ? paymentSelection.slice(7) : undefined,
      paymentTermCode: paymentSelection.startsWith('TERM:')
        ? paymentSelection.slice(5)
        : immediateTerm?.code,
      sellerName,
      items,
      subtotalBruto,
      descontoTotal,
      ivaTotal,
      totalAmount: Math.round(totalFinalAmount * 100) / 100,
      paidAmount: paymentSelection.startsWith('TERM:') && paymentSelection.slice(5) !== immediateTerm?.code ? 0 : Math.round(totalFinalAmount * 100) / 100,
      pendingAmount: paymentSelection.startsWith('TERM:') && paymentSelection.slice(5) !== immediateTerm?.code ? Math.round(totalFinalAmount * 100) / 100 : 0,
      status: paymentSelection.startsWith('TERM:') && paymentSelection.slice(5) !== immediateTerm?.code ? 'Pendente' : 'Concluída',
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    };

    setSaving(true);
    setSaveError('');
    try {
      const savedSale = await onCompleteSale(newSale);
      if (shouldPrint || !savedSale.paymentMethodCode) {
        onOpenPrintModal(savedSale);
      }
      setItems([]);
      setF2Step(false);
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

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Código Cliente</label>
            <input
              type="text"
              placeholder="Ex: 5"
              onChange={(e) => handleClientCodeChange(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring font-bold"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-1">Nome do Cliente *</label>
            <input
              type="text"
              value={selectedClientName}
              onChange={(e) => setSelectedClientName(e.target.value)}
              placeholder="Nome do Cliente"
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-1">Condição de Pagamento</label>
            <select
              value={paymentSelection}
              onChange={(e) => setPaymentSelection(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring font-bold text-[#003366] dark:text-[#a7c8ff]"
            >
              {canReceivePayment && paymentMethods.filter((item) => item.allowsCustomerReceipt).map((item) => <option key={item.id} value={`METHOD:${item.code}`}>{item.name}</option>)}
              {paymentTerms.map((item) => <option key={item.id} value={`TERM:${item.code}`}>{item.name}</option>)}
            </select>
          </div>

          {/* Account Balance Summary Banner */}
          {selectedClientId && (
            <div className="col-span-12 bg-[#003366]/10 p-2.5 rounded border border-[#003366]/20 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="font-bold text-[#001e40] dark:text-white">Cliente: {selectedClientName}</span>
                {previousBalance > 0 && (
                  <span className="ml-3 text-red-600 font-bold">
                    Saldo Pendente Anterior: {formatMZN(previousBalance)}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span>Esta Venda: <b>{formatMZN(totalFinalAmount)}</b></span>
                <span className="text-[#006e25] font-extrabold text-sm">
                  Novo Saldo Acumulado: {formatMZN(newAccumulatedBalance)}
                </span>
              </div>
            </div>
          )}
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
              {/* Interactive Row to Add Items (XT-POS PRO Quick Bar) */}
              <tr className="bg-[#0000aa]/10 dark:bg-[#282c2e] border-b-2 border-[#003366]">
                <td className="p-2" colSpan={2}>
                  <ArticleSearchSelect
                    articles={articles}
                    selectedArticleId={selectedArticleId}
                    onSelect={handleArticleSelect}
                    renderLabel={(a) => `[${a.code}] ${a.description} - ${a.sellPrice.toFixed(2)} MZN (Existência: ${a.stock})`}
                    placeholder="Pesquisar artigo por código ou descrição…"
                  />
                </td>
                <td className="p-2">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(Number(e.target.value))}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold bg-yellow-100 text-black"
                    />
                    <span className="text-[10px] font-bold text-[#006e25] mt-0.5 whitespace-nowrap">
                      Existência: {articles.find(a => a.id === selectedArticleId)?.stock ?? 0}
                    </span>
                  </div>
                </td>
                <td className="p-2 text-right font-bold text-gray-700 dark:text-white">
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
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={inputIva}
                    onChange={(e) => setInputIva(Number(e.target.value))}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-2 text-center text-xs font-bold text-[#003366]"
                  />
                </td>
                <td className="p-2 text-right font-extrabold text-[#006e25]">
                  {(
                    ((articles.find(a => a.id === selectedArticleId)?.sellPrice || 0) * (1 - inputDiscount / 100)) * inputQty * (1 + inputIva / 100)
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
            <span>IVA:</span>
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
              onClick={() => void handleSaveAndConfirm()}
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
