import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Article, Client, DocumentRecord, SaleInvoice, SaleItem } from '../types';
import { ArticleSearchSelect } from '../components/ArticleSearchSelect';
import { Pagination } from '../components/Pagination';
import { formatMZN } from '../stitch/stitchConfig';

interface QuotationProps {
  articles: Article[];
  clients: Client[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  onCreateQuotation: (quotation: SaleInvoice) => Promise<SaleInvoice>;
  onOpenPrintModal: (doc: SaleInvoice) => void;
  operatorName: string;
}

export const Quotation: React.FC<QuotationProps> = ({
  articles,
  clients,
  sales = [],
  documents = [],
  onCreateQuotation,
  onOpenPrintModal,
  operatorName,
}) => {
  const [docStatus, setDocStatus] = useState<'PREPARATION' | 'CONFIRMED' | 'READ_ONLY'>('PREPARATION');
  const [docNumber, setDocNumber] = useState('A atribuir ao emitir');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityDays, setValidityDays] = useState('15');

  // Client Selection
  const [clientCodeInput, setClientCodeInput] = useState('1');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('Cliente Pontual');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Item Entry State
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [inputQty, setInputQty] = useState(1);
  const [inputUnitPrice, setInputUnitPrice] = useState(0);
  const [inputDiscount, setInputDiscount] = useState(0);
  const [inputIva, setInputIva] = useState(16);

  // Items List
  const [items, setItems] = useState<SaleItem[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Processing state & SessionCreatedQuotations
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmedQuotationRecord, setConfirmedQuotationRecord] = useState<SaleInvoice | null>(null);
  const [sessionQuotations, setSessionQuotations] = useState<SaleInvoice[]>([]);

