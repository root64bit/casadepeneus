import React, { useState } from 'react';
import { Article, SaleInvoice, SaleItem, Client, ReferenceOption, DocumentRecord } from '../types';
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
  documents?: DocumentRecord[];
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
  documents,
}) => {
  const [docNumber] = useState('A atribuir ao confirmar');
  const [showClientInvoices, setShowClientInvoices] = useState(false);
  const [documentType, setDocumentType] = useState<'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE'>('CUSTOMER_INVOICE');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientCodeInput, setClientCodeInput] = useState(clients[0]?.number || clients[0]?.code || '');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [selectedClientName, setSelectedClientName] = useState(clients[0]?.name ?? '');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');
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
      setClientCodeInput(found.number || found.code || '');
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit || '');
      setClientAddress(found.address || '');
    } else {
      setSelectedClientId('');
      setSelectedClientName('');
    }
  };

  const handleAddItem = () => {
    const art = articles.find(a => a.id === selectedArticleId);
    if (!art || inputQty <= 0) return;

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

    setItems((current) => [...current, newItem]);
    setInputQty(1);
    setInputDiscount(0);

    // Return focus to article search select input for continuous fast entry
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]')?.focus();
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 3-Phase POS Workflow: HEADER -> LINES -> FOOTER
  const [posPhase, setPosPhase] = useState<'HEADER' | 'LINES' | 'FOOTER'>('HEADER');
  const [generalDiscount, setGeneralDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Calculations
  const subtotalBruto = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const descontoLinhas = items.reduce((acc, item) => acc + ((item.unitPrice * item.quantity) * (item.discountPercent / 100)), 0);
  const totalAfterLineDiscount = subtotalBruto - descontoLinhas;
  const descontoGeralValor = totalAfterLineDiscount * (generalDiscount / 100);
  const subtotalLiquido = totalAfterLineDiscount - descontoGeralValor;

  const ivaTotal = items.reduce((acc, item) => {
    const lineNet = (item.unitPrice * item.quantity) * (1 - item.discountPercent / 100) * (1 - generalDiscount / 100);
    return acc + (lineNet * item.ivaPercent / 100);
  }, 0);

  const totalFinalAmount = subtotalLiquido + ivaTotal;

  // Account Balance calculation
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const previousBalance = selectedClient?.pendingBalance ?? 0;
  const newAccumulatedBalance = previousBalance + totalFinalAmount;

  const loadLastDocument = () => {
    if (!documents || documents.length === 0) return false;

    // Filter documents matching current selected documentType (FT, VD, or GR)
    const matchingDocs = documents.filter((d) => {
      if (documentType === 'CASH_SALE') {
        return d.typeCode === 'CASH_SALE' || d.displayNumber.startsWith('VD') || d.typeName.toLowerCase().includes('dinheiro');
      }
      if (documentType === 'CUSTOMER_DELIVERY_NOTE') {
        return d.typeCode === 'CUSTOMER_DELIVERY_NOTE' || d.displayNumber.startsWith('GR') || d.typeName.toLowerCase().includes('guia');
      }
      return d.typeCode === 'CUSTOMER_INVOICE' || d.displayNumber.startsWith('FT') || d.typeName.toLowerCase().includes('factura') || d.typeName.toLowerCase().includes('fatura');
    });

    const targetDoc = matchingDocs[0] || documents[0];
    if (!targetDoc) return false;

    const found = clients.find((c) => c.id === targetDoc.partyId);
    if (found) {
      setClientCodeInput(found.number || found.code || '');
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit || '');
      setClientAddress(found.address || '');
      if (documents?.some(d => d.partyId === found.id && d.outstandingAmount > 0)) {
        setShowClientInvoices(true);
      }
      return true;
    }
    return false;
  };

  // Keyboard Shortcuts based on current phase
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (posPhase === 'HEADER') {
          loadLastDocument();
          if (!selectedClientId && clients.length > 0) {
            setSelectedClientId(clients[0].id);
            setSelectedClientName(clients[0].name);
          }
          setPosPhase('LINES');
        } else if (posPhase === 'LINES') {
          setPosPhase('FOOTER');
        } else if (posPhase === 'FOOTER') {
          void handleSaveAndConfirm();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        void handleSaveAndConfirm(true);
      } else if (e.key === 'F5' && posPhase === 'FOOTER') {
        e.preventDefault();
        setItems([]);
        setPosPhase('HEADER');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (posPhase === 'FOOTER') setPosPhase('LINES');
        else if (posPhase === 'LINES') setPosPhase('HEADER');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posPhase, items, selectedClientId, totalFinalAmount, clients, documents, documentType]);

  const handleClientCodeChange = (codeStr: string) => {
    const clean = codeStr.trim().toLowerCase();
    if (!clean) return;
    const found = clients.find(
      (c) =>
        (c.number && c.number.trim().toLowerCase() === clean) ||
        (c.code && c.code.trim().toLowerCase() === clean) ||
        c.id.toLowerCase() === clean ||
        String(c.number) === clean ||
        c.name.toLowerCase().includes(clean)
    );
    if (found) {
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit || '');
      setClientAddress(found.address || '');
      setClientCodeInput(found.number || found.code || codeStr);
      if (documents?.some(d => d.partyId === found.id && d.outstandingAmount > 0)) {
        setShowClientInvoices(true);
      } else {
        setShowClientInvoices(false);
      }
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientNuit('');
      setClientAddress('');
    }
  };

  const handleSaveAndConfirm = async (shouldPrint: boolean = false) => {
    if (items.length === 0) {
      setSaveError('Adicione pelo menos 1 item à venda.');
      return;
    }
    if (!selectedClientId) {
      setSaveError('Selecione um cliente válido.');
      return;
    }

    const newSale: SaleInvoice = {
      id: `sale-${Date.now()}`,
      clientId: selectedClientId,
      documentTypeCode: documentType,
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
      descontoTotal: descontoLinhas + descontoGeralValor,
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
      setPosPhase('HEADER');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao guardar a fatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 font-mono">
      {/* Workflow Phase Indicator Tabs */}
      <div className="flex items-center space-x-2 bg-[#001e40] text-white p-2 rounded shadow text-xs uppercase font-bold">
        <button
          type="button"
          onClick={() => setPosPhase('HEADER')}
          className={`px-4 py-2 rounded transition-all flex items-center space-x-1 ${
            posPhase === 'HEADER' ? 'bg-[#006e25] text-white font-extrabold shadow' : 'bg-[#0000aa]/40 text-white/70 hover:text-white'
          }`}
        >
          <span>1. Cabeçalho (Cliente)</span>
        </button>

        <span className="material-symbols-outlined text-sm">chevron_right</span>

        <button
          type="button"
          onClick={() => setPosPhase('LINES')}
          className={`px-4 py-2 rounded transition-all flex items-center space-x-1 ${
            posPhase === 'LINES' ? 'bg-[#006e25] text-white font-extrabold shadow' : 'bg-[#0000aa]/40 text-white/70 hover:text-white'
          }`}
        >
          <span>2. Linhas de Artigos ({items.length})</span>
        </button>

        <span className="material-symbols-outlined text-sm">chevron_right</span>

        <button
          type="button"
          onClick={() => setPosPhase('FOOTER')}
          className={`px-4 py-2 rounded transition-all flex items-center space-x-1 ${
            posPhase === 'FOOTER' ? 'bg-[#006e25] text-white font-extrabold shadow' : 'bg-[#0000aa]/40 text-white/70 hover:text-white'
          }`}
        >
          <span>3. Rodapé & Totais ({formatMZN(totalFinalAmount)})</span>
        </button>
      </div>

      {/* FASE 1: CABEÇALHO */}
      {(posPhase === 'HEADER' || posPhase === 'LINES' || posPhase === 'FOOTER') && (
        <section className={`bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded shadow-sm transition-all ${
          posPhase !== 'HEADER' ? 'opacity-80' : ''
        }`}>
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff]">
              {`[ ${documentType === 'CUSTOMER_INVOICE' ? 'Factura a Cliente' : documentType === 'CASH_SALE' ? 'Venda a Dinheiro' : 'Guia de Remessa'} - Cabeçalho ]`}
            </h3>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={loadLastDocument}
                className="text-xs bg-[#003366] text-white px-2.5 py-1 rounded font-bold hover:bg-blue-800 transition-colors"
                title={`Puxar cliente do último documento de ${documentType === 'CASH_SALE' ? 'VD' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura'}`}
              >
                {`F2 — Puxar Última ${documentType === 'CASH_SALE' ? 'VD' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia' : 'Factura'}`}
              </button>
              {posPhase !== 'HEADER' && (
                <button onClick={() => setPosPhase('HEADER')} className="text-xs text-[#006e25] font-bold hover:underline">
                  ✏ Alterar Cabeçalho
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3 text-xs">
            <div className="col-span-12 md:col-span-2">
              <label className="block font-bold text-[#737780] uppercase mb-1">Tipo de Documento</label>
              <select
                value={documentType}
                onChange={(e) => {
                  const val = e.target.value as 'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE';
                  setDocumentType(val);
                  if (val === 'CASH_SALE' && receiptMethod) {
                    setPaymentSelection(`METHOD:${receiptMethod.code}`);
                  }
                }}
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring font-bold text-[#003366] dark:text-[#a7c8ff]"
              >
                <option value="CUSTOMER_INVOICE">Factura</option>
                <option value="CASH_SALE">Venda a Dinheiro (VD)</option>
                <option value="CUSTOMER_DELIVERY_NOTE">Guia de Remessa</option>
              </select>
            </div>

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

            <div className="col-span-12 md:col-span-1">
              <label className="block font-bold text-[#737780] uppercase mb-1">Código Cliente</label>
              <input
                type="text"
                placeholder="Ex: 5"
                value={clientCodeInput}
                onChange={(e) => handleClientCodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleClientCodeChange(clientCodeInput);
                    document.querySelector<HTMLInputElement>('input[placeholder="Nome do Cliente"]')?.focus();
                  }
                }}
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring font-bold"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block font-bold text-[#737780] uppercase mb-1">Nome do Cliente *</label>
              <input
                type="text"
                value={selectedClientName}
                onChange={(e) => setSelectedClientName(e.target.value)}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
              />
            </div>

            <div className="col-span-12 md:col-span-1">
              <label className="block font-bold text-[#737780] uppercase mb-1">NUIT</label>
              <input
                type="text"
                value={clientNuit}
                onChange={(e) => setClientNuit(e.target.value)}
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block font-bold text-[#737780] uppercase mb-1">Morada</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-sm focus-ring"
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
      )}

      {/* Client Pending Invoices Table */}
      {showClientInvoices && selectedClientId && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[#ba1a1a] dark:text-[#ffb4ab]">Documentos Pendentes - {selectedClientName}</h3>
            <button onClick={() => setShowClientInvoices(false)} className="text-[#737780] hover:text-[#191c1d] dark:hover:text-white font-bold text-sm">✕ Fechar</button>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2">Documento</th>
                <th className="p-2">Data</th>
                <th className="p-2">Tipo</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {documents?.filter(d => d.partyId === selectedClientId && d.outstandingAmount > 0).map(d => (
                <tr key={d.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-2">{d.displayNumber}</td>
                  <td className="p-2">{d.date}</td>
                  <td className="p-2 font-sans">{d.typeName}</td>
                  <td className="p-2 text-right">{formatMZN(d.grandTotal)}</td>
                  <td className="p-2 text-right font-bold text-red-600">{formatMZN(d.outstandingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* FASE 2: LINHAS DE ARTIGOS */}
      {(posPhase === 'LINES' || posPhase === 'FOOTER') && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
          <div className="bg-[#001e40] text-white px-4 py-2 text-xs font-bold uppercase flex justify-between items-center">
            <span>[ Linhas da Fatura / Guia ]</span>
            <span>Linhas inseridas: {items.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
                <tr>
                  <th className="p-3 w-44">Código Artigo</th>
                  <th className="p-3">Descrição do Item / Pneu</th>
                  <th className="p-3 w-20 text-center">Quant.</th>
                  <th className="p-3 w-32 text-right">Preço</th>
                  <th className="p-3 w-20 text-center">Ds %</th>
                  <th className="p-3 w-20 text-center">Iv</th>
                  <th className="p-3 w-36 text-right">Iliquido c/ IVA</th>
                  <th className="p-3 w-12 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
                {/* Quick Insertion Bar matching Screen 11 & 13 */}
                {posPhase === 'LINES' && (
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
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
                        title="Adicionar Item"
                      >
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                      </button>
                    </td>
                  </tr>
                )}

                {/* Added Line Items */}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500 italic">
                      Nenhum item adicionado. Introduza os artigos na barra de inserção rápida acima.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FASE 3: RODAPÉ & TOTAIS */}
      {(posPhase === 'FOOTER' || posPhase === 'LINES') && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded shadow-sm space-y-4">
          <div className="border-b border-[#c3c6d1] dark:border-[#43474f] pb-2 flex justify-between items-center text-[#191c1d] dark:text-white">
            <h3 className="font-extrabold text-sm uppercase">
              [ Factura a Cliente — Rodapé e Totais ]
            </h3>
            <span className="text-xs font-bold">
              Cliente: {selectedClientName}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-4 text-xs">
            {/* Left Box: Desconto Geral & Observações */}
            <div className="col-span-12 md:col-span-6 space-y-3 bg-[#f3f4f5] dark:bg-[#282c2e] p-3 rounded border border-[#c3c6d1] dark:border-[#43474f]">
              <div className="flex items-center space-x-2">
                <label className="font-bold uppercase text-[#191c1d] dark:text-white">% Desconto Geral:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={generalDiscount}
                  onChange={(e) => setGeneralDiscount(Number(e.target.value))}
                  className="w-20 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-1 text-center font-bold text-[#191c1d] dark:text-white"
                />
                <span className="font-bold text-[#191c1d] dark:text-white">Valor: {formatMZN(descontoGeralValor)}</span>
              </div>

              <div>
                <label className="block font-bold uppercase text-[#191c1d] dark:text-white mb-1">Observações / Garantias:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações da fatura ou termos de garantia dos pneus..."
                  className="w-full h-20 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs text-[#191c1d] dark:text-white focus:outline-none"
                ></textarea>
              </div>
            </div>

            {/* Right Box: Totais Discriminados por Código IVA & Resumo Total */}
            <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-3">
              {/* Discriminação IVA */}
              <div className="border border-[#c3c6d1] dark:border-[#43474f] p-2 bg-[#f3f4f5] dark:bg-[#282c2e] text-[11px] font-mono space-y-1">
                <div className="border-b border-[#c3c6d1] dark:border-[#43474f] font-bold flex justify-between text-[#191c1d] dark:text-white uppercase text-[10px]">
                  <span>CD</span>
                  <span>VALOR BASE IVA</span>
                  <span>VALOR TOTAL</span>
                </div>
                <div className="flex justify-between font-bold text-[#191c1d] dark:text-white">
                  <span>1</span>
                  <span>{subtotalLiquido.toFixed(2)}</span>
                  <span>{ivaTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#737780]">
                  <span>0</span>
                  <span>0.00</span>
                  <span>0.00</span>
                </div>
              </div>

              {/* Quadro de Totais */}
              <div className="border border-[#c3c6d1] dark:border-[#43474f] p-3 bg-[#f3f4f5] dark:bg-[#282c2e] text-xs font-mono space-y-1.5 flex flex-col justify-between">
                <div className="flex justify-between text-[#191c1d] dark:text-white">
                  <span className="font-bold">ILIQUIDO:</span>
                  <span>{formatMZN(subtotalBruto)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>DESCONTOS:</span>
                  <span>-{formatMZN(descontoLinhas + descontoGeralValor)}</span>
                </div>
                <div className="flex justify-between text-[#191c1d] dark:text-white">
                  <span>IVA:</span>
                  <span>{formatMZN(ivaTotal)}</span>
                </div>
                <div className="pt-2 border-t border-[#c3c6d1] dark:border-[#43474f] flex justify-between items-center text-sm font-black text-[#191c1d] dark:text-white">
                  <span>TOTAL:</span>
                  <span className="text-xl text-[#006e25] font-extrabold">{formatMZN(totalFinalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-3 border-t border-[#c3c6d1] dark:border-[#43474f]">
            {saveError && (
              <p role="alert" className="rounded bg-red-100 p-2 text-xs font-bold text-red-800">
                {saveError}
              </p>
            )}
            <div className="flex items-center space-x-3 ml-auto">
              <button
                type="button"
                onClick={() => { setItems([]); setPosPhase('HEADER'); }}
                className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:bg-red-800"
              >
                Novo Documento (F5)
              </button>
              <button
                type="button"
                disabled={saving || items.length === 0}
                onClick={() => void handleSaveAndConfirm(true)}
                className="px-4 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:brightness-110 disabled:opacity-50"
              >
                Gravar & Imprimir (F9)
              </button>
              <button
                type="button"
                disabled={saving || items.length === 0}
                onClick={() => void handleSaveAndConfirm(false)}
                className="px-6 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:brightness-110 shadow-sm disabled:opacity-50"
              >
                {saving ? 'A gravar…' : 'Gravar Fatura (F2)'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Dynamic XT-POS PRO Bottom Status Bar */}
      <div className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-white border-t border-[#c3c6d1] dark:border-[#43474f] px-6 py-2 text-xs font-mono font-bold flex items-center justify-between rounded shadow-sm mt-4">
        <div className="flex items-center space-x-6">
          {posPhase === 'HEADER' && (
            <>
              <span>ESC=Sair</span>
              <span>TAB=Tabelas</span>
              <span className="bg-[#c3c6d1] dark:bg-[#43474f] px-1 rounded">F2=Ult/Cont</span>
              <span>F9=2ªvia</span>
              <span>PgUp/Dn=Prox/Ant</span>
            </>
          )}
          {posPhase === 'LINES' && (
            <>
              <span>ESC=Sair</span>
              <span>TAB=Tabelas</span>
              <span className="bg-[#c3c6d1] dark:bg-[#43474f] px-1 rounded">F2=Continuar</span>
              <span>Ctrl-Del/Ins=Linhas</span>
            </>
          )}
          {posPhase === 'FOOTER' && (
            <>
              <span>ESC=Sair</span>
              <span className="bg-[#c3c6d1] dark:bg-[#43474f] px-1 rounded">F2=Gravar</span>
              <span>F3=Ajustar</span>
              <span>F5=Novo</span>
              <span>F9=Imp</span>
            </>
          )}
        </div>
        <div className="text-[11px]">
          Fase Ativa: <span className="uppercase text-[#006e25]">{posPhase}</span> | Cliente: <b>{selectedClientName || 'Nenhum'}</b>
        </div>
      </div>
    </div>
  );
};
