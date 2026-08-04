import React, { useState, useEffect, useRef } from 'react';
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
  const [documentType, setDocumentType] = useState<'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE'>('CUSTOMER_INVOICE');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [docNumber, setDocNumber] = useState('A atribuir ao confirmar');
  const [docStatus, setDocStatus] = useState<'PREPARATION' | 'CONFIRMING' | 'CONFIRMED' | 'READ_ONLY'>('PREPARATION');

  const [clientCodeInput, setClientCodeInput] = useState(clients[0]?.number || clients[0]?.code || '');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [selectedClientName, setSelectedClientName] = useState(clients[0]?.name ?? '');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [showClientInvoices, setShowClientInvoices] = useState(false);

  const immediateTerm = paymentTerms.find((item) => item.requiresImmediatePayment);
  const creditTerm = paymentTerms.find((item) => !item.requiresImmediatePayment);
  const receiptMethod = paymentMethods.find((item) => item.allowsCustomerReceipt);
  const [paymentSelection, setPaymentSelection] = useState(
    canReceivePayment && receiptMethod ? `METHOD:${receiptMethod.code}` : `TERM:${creditTerm?.code ?? immediateTerm?.code ?? ''}`
  );
  const [deliveryLocation, setDeliveryLocation] = useState('');

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const [inputIva, setInputIva] = useState<number>(articles[0]?.taxRate ?? 16);
  const [inputUnitPrice, setInputUnitPrice] = useState<number>(0);

  const [generalDiscount, setGeneralDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmedSaleRecord, setConfirmedSaleRecord] = useState<SaleInvoice | null>(null);

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const ivaInputRef = useRef<HTMLInputElement>(null);

  const confirmResetIfNeeded = (): boolean => {
    if (items.length > 0 && docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY') {
      return window.confirm('Existem artigos/alterações não gravadas. Deseja descartar?');
    }
    return true;
  };

  const handleSelectDocumentType = (type: 'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE') => {
    if (!confirmResetIfNeeded()) return;

    setDocumentType(type);
    setDocStatus('PREPARATION');
    setItems([]);
    setConfirmedSaleRecord(null);
    setSaveError('');

    if (type === 'CASH_SALE') {
      const pontual = clients.find((c) => c.name.toLowerCase().includes('pontual')) || clients[0];
      if (pontual) {
        setSelectedClientId(pontual.id);
        setSelectedClientName(pontual.name);
        setClientCodeInput(pontual.number || pontual.code || '');
        setClientNuit('');
        setClientAddress('');
      }
      if (receiptMethod) setPaymentSelection(`METHOD:${receiptMethod.code}`);
    } else {
      if (clients[0]) {
        setSelectedClientId(clients[0].id);
        setSelectedClientName(clients[0].name);
        setClientCodeInput(clients[0].number || clients[0].code || '');
      }
    }
  };

  const lookupClientByCode = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    // Code 1 (or 01) is ALWAYS reserved for Cliente Pontual
    if (clean === '1' || clean === '01') {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
      setShowClientInvoices(false);
      return;
    }

    const found = clients.find(
      (c) =>
        c.number !== '1' &&
        c.code !== '1' &&
        ((c.number && c.number.trim().toLowerCase() === clean) ||
          (c.code && c.code.trim().toLowerCase() === clean) ||
          c.id.toLowerCase() === clean ||
          String(c.number) === clean ||
          c.name.toLowerCase().includes(clean))
    );

    if (found) {
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit || '');
      setClientAddress(found.address || '');
      setClientCodeInput(found.number || found.code || query);
      if (documents?.some((d) => d.partyId === found.id && d.outstandingAmount > 0)) {
        setShowClientInvoices(true);
      } else {
        setShowClientInvoices(false);
      }
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientNuit('');
      setClientAddress('');
      setShowClientInvoices(false);
    }
  };

  const handleArticleSelect = (id: string) => {
    setSelectedArticleId(id);
    const art = articles.find((a) => a.id === id);
    if (art) {
      setInputIva(art.taxRate ?? 16);
      setInputUnitPrice(art.sellPrice);
    }
  };

  const handleAfterArticleSelect = () => {
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 40);
  };

  const handleAddItem = () => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') return;

    const art = articles.find((a) => a.id === selectedArticleId);
    if (!art || inputQty <= 0) return;

    const basePrice = inputUnitPrice > 0 ? inputUnitPrice : art.sellPrice;
    const discountedPrice = basePrice * (1 - inputDiscount / 100);
    const itemTotalWithIva = discountedPrice * inputQty * (1 + inputIva / 100);

    const newItem: SaleItem = {
      articleId: art.id,
      code: art.code,
      description: art.description,
      quantity: inputQty,
      unitPrice: basePrice,
      discountPercent: inputDiscount,
      ivaPercent: inputIva,
      total: Math.round(itemTotalWithIva * 100) / 100,
    };

    setItems((current) => [...current, newItem]);
    setInputQty(1);
    setInputDiscount(0);
    setSelectedArticleId('');
    setInputUnitPrice(0);

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 40);
  };

  const handleRemoveItem = (index: number) => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const loadLastDocumentInConsultationMode = () => {
    if (!documents || documents.length === 0) {
      setSaveError('Nenhum documento anterior encontrado na base de dados.');
      return false;
    }

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
    }

    setDocNumber(targetDoc.displayNumber);
    setDate(targetDoc.date);
    setDocStatus('READ_ONLY');
    setSaveError('');

    const consultSale: SaleInvoice = {
      id: targetDoc.id,
      clientId: targetDoc.partyId,
      docNumber: targetDoc.displayNumber,
      date: targetDoc.date,
      clientName: targetDoc.partyName || selectedClientName,
      clientNuit: found?.nuit || '',
      clientAddress: found?.address || '',
      paymentMethod: 'CASH',
      sellerName: operatorName,
      items: [],
      subtotalBruto: targetDoc.netTotal,
      descontoTotal: 0,
      subtotalLiquido: targetDoc.netTotal,
      ivaTotal: targetDoc.taxTotal,
      totalAmount: targetDoc.grandTotal,
      paidAmount: targetDoc.paidAmount,
      pendingAmount: targetDoc.outstandingAmount,
      status: targetDoc.status === 'CONFIRMED' ? 'Concluída' : 'Pendente',
    };

    setConfirmedSaleRecord(consultSale);
    return true;
  };

  const handleDuplicateToNewDocument = () => {
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao confirmar');
    setConfirmedSaleRecord(null);
    setSaveError('');
  };

  const subtotalBruto = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const descontoLinhas = items.reduce((acc, item) => acc + item.unitPrice * item.quantity * (item.discountPercent / 100), 0);
  const totalAfterLineDiscount = subtotalBruto - descontoLinhas;
  const descontoGeralValor = totalAfterLineDiscount * (generalDiscount / 100);
  const subtotalLiquido = totalAfterLineDiscount - descontoGeralValor;

  const ivaTotal = items.reduce((acc, item) => {
    const lineNet = item.unitPrice * item.quantity * (1 - item.discountPercent / 100) * (1 - generalDiscount / 100);
    return acc + (lineNet * item.ivaPercent) / 100;
  }, 0);

  const totalFinalAmount = subtotalLiquido + ivaTotal;

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const previousBalance = selectedClient?.pendingBalance ?? 0;
  const newAccumulatedBalance = previousBalance + (documentType === 'CUSTOMER_DELIVERY_NOTE' ? 0 : totalFinalAmount);

  const handleSaveAndConfirm = async (shouldPrint: boolean = false) => {
    if (items.length === 0) {
      setSaveError('Adicione pelo menos 1 artigo ao documento.');
      return;
    }
    if (!selectedClientId) {
      setSaveError('Selecione um cliente válido.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const newSale: SaleInvoice = {
        id: `sale-${Date.now()}`,
        clientId: selectedClientId,
        documentTypeCode: documentType,
        docNumber: 'A atribuir ao confirmar',
        date,
        clientName: selectedClientName,
        clientNuit,
        clientAddress,
        paymentMethod:
          paymentSelection.startsWith('METHOD:')
            ? paymentSelection.replace('METHOD:', '')
            : 'CASH',
        paymentTermCode: paymentSelection.startsWith('TERM:')
          ? paymentSelection.replace('TERM:', '')
          : undefined,
        sellerName: operatorName,
        items,
        subtotalBruto,
        descontoTotal: descontoLinhas + descontoGeralValor,
        subtotalLiquido,
        ivaTotal,
        totalAmount: totalFinalAmount,
        paidAmount: documentType === 'CASH_SALE' ? totalFinalAmount : 0,
        pendingAmount: documentType === 'CASH_SALE' || documentType === 'CUSTOMER_DELIVERY_NOTE' ? 0 : totalFinalAmount,
        status: 'Concluída',
        notes,
      };

      const savedSale = await onCompleteSale(newSale);
      setDocNumber(savedSale.docNumber || 'CONFIRMADO');
      setConfirmedSaleRecord(savedSale);
      setDocStatus('CONFIRMED');

      if (shouldPrint) {
        onOpenPrintModal(savedSale);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao confirmar o documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    if (!confirmResetIfNeeded()) return;

    setItems([]);
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao confirmar');
    setSaveError('');
    setConfirmedSaleRecord(null);
    setGeneralDiscount(0);
    setNotes('');

    if (documentType === 'CASH_SALE') {
      const pontual = clients.find((c) => c.name.toLowerCase().includes('pontual')) || clients[0];
      if (pontual) {
        setSelectedClientId(pontual.id);
        setSelectedClientName(pontual.name);
        setClientCodeInput(pontual.number || pontual.code || '');
      }
    } else if (clients[0]) {
      setSelectedClientId(clients[0].id);
      setSelectedClientName(clients[0].name);
      setClientCodeInput(clients[0].number || clients[0].code || '');
    }

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Ex: 5"]')?.focus();
    }, 50);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        loadLastDocumentInConsultationMode();
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        if (docStatus === 'CONFIRMING') {
          void handleSaveAndConfirm(false);
        } else if (docStatus === 'PREPARATION') {
          if (items.length > 0) {
            setDocStatus('CONFIRMING');
          } else {
            setSaveError('Adicione pelo menos 1 artigo antes de gravar com F2.');
          }
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (docStatus === 'CONFIRMING') {
          setDocStatus('PREPARATION');
        } else if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
          setSaveError('Documento já confirmado/leitura. Alterações directas bloqueadas.');
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if ((docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord) {
          onOpenPrintModal(confirmedSaleRecord);
        } else {
          setSaveError('Confirme primeiro o documento com F2 antes de imprimir (F9).');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (docStatus === 'CONFIRMING') {
          setDocStatus('PREPARATION');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docStatus, items, selectedClientId, totalFinalAmount, clients, documents, documentType, confirmedSaleRecord]);

  return (
    <div className="space-y-4 pb-12 font-sans">
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleSelectDocumentType('CUSTOMER_INVOICE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              documentType === 'CUSTOMER_INVOICE'
                ? 'bg-[#003366] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Factura
          </button>
          <button
            type="button"
            onClick={() => handleSelectDocumentType('CASH_SALE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              documentType === 'CASH_SALE'
                ? 'bg-[#006e25] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Venda a Dinheiro (VD)
          </button>
          <button
            type="button"
            onClick={() => handleSelectDocumentType('CUSTOMER_DELIVERY_NOTE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              documentType === 'CUSTOMER_DELIVERY_NOTE'
                ? 'bg-[#001e40] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Guia de Remessa
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="text-right">
            <span className="text-[#737780] block text-[10px] uppercase font-bold">Nº Documento</span>
            <span className="font-bold text-sm text-[#003366] dark:text-[#a7c8ff]">{docNumber}</span>
          </div>
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <span
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase ${
              docStatus === 'CONFIRMED'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : docStatus === 'READ_ONLY'
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : docStatus === 'CONFIRMING'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {docStatus === 'CONFIRMED'
              ? 'CONFIRMADO'
              : docStatus === 'READ_ONLY'
              ? 'EM CONSULTA (LEITURA)'
              : docStatus === 'CONFIRMING'
              ? 'A CONFIRMAR'
              : 'EM PREPARAÇÃO'}
          </span>
          <button
            type="button"
            onClick={loadLastDocumentInConsultationMode}
            className="rounded bg-slate-800 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-900 transition-colors"
            title="Consultar último documento (Ctrl+L)"
          >
            Último Documento (Ctrl+L)
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            F5 — Novo
          </button>
        </div>
      </section>

      {docStatus === 'READ_ONLY' && (
        <div className="bg-purple-50 border border-purple-300 p-3 rounded-lg flex items-center justify-between text-xs font-mono">
          <span className="font-bold text-purple-900">
            📄 DOCUMENTO EM CONSULTA (#{docNumber}) — MODO LEITURA (Sem novos lançamentos ou saídas de stock)
          </span>
          <button
            type="button"
            onClick={handleDuplicateToNewDocument}
            className="bg-purple-700 text-white px-3 py-1 rounded font-bold hover:bg-purple-800"
          >
            Copiar para Novo Documento
          </button>
        </div>
      )}

      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm print:shadow-none space-y-2 print:space-y-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs print:text-[10px]">
          {/* Left Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Data Emissão</label>
                <input
                  type="date"
                  value={date}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Código Cliente</label>
                <input
                  type="text"
                  placeholder="Ex: 5"
                  value={clientCodeInput}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupClientByCode(clientCodeInput);
                      document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]')?.focus();
                    }
                  }}
                  onBlur={() => lookupClientByCode(clientCodeInput)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-bold disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Nome do Cliente *</label>
              <input
                type="text"
                value={selectedClientName}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setSelectedClientName(e.target.value)}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">NUIT</label>
                <input
                  type="text"
                  value={clientNuit}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientNuit(e.target.value)}
                  placeholder="NUIT (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Morada</label>
                <input
                  type="text"
                  value={clientAddress}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Morada (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              {documentType === 'CUSTOMER_INVOICE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Condição de Pagamento</label>
                  <select
                    value={paymentSelection}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setPaymentSelection(e.target.value)}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#003366] disabled:opacity-60"
                  >
                    {paymentTerms.map((term) => (
                      <option key={term.id} value={`TERM:${term.code}`}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {documentType === 'CASH_SALE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Método de Pagamento</label>
                  <select
                    value={paymentSelection}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setPaymentSelection(e.target.value)}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#006e25] disabled:opacity-60"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={`METHOD:${method.code}`}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {documentType === 'CUSTOMER_DELIVERY_NOTE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Local de Entrega / Expedição</label>
                  <input
                    type="text"
                    value={deliveryLocation}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="Ex: Armazém Central ou Destino do Cliente"
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-mono disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          </div>

          {selectedClientId && documentType !== 'CUSTOMER_DELIVERY_NOTE' && (
            <div className="col-span-1 md:col-span-2 bg-[#003366]/10 p-2 print:p-1 rounded border border-[#003366]/20 flex items-center justify-between text-xs print:text-[10px] font-mono">
              <div>
                <span className="font-bold text-[#001e40] dark:text-white">Cliente Activo: {selectedClientName}</span>
                {previousBalance > 0 && (
                  <span className="ml-3 text-red-600 font-bold">
                    Saldo Pendente Anterior: {formatMZN(previousBalance)}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span>Valor Documento: <b>{formatMZN(totalFinalAmount)}</b></span>
                <span className="text-[#006e25] font-extrabold text-sm">
                  Novo Saldo Acumulado: {formatMZN(newAccumulatedBalance)}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {showClientInvoices && selectedClientId && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-xs uppercase text-red-600">Documentos Pendentes em Aberto - {selectedClientName}</h3>
            <button onClick={() => setShowClientInvoices(false)} className="text-[#737780] hover:text-[#191c1d] dark:hover:text-white font-bold text-xs">✕ Fechar</button>
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

      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#001e40] text-white px-4 py-2 text-xs font-bold uppercase flex justify-between items-center">
          <span>[ Linhas de Artigos — {documentType === 'CASH_SALE' ? 'VD' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura'} ]</span>
          <span>Total de Linhas: {items.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-3 w-48">Código Artigo</th>
                <th className="p-3">Descrição do Item / Pneu</th>
                <th className="p-3 w-20 text-center">Existência</th>
                <th className="p-3 w-24 text-center">Quant.</th>
                <th className="p-3 w-28 text-right">Preço Unit.</th>
                <th className="p-3 w-20 text-center">Desc %</th>
                <th className="p-3 w-20 text-center">IVA %</th>
                <th className="p-3 w-32 text-right">Total c/ IVA</th>
                <th className="p-3 w-16 text-center print:hidden">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
                <tr className="bg-[#0000aa]/10 dark:bg-[#282c2e] border-b-2 border-[#003366] print:hidden">
                  <td className="p-2" colSpan={2}>
                    <ArticleSearchSelect
                      articles={articles}
                      selectedArticleId={selectedArticleId}
                      onSelect={handleArticleSelect}
                      onAfterSelect={handleAfterArticleSelect}
                      renderLabel={(a) => `[${a.code}] ${a.description} - ${a.sellPrice.toFixed(2)} MZN (Existência: ${a.stock})`}
                      placeholder="Pesquisar artigo por código ou descrição… (Enter para seleccionar)"
                    />
                  </td>
                  <td className="p-2 text-center font-bold text-[#006e25]">
                    {articles.find(a => a.id === selectedArticleId)?.stock ?? 0}
                  </td>
                  <td className="p-2">
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold bg-yellow-100 text-black focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-gray-700 dark:text-white">
                    <input
                      ref={unitPriceInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputUnitPrice || (articles.find(a => a.id === selectedArticleId)?.sellPrice ?? 0)}
                      onChange={(e) => setInputUnitPrice(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-right text-xs font-bold text-[#001e40] dark:text-white focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      max="100"
                      value={inputDiscount}
                      onChange={(e) => setInputDiscount(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-red-600 focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      ref={ivaInputRef}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={inputIva}
                      onChange={(e) => setInputIva(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-[#003366] focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2 text-right font-extrabold text-[#006e25]">
                    {(
                      ((inputUnitPrice > 0 ? inputUnitPrice : (articles.find(a => a.id === selectedArticleId)?.sellPrice || 0)) * (1 - inputDiscount / 100)) * inputQty * (1 + inputIva / 100)
                    ).toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded bg-[#003366] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-400 uppercase tracking-wider"
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${item.articleId}-${index}`} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                  <td className="p-3 font-sans text-xs">{item.description}</td>
                  <td className="p-3 text-center text-slate-500">
                    {articles.find((a) => a.id === item.articleId)?.stock ?? '-'}
                  </td>
                  <td className="p-3 text-center font-bold">{item.quantity}</td>
                  <td className="p-3 text-right">{formatMZN(item.unitPrice)}</td>
                  <td className="p-3 text-center text-red-600">{item.discountPercent}%</td>
                  <td className="p-3 text-center font-bold text-[#003366]">{item.ivaPercent}%</td>
                  <td className="p-3 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                  <td className="p-3 text-center print:hidden">
                    {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 font-bold text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                    Nenhum artigo inserido. Digite o código do artigo no campo acima e prima Enter para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm print:shadow-none space-y-3 print:space-y-1">
        <div className="grid grid-cols-12 gap-3 print:gap-2">
          <div className="col-span-12 md:col-span-6 space-y-2 print:space-y-1 bg-[#f3f4f5] dark:bg-[#282c2e] p-2.5 print:p-1.5 rounded-lg border border-[#c3c6d1] dark:border-[#43474f]">
            <div className="flex items-center space-x-3 text-xs print:text-[10px]">
              <label className="font-bold uppercase text-[#191c1d] dark:text-white">% Desconto Geral:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={generalDiscount}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setGeneralDiscount(Number(e.target.value))}
                className="w-16 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-0.5 text-center font-bold text-[#191c1d] dark:text-white disabled:opacity-60"
              />
              <span className="font-bold text-[#191c1d] dark:text-white">Valor: {formatMZN(descontoGeralValor)}</span>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#191c1d] dark:text-white mb-0.5 text-xs print:text-[10px]">Observações / Garantias:</label>
              <textarea
                value={notes}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações da fatura ou termos de garantia dos pneus..."
                className="w-full h-12 print:h-8 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] text-[#191c1d] dark:text-white focus:outline-none disabled:opacity-60"
              ></textarea>
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-2 print:gap-1.5">
            <div className="border border-[#c3c6d1] dark:border-[#43474f] p-2 print:p-1.5 bg-[#f3f4f5] dark:bg-[#282c2e] text-[11px] print:text-[10px] font-mono space-y-1 rounded-lg">
              <div className="border-b border-[#c3c6d1] dark:border-[#43474f] font-bold flex justify-between text-[#191c1d] dark:text-white uppercase text-[10px] print:text-[9px] pb-0.5">
                <span>CD</span>
                <span>BASE IVA</span>
                <span>TOTAL IVA</span>
              </div>
              <div className="flex justify-between font-bold text-[#191c1d] dark:text-white">
                <span>1 (16%)</span>
                <span>{subtotalLiquido.toFixed(2)}</span>
                <span>{ivaTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#737780]">
                <span>0 (0%)</span>
                <span>0.00</span>
                <span>0.00</span>
              </div>
            </div>

            <div className="border border-[#c3c6d1] dark:border-[#43474f] p-2.5 print:p-1.5 bg-[#f3f4f5] dark:bg-[#282c2e] text-xs print:text-[10px] font-mono space-y-1 flex flex-col justify-between rounded-lg">
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
              <div className="pt-1 border-t border-[#c3c6d1] dark:border-[#43474f] flex justify-between items-center font-black text-[#191c1d] dark:text-white">
                <span>TOTAL:</span>
                <span className="text-xl print:text-sm text-[#006e25] font-extrabold">{formatMZN(totalFinalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {docStatus === 'CONFIRMING' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4 shadow-md font-sans print:hidden">
            <div>
              <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm uppercase">
                Confirmar Emissão de {documentType === 'CASH_SALE' ? 'Venda a Dinheiro' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura'}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Cliente: <b>{selectedClientName}</b> | Linhas: <b>{items.length}</b> | Total Final: <b>{formatMZN(totalFinalAmount)}</b>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setDocStatus('PREPARATION')}
                className="px-3 py-1.5 border border-amber-600 text-amber-900 dark:text-amber-200 rounded font-bold text-xs uppercase hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                F3 — Ajustar (ESC)
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveAndConfirm(false)}
                className="px-5 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:bg-green-700 shadow-md"
              >
                {saving ? 'A gravar na BD…' : 'F2 / Enter — Confirmar Definitivo'}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-[#c3c6d1] dark:border-[#43474f] print:hidden">
          {saveError && (
            <p role="alert" className="rounded bg-red-100 p-2 text-xs font-bold text-red-800 print:hidden">
              {saveError}
            </p>
          )}

          <div className="flex items-center space-x-3 ml-auto">
            {(docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord && (
              <button
                type="button"
                onClick={() => onOpenPrintModal(confirmedSaleRecord)}
                className="px-5 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:bg-blue-800 shadow-sm"
              >
                🖨 Imprimir Documento (F9)
              </button>
            )}

            {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
              <>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:bg-red-800"
                >
                  Novo (F5)
                </button>
                <button
                  type="button"
                  disabled={saving || items.length === 0}
                  onClick={() => {
                    if (docStatus === 'CONFIRMING') {
                      void handleSaveAndConfirm(true);
                    } else {
                      setDocStatus('CONFIRMING');
                    }
                  }}
                  className="px-4 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:brightness-110 disabled:opacity-50"
                >
                  Confirmar & Imprimir (F9)
                </button>
                <button
                  type="button"
                  disabled={saving || items.length === 0}
                  onClick={() => {
                    if (docStatus === 'CONFIRMING') {
                      void handleSaveAndConfirm(false);
                    } else {
                      setDocStatus('CONFIRMING');
                    }
                  }}
                  className="px-6 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:brightness-110 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'A gravar…' : docStatus === 'CONFIRMING' ? 'Confirmar (F2)' : 'Gravar (F2)'}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 rounded border-t border-[#c3c6d1] bg-[#e7e8e9] px-3 py-2 text-xs font-mono font-bold text-[#191c1d] shadow-sm dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <span>ESC=Sair</span>
          <button type="button" onClick={() => setDocStatus('CONFIRMING')} className="hover:underline">
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">F2=Gravar</span>
          </button>
          <button type="button" onClick={() => setDocStatus('PREPARATION')} className="hover:underline">
            <span>F3=Ajustar</span>
          </button>
          <button type="button" onClick={handleResetForm} className="hover:underline">
            <span>F5=Novo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if ((docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord) {
                onOpenPrintModal(confirmedSaleRecord);
              } else {
                setSaveError('Confirme primeiro o documento com F2 antes de imprimir com F9.');
              }
            }}
            className="hover:underline"
          >
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">F9=Imp</span>
          </button>
        </div>
        <div className="text-[11px]">
          Tipo Activo: <b className="uppercase text-[#006e25]">{documentType}</b> | Estado: <b>{docStatus}</b> | Cliente: <b>{selectedClientName || 'Nenhum'}</b>
        </div>
      </div>
    </div>
  );
};