  // History Table Filters & Pagination
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyNameFilter, setHistoryNameFilter] = useState('');
  const [historyCodeFilter, setHistoryCodeFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(15);

  // Refs for fast Enter key field navigation
  const validityInputRef = useRef<HTMLInputElement>(null);
  const clientCodeInputRef = useRef<HTMLInputElement>(null);
  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const clientNuitInputRef = useRef<HTMLInputElement>(null);
  const clientAddressInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // Initialize Client Code 1 (Cliente Pontual) on mount
  useEffect(() => {
    const pontual = clients.find(
      (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
    ) || clients[0];

    if (pontual) {
      setSelectedClientId(pontual.id);
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    }
  }, [clients]);

  const lookupClientByCode = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    if (clean === '1' || clean === '01') {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
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
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientNuit('');
      setClientAddress('');
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

  const subtotalBruto = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const descontoLinhas = items.reduce((acc, item) => acc + item.unitPrice * item.quantity * (item.discountPercent / 100), 0);
  const totalAfterLineDiscount = subtotalBruto - descontoLinhas;
  const descontoGeralValor = totalAfterLineDiscount * (generalDiscount / 100);
  const subtotalLiquido = totalAfterLineDiscount - descontoGeralValor;

  const ivaTotal = items.reduce((acc, item) => {
    const itemNetAfterLineDiscount = item.unitPrice * item.quantity * (1 - item.discountPercent / 100);
    const itemShareOfGeneralDiscount = (itemNetAfterLineDiscount / (totalAfterLineDiscount || 1)) * descontoGeralValor;
    const itemTaxableBase = itemNetAfterLineDiscount - itemShareOfGeneralDiscount;
    return acc + itemTaxableBase * (item.ivaPercent / 100);
  }, 0);

  const totalFinalAmount = Math.round((subtotalLiquido + ivaTotal) * 100) / 100;

  const handleSaveQuotation = async (shouldPrint = false) => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
      if (shouldPrint && confirmedQuotationRecord) {
        onOpenPrintModal(confirmedQuotationRecord);
      }
      return;
    }

    if (items.length === 0) {
      setSaveError('Adicione pelo menos um artigo para emitir a cotação.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const quotation: SaleInvoice = {
        id: `cot-${Date.now()}`,
        clientId: selectedClientId,
        documentTypeCode: 'CUSTOMER_QUOTATION',
        docNumber: 'A atribuir ao emitir',
        date,
        clientName: selectedClientName,
        clientNuit,
        clientAddress,
        paymentMethod: 'CASH',
        sellerName: operatorName,
        items,
        subtotalBruto,
        descontoTotal: descontoLinhas + descontoGeralValor,
        subtotalLiquido,
        ivaTotal,
        totalAmount: totalFinalAmount,
        paidAmount: 0,
        pendingAmount: totalFinalAmount,
        status: 'Concluída',
        notes: notes ? `${notes} (Validade: ${validityDays} dias)` : `Proposta válida por ${validityDays} dias`,
      };

      const savedQuotation = await onCreateQuotation(quotation);
      setDocNumber(savedQuotation.docNumber || 'COT-CONFIRMADO');
      setConfirmedQuotationRecord(savedQuotation);
      setDocStatus('CONFIRMED');

      // Add to session list so it appears in table below immediately
      setSessionQuotations((prev) => [savedQuotation, ...prev]);

      if (shouldPrint) {
        onOpenPrintModal(savedQuotation);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao emitir cotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setItems([]);
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao emitir');
    setSaveError('');
    setConfirmedQuotationRecord(null);
    setGeneralDiscount(0);
    setNotes('');

    const pontualInDb = clients.find(
      (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
    ) || clients[0];

    setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
    setSelectedClientName('Cliente Pontual');
    setClientCodeInput('1');
    setClientNuit('');
    setClientAddress('');

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Ex: 1"]')?.focus();
    }, 50);
  };

  // Keyboard Shortcuts: F2 = Emitir, F5 = Novo, F9 = Imprimir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void handleSaveQuotation(false);
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        void handleSaveQuotation(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, saving, docStatus, confirmedQuotationRecord, selectedClientId, selectedClientName, date, notes]);

  // Extract all Quotations from sessionQuotations, sales, and documents props
  const quotationHistory = useMemo(() => {
    const list: Array<{
      id: string;
      docNumber: string;
      date: string;
      clientId?: string;
      clientName: string;
      clientNuit: string;
      clientAddress: string;
      totalAmount: number;
      status: string;
      items: SaleItem[];
      sellerName: string;
      rawSale?: SaleInvoice;
      rawDoc?: DocumentRecord;
    }> = [];

    const seenIds = new Set<string>();

    // 1. From sessionQuotations (instantly created in this session)
    sessionQuotations.forEach((s) => {
      seenIds.add(s.id);
      seenIds.add(s.docNumber);
      list.push({
        id: s.id,
        docNumber: s.docNumber,
        date: s.date,
        clientId: s.clientId,
        clientName: s.clientName,
        clientNuit: s.clientNuit || '',
        clientAddress: s.clientAddress || '',
        totalAmount: s.totalAmount,
        status: s.status || 'Emitida',
        items: s.items || [],
        sellerName: s.sellerName || operatorName,
        rawSale: s,
      });
    });

    // 2. From sales prop
    sales.forEach((s) => {
      const isCotation =
        s.documentTypeCode === 'CUSTOMER_QUOTATION' ||
        s.documentTypeCode === 'QUOTATION' ||
        s.documentTypeCode === 'COT' ||
        s.docNumber.toUpperCase().startsWith('COT') ||
        s.docNumber.toUpperCase().startsWith('CO/') ||
        s.docNumber.toUpperCase().startsWith('QUO') ||
        s.docNumber.toLowerCase().includes('cot') ||
        (s.notes && (s.notes.toLowerCase().includes('cotação') || s.notes.toLowerCase().includes('cotacao')));

      if (isCotation) {
        if (!seenIds.has(s.id) && !seenIds.has(s.docNumber)) {
          seenIds.add(s.id);
          seenIds.add(s.docNumber);
          list.push({
            id: s.id,
            docNumber: s.docNumber,
            date: s.date,
            clientId: s.clientId,
            clientName: s.clientName,
            clientNuit: s.clientNuit || '',
            clientAddress: s.clientAddress || '',
            totalAmount: s.totalAmount,
            status: s.status || 'Emitida',
            items: s.items || [],
            sellerName: s.sellerName || operatorName,
            rawSale: s,
          });
        }
      }
    });

    // 3. From documents prop
    documents.forEach((d) => {
      const isCotation =
        d.typeCode === 'CUSTOMER_QUOTATION' ||
        d.typeCode === 'QUOTATION' ||
        d.typeCode === 'COT' ||
        d.displayNumber.toUpperCase().startsWith('COT') ||
        d.displayNumber.toUpperCase().startsWith('CO/') ||
        d.displayNumber.toUpperCase().startsWith('QUO') ||
        d.displayNumber.toLowerCase().includes('cot') ||
        (d.typeName && (d.typeName.toLowerCase().includes('cotação') || d.typeName.toLowerCase().includes('cotacao')));

      if (isCotation && !seenIds.has(d.id) && !seenIds.has(d.displayNumber)) {
        const clientObj = clients.find((c) => c.id === d.partyId);
        list.push({
          id: d.id,
          docNumber: d.displayNumber,
          date: d.date,
          clientId: d.partyId,
          clientName: d.partyName || clientObj?.name || 'Cliente Pontual',
          clientNuit: clientObj?.nuit || '',
          clientAddress: clientObj?.address || '',
          totalAmount: d.grandTotal,
          status: 'Emitida',
          items: [],
          sellerName: d.salespersonName || operatorName,
          rawDoc: d,
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessionQuotations, sales, documents, clients, operatorName]);

  // Filtered Quotation History by Date, Name/Nuit, or Code/DocNo
  const filteredQuotations = useMemo(() => {
    return quotationHistory.filter((item) => {
      if (historyDateFilter && item.date.substring(0, 10) !== historyDateFilter) {
        return false;
      }
      if (historyNameFilter.trim()) {
        const q = historyNameFilter.trim().toLowerCase();
        const matchName = item.clientName.toLowerCase().includes(q);
        const matchNuit = item.clientNuit.toLowerCase().includes(q);
        if (!matchName && !matchNuit) return false;
      }
      if (historyCodeFilter.trim()) {
        const q = historyCodeFilter.trim().toLowerCase();
        const matchDocNo = item.docNumber.toLowerCase().includes(q);
        const matchItemCode = item.items.some((i) => i.code.toLowerCase().includes(q));
        if (!matchDocNo && !matchItemCode) return false;
      }
      return true;
    });
  }, [quotationHistory, historyDateFilter, historyNameFilter, historyCodeFilter]);

  // Paginated Quotations
  const paginatedQuotations = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredQuotations.slice(start, start + historyPageSize);
  }, [filteredQuotations, historyPage, historyPageSize]);

  const handlePrintQuotationFromHistory = (item: (typeof quotationHistory)[0]) => {
    if (item.rawSale) {
      onOpenPrintModal(item.rawSale);
    } else {
      const saleFormat: SaleInvoice = {
        id: item.id,
        clientId: item.clientId || 'client-pontual',
        documentTypeCode: 'CUSTOMER_QUOTATION',
        docNumber: item.docNumber,
        date: item.date,
        clientName: item.clientName,
        clientNuit: item.clientNuit,
        clientAddress: item.clientAddress,
        paymentMethod: 'CASH',
        sellerName: item.sellerName || operatorName,
        items: item.items,
        subtotalBruto: item.totalAmount,
        descontoTotal: 0,
        subtotalLiquido: item.totalAmount,
        ivaTotal: 0,
        totalAmount: item.totalAmount,
        paidAmount: 0,
        pendingAmount: item.totalAmount,
        status: 'Concluída',
      };
      onOpenPrintModal(saleFormat);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Header Banner */}
      <header className="flex flex-wrap items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f] gap-2">
        <div>
          <h2 className="text-xl font-black uppercase text-[#001e40] dark:text-[#a7c8ff] flex items-center gap-2">
            📋 Emissão de Proposta de Cotação
          </h2>
          <p className="text-xs text-[#737780] font-mono">
            Documento de orçamento sem afetação de stock físico. (Pressione F2 para gravar a qualquer momento)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="rounded bg-blue-100 dark:bg-blue-950 px-3 py-1 text-xs font-bold text-blue-900 dark:text-blue-200 border border-blue-300">
            ℹ️ Cotação (Não altera o stock)
          </span>
          <span className="rounded bg-[#e7e8e9] dark:bg-[#282c2e] px-3 py-1 text-xs font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">
            {docNumber}
          </span>
        </div>
      </header>

      {/* Header Form - Fast Enter key navigation */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {/* Left Column */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Data Emissão</label>
                <input
                  type="date"
                  value={date}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      validityInputRef.current?.focus();
                      validityInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
                />
              </div>
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Validade (Dias)</label>
                <input
                  ref={validityInputRef}
                  type="number"
                  min="1"
                  max="180"
                  value={validityDays}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setValidityDays(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientCodeInputRef.current?.focus();
                      clientCodeInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs text-center font-bold"
                />
              </div>
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Código Cliente</label>
                <input
                  ref={clientCodeInputRef}
                  type="text"
                  placeholder="Ex: 1"
                  value={clientCodeInput}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupClientByCode(clientCodeInput);
                      clientNameInputRef.current?.focus();
                      clientNameInputRef.current?.select();
                    }
                  }}
                  onBlur={() => lookupClientByCode(clientCodeInput)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring font-bold disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Nome do Cliente *</label>
              <input
                ref={clientNameInputRef}
                type="text"
                value={selectedClientName}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setSelectedClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    clientNuitInputRef.current?.focus();
                    clientNuitInputRef.current?.select();
                  }
                }}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">NUIT</label>
                <input
                  ref={clientNuitInputRef}
                  type="text"
                  value={clientNuit}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientNuit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientAddressInputRef.current?.focus();
                      clientAddressInputRef.current?.select();
                    }
                  }}
                  placeholder="NUIT (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Operador</label>
                <input
                  type="text"
                  value={operatorName}
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border rounded p-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Morada</label>
              <input
                ref={clientAddressInputRef}
                type="text"
                value={clientAddress}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setClientAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]');
                    if (searchInput) {
                      searchInput.focus();
                      searchInput.select();
                    }
                  }
                }}
                placeholder="Morada do Cliente (opcional)"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Item Entry Row - Fast Enter Navigation */}
      <section className="bg-[#0000aa]/5 dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-2 print:hidden">
        <span className="text-[11px] font-bold uppercase text-[#003366] dark:text-[#a7c8ff] block">
          + Inserir Artigo na Cotação (Pressione Enter para mudar de campo)
        </span>

        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 md:col-span-5">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Artigo</label>
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={selectedArticleId}
              onSelect={handleArticleSelect}
              onAfterSelect={handleAfterArticleSelect}
              searchByCodeOnly={false}
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              placeholder="Pesquisar artigo por código ou descrição…"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Qtd.</label>
            <input
              ref={qtyInputRef}
              type="number"
              min="0.001"
              step="1"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputQty}
              onChange={(e) => setInputQty(Math.max(0.001, Number(e.target.value)))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  unitPriceInputRef.current?.focus();
                  unitPriceInputRef.current?.select();
                }
              }}
              className="w-full bg-yellow-100 dark:bg-[#282c2e] font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Preço Un.</label>
            <input
              ref={unitPriceInputRef}
              type="number"
              step="0.01"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputUnitPrice || ''}
              onChange={(e) => setInputUnitPrice(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  discountInputRef.current?.focus();
                  discountInputRef.current?.select();
                }
              }}
              placeholder="0.00"
              className="w-full bg-white dark:bg-[#282c2e] font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-1">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Desc %</label>
            <input
              ref={discountInputRef}
              type="number"
              min="0"
              max="100"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputDiscount}
              onChange={(e) => setInputDiscount(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              className="w-full bg-white dark:bg-[#282c2e] font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <button
              type="button"
              disabled={!selectedArticleId || docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              onClick={handleAddItem}
              className="w-full bg-[#003366] text-white font-bold py-1.5 px-3 rounded text-xs hover:bg-[#002244] disabled:opacity-50 uppercase"
            >
              + Adicionar
            </button>
          </div>
        </div>
      </section>

      {/* Items Table */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-[#e1e2e4] font-bold uppercase border-b border-[#c3c6d1]">
            <tr>
              <th className="p-2 w-10 text-center">#</th>
              <th className="p-2">Código</th>
              <th className="p-2">Descrição</th>
              <th className="p-2 text-right">Qtd</th>
              <th className="p-2 text-right">Preço Un.</th>
              <th className="p-2 text-right">Desc %</th>
              <th className="p-2 text-right">IVA %</th>
              <th className="p-2 text-right">Total (c/ IVA)</th>
              <th className="p-2 text-center w-12 print:hidden">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
            {items.map((item, index) => (
              <tr key={`${item.articleId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                <td className="p-2 text-center text-slate-400 font-bold">{index + 1}</td>
                <td className="p-2 font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                <td className="p-2 font-sans font-medium">{item.description}</td>
                <td className="p-2 text-right font-bold">{item.quantity}</td>
                <td className="p-2 text-right">{formatMZN(item.unitPrice)}</td>
                <td className="p-2 text-right text-red-600">{item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td>
                <td className="p-2 text-right">{item.ivaPercent}%</td>
                <td className="p-2 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                <td className="p-2 text-center print:hidden">
                  <button
                    type="button"
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 font-bold hover:underline disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic">
                  Nenhum artigo inserido na cotação. Pesquise e adicione artigos acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Totals & Notes Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Observações */}
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-2">
          <label className="block font-bold text-[#737780] uppercase text-[11px]">Observações da Cotação</label>
          <textarea
            rows={3}
            value={notes}
            disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condições comerciais, prazos de entrega, validade da proposta..."
            className="w-full bg-white dark:bg-[#282c2e] border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs focus-ring"
          />
        </div>

        {/* Right Column: Financial Totals */}
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Subtotal Bruto:</span>
            <span>{formatMZN(subtotalBruto)}</span>
          </div>

          {(descontoLinhas + descontoGeralValor) > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Desconto Total:</span>
              <span>-{formatMZN(descontoLinhas + descontoGeralValor)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>IVA Total (16%):</span>
            <span>{formatMZN(ivaTotal)}</span>
          </div>

          <div className="flex justify-between items-center text-base font-black text-[#006e25] pt-2 border-t border-[#c3c6d1]">
            <span>TOTAL COTAÇÃO:</span>
            <span>{formatMZN(totalFinalAmount)}</span>
          </div>
        </div>
      </section>

      {saveError && (
        <div role="alert" className="p-3 bg-red-100 border border-red-300 rounded text-red-800 font-bold text-xs">
          ⚠️ {saveError}
        </div>
      )}

      {/* SECTION: Histórico de Cotações Emitidas com Paginação */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-2 gap-2">
          <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff] flex items-center gap-1.5">
            <span>📑</span> Histórico de Cotações Emitidas ({filteredQuotations.length})
          </h3>
          {(historyDateFilter || historyNameFilter || historyCodeFilter) && (
            <button
              type="button"
              onClick={() => {
                setHistoryDateFilter('');
                setHistoryNameFilter('');
                setHistoryCodeFilter('');
                setHistoryPage(1);
              }}
              className="text-xs font-bold text-red-600 hover:underline"
            >
              🧹 Limpar Filtros
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 sm:col-span-4 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Data</label>
            <input
              type="date"
              value={historyDateFilter}
              onChange={(e) => {
                setHistoryDateFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-mono"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Nome do Cliente</label>
            <input
              type="text"
              placeholder="Pesquisar por nome de cliente ou NUIT..."
              value={historyNameFilter}
              onChange={(e) => {
                setHistoryNameFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-5">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Código / N.º Cotação</label>
            <input
              type="text"
              placeholder="Ex: COT-2026/000001 ou código do artigo..."
              value={historyCodeFilter}
              onChange={(e) => {
                setHistoryCodeFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-mono"
            />
          </div>
        </div>

        {/* Quotations Table */}
        <div className="overflow-x-auto rounded border border-[#c3c6d1] dark:border-[#43474f]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-[#e1e2e4] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2.5">N.º Cotação</th>
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Cliente</th>
                <th className="p-2.5">Operador</th>
                <th className="p-2.5 text-right">Total (MT)</th>
                <th className="p-2.5 text-center">Estado</th>
                <th className="p-2.5 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {paginatedQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans italic">
                    Nenhuma cotação encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedQuotations.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                    <td className="p-2.5 font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {item.docNumber}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {item.date}
                    </td>
                    <td className="p-2.5 font-sans font-semibold">
                      {item.clientName}
                      {item.clientNuit ? <span className="text-slate-400 text-[10px] ml-1.5">(NUIT: {item.clientNuit})</span> : null}
                    </td>
                    <td className="p-2.5 font-sans text-slate-700 dark:text-slate-300 font-medium text-xs">
                      {item.sellerName || operatorName || 'Operador'}
                    </td>
                    <td className="p-2.5 text-right font-black text-[#006e25]">
                      {formatMZN(item.totalAmount)}
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300 uppercase">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handlePrintQuotationFromHistory(item)}
                        className="px-3 py-1 bg-[#003366] text-white font-bold rounded text-[11px] hover:bg-blue-900 flex items-center gap-1 mx-auto"
                      >
                        <span>🖨</span> Imprimir / Consultar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          currentPage={historyPage}
          totalItems={filteredQuotations.length}
          pageSize={historyPageSize}
          onPageChange={setHistoryPage}
          onPageSizeChange={setHistoryPageSize}
          pageSizeOptions={[15, 25, 50, 100]}
        />
      </section>

      {/* Action Footer Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[#e7e8e9] dark:bg-[#282c2e] border-t border-[#c3c6d1] dark:border-[#43474f] p-3 shadow-lg flex items-center justify-between print:hidden lg:left-[240px]">
        <div className="flex items-center space-x-3 text-xs font-mono font-bold">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded hover:bg-slate-300"
          >
            F5 = Nova Cotação
          </button>
          <span className="text-slate-500">
            Artigos na cotação: <b>{items.length}</b>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={saving || items.length === 0}
            onClick={() => void handleSaveQuotation(true)}
            className="px-4 py-2 bg-[#003366] text-white font-bold rounded text-xs uppercase hover:bg-blue-900 disabled:opacity-50"
          >
            🖨 Imprimir Cotação (F9)
          </button>

          <button
            type="button"
            disabled={saving || items.length === 0 || docStatus === 'CONFIRMED'}
            onClick={() => void handleSaveQuotation(false)}
            className="px-5 py-2 bg-[#006e25] text-white font-bold rounded text-xs uppercase hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'A guardar…' : 'Emitir Cotação (F2)'}
          </button>
        </div>
      </footer>
    </div>
  );
};
