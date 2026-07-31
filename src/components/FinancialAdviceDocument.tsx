import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, Supplier, DocumentRecord, ReferenceOption } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

export interface AdviceLineItem {
  id: string;
  description: string;
  netAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export interface FinancialAdviceDocumentProps {
  entityType: 'CUSTOMER' | 'SUPPLIER';
  adviceType?: 'CREDIT';
  clients: Client[];
  suppliers: Supplier[];
  documents: DocumentRecord[];
  taxCodes?: ReferenceOption[];
  onConfirmAdvice: (data: {
    entityType: 'CUSTOMER' | 'SUPPLIER';
    adviceType: 'CREDIT';
    entityId: string;
    documentDate: string;
    targetDocumentId?: string;
    reason: string;
    notes: string;
    items: {
      description: string;
      net_amount: number;
      tax_rate: number;
      tax_amount: number;
      total_amount: number;
    }[];
  }) => Promise<DocumentRecord | string>;
  onPrintRecord?: (doc: DocumentRecord) => void;
}

export const FinancialAdviceDocument: React.FC<FinancialAdviceDocumentProps> = ({
  entityType,
  clients,
  suppliers,
  documents,
  onConfirmAdvice,
  onPrintRecord,
}) => {
  const adviceType = 'CREDIT';

  // Form State
  const [entityCodeInput, setEntityCodeInput] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetDocumentId, setTargetDocumentId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [entitySearchError, setEntitySearchError] = useState('');

  // Lines State
  const [items, setItems] = useState<AdviceLineItem[]>([
    { id: '1', description: 'Ajuste / Regularização Financeira de Crédito', netAmount: 0, taxRate: 0, taxAmount: 0, totalAmount: 0 },
  ]);

  // Phase State
  const [isConfirming, setIsConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmedDocument, setConfirmedDocument] = useState<DocumentRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const entityCodeRef = useRef<HTMLInputElement>(null);

  // Document Title & Serial Prefix (CREDIT ONLY)
  const docTitle = useMemo(() => {
    return entityType === 'CUSTOMER' ? 'Aviso de Crédito a Cliente' : 'Aviso de Crédito a Fornecedor';
  }, [entityType]);

  const docPrefix = useMemo(() => {
    return entityType === 'CUSTOMER' ? 'ACC' : 'ACF';
  }, [entityType]);

  // Selected Entity details
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    if (entityType === 'CUSTOMER') {
      const c = clients.find((item) => item.id === selectedEntityId || item.code === selectedEntityId);
      return c ? { id: c.id, code: c.code || c.number || '', name: c.name, nuit: c.nuit || '', address: c.address || '', phone: c.phone || '', balance: c.pendingBalance } : null;
    } else {
      const s = suppliers.find((item) => item.id === selectedEntityId || item.code === selectedEntityId);
      return s ? { id: s.id, code: s.code || s.number || '', name: s.name, nuit: s.nuit || '', address: s.address || '', phone: s.phone || '', balance: s.pendingBalance ?? 0 } : null;
    }
  }, [selectedEntityId, entityType, clients, suppliers]);

  // Eligible target documents for allocation
  const eligibleDocuments = useMemo(() => {
    if (!selectedEntityId) return [];
    return documents.filter((doc) => {
      const matchesParty = doc.partyId === selectedEntityId || (selectedEntity && doc.partyName.toLowerCase() === selectedEntity.name.toLowerCase());
      const hasBalance = doc.outstandingAmount > 0;
      return matchesParty && hasBalance;
    });
  }, [documents, selectedEntityId, selectedEntity]);

  // Handle entity code resolution
  const handleResolveEntity = () => {
    setEntitySearchError('');
    if (!entityCodeInput.trim()) return;

    const term = entityCodeInput.trim().toLowerCase();
    let foundId = '';

    if (entityType === 'CUSTOMER') {
      const match = clients.find(
        (c) => (c.code && c.code.toLowerCase() === term) || (c.number && c.number.toLowerCase() === term) || c.name.toLowerCase().includes(term) || (c.nuit && c.nuit.toLowerCase() === term)
      );
      if (match) foundId = match.id;
    } else {
      const match = suppliers.find(
        (s) => (s.code && s.code.toLowerCase() === term) || (s.number && s.number.toLowerCase() === term) || s.name.toLowerCase().includes(term) || (s.nuit && s.nuit.toLowerCase() === term)
      );
      if (match) foundId = match.id;
    }

    if (foundId) {
      setSelectedEntityId(foundId);
    } else {
      setEntitySearchError(`${entityType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'} não encontrado com o código/pesquisa "${entityCodeInput}".`);
    }
  };

  // Line Calculations
  const updateLineItem = (id: string, field: keyof AdviceLineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'netAmount' || field === 'taxRate') {
          const net = Math.max(0, Number(updated.netAmount) || 0);
          const rate = Math.max(0, Number(updated.taxRate) || 0);
          const tax = Math.round(net * (rate / 100) * 100) / 100;
          updated.netAmount = net;
          updated.taxRate = rate;
          updated.taxAmount = tax;
          updated.totalAmount = net + tax;
        }
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: '', netAmount: 0, taxRate: 0, taxAmount: 0, totalAmount: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Grand Totals
  const subtotal = items.reduce((acc, item) => acc + item.netAmount, 0);
  const taxTotal = items.reduce((acc, item) => acc + item.taxAmount, 0);
  const grandTotal = items.reduce((acc, item) => acc + item.totalAmount, 0);

  // Financial Impact Calculations (CREDIT ONLY)
  const impactSummary = useMemo(() => {
    const currentBal = selectedEntity ? selectedEntity.balance : 0;
    let estimatedNewBalance = currentBal;
    let impactText = '';
    let isPositiveForCompany = false;

    if (entityType === 'CUSTOMER') {
      estimatedNewBalance = currentBal - grandTotal;
      impactText = `Este aviso REDUZIRÁ o saldo do cliente de ${formatMZN(currentBal)} para ${formatMZN(estimatedNewBalance)} (Crédito a favor do cliente).`;
    } else {
      estimatedNewBalance = currentBal + grandTotal;
      impactText = `Este aviso AUMENTARÁ o valor a pagar ao fornecedor de ${formatMZN(currentBal)} para ${formatMZN(estimatedNewBalance)} (Dívida adicional ao fornecedor).`;
    }

    return { currentBal, estimatedNewBalance, impactText, isPositiveForCompany };
  }, [selectedEntity, grandTotal, entityType]);

  // Reset Form for New Document
  const handleNewDocument = () => {
    setSelectedEntityId('');
    setEntityCodeInput('');
    setTargetDocumentId('');
    setReason('');
    setNotes('');
    setItems([{ id: '1', description: 'Ajuste / Regularização Financeira de Crédito', netAmount: 0, taxRate: 0, taxAmount: 0, totalAmount: 0 }]);
    setConfirmedDocument(null);
    setIsConfirming(false);
    setErrorMessage('');
    setTimeout(() => entityCodeRef.current?.focus(), 100);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (confirmedDocument) return;
        if (!isConfirming) {
          if (!selectedEntityId || grandTotal <= 0) {
            setErrorMessage('Seleccione a entidade e introduza valores válidos antes de confirmar (F2).');
            return;
          }
          setErrorMessage('');
          setIsConfirming(true);
        } else {
          handleExecuteSave();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleNewDocument();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (confirmedDocument && onPrintRecord) {
          onPrintRecord(confirmedDocument);
        }
      } else if (e.key === 'Escape') {
        if (isConfirming) {
          e.preventDefault();
          setIsConfirming(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming, selectedEntityId, grandTotal, confirmedDocument, onPrintRecord]);

  // Save Execution (Phase 2)
  const handleExecuteSave = async () => {
    if (!selectedEntityId || grandTotal <= 0 || saving) return;

    try {
      setSaving(true);
      setErrorMessage('');
      const result = await onConfirmAdvice({
        entityType,
        adviceType: 'CREDIT',
        entityId: selectedEntityId,
        documentDate,
        targetDocumentId: targetDocumentId || undefined,
        reason: reason || docTitle,
        notes,
        items: items.map((i) => ({
          description: i.description || 'Aviso de Crédito',
          net_amount: i.netAmount,
          tax_rate: i.taxRate,
          tax_amount: i.taxAmount,
          total_amount: i.totalAmount,
        })),
      });

      if (typeof result === 'object' && result !== null) {
        setConfirmedDocument(result);
      } else {
        const createdDoc: DocumentRecord = {
          id: String(result),
          displayNumber: `${docPrefix} 2026/000001`,
          date: documentDate,
          dueDate: documentDate,
          typeCode: `${entityType}_CREDIT_ADVICE`,
          typeName: docTitle,
          partyType: entityType,
          partyId: selectedEntityId,
          partyName: selectedEntity?.name || '',
          status: 'CONFIRMED',
          netTotal: subtotal,
          taxTotal,
          grandTotal,
          paidAmount: grandTotal,
          outstandingAmount: 0,
        };
        setConfirmedDocument(createdDoc);
      }
      setIsConfirming(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao gravar o aviso de crédito na base de dados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-800 dark:text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#001e40] p-4 rounded-t-lg text-white shadow-md">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Módulo Financeiro — {entityType === 'CUSTOMER' ? 'Clientes' : 'Fornecedores'}
          </span>
          <h2 className="text-base font-extrabold uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">savings</span>
            {docTitle}
          </h2>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="rounded bg-slate-800 px-3 py-1 text-slate-200 border border-slate-700">
            Nº Documento: <b className="text-amber-300">{confirmedDocument ? confirmedDocument.displayNumber : `${docPrefix} (A atribuir)`}</b>
          </span>
          <span className={`rounded px-3 py-1 font-bold ${confirmedDocument ? 'bg-emerald-800 text-emerald-200' : 'bg-amber-800 text-amber-200'}`}>
            {confirmedDocument ? '● CONFIRMADO' : '● RASCUNHO'}
          </span>
        </div>
      </div>

      {/* Main Document Form */}
      <div className="rounded-b-lg border bg-white p-5 shadow-sm dark:bg-[#1f2325] dark:border-[#43474f] space-y-5">
        {/* Error Banner */}
        {errorMessage && (
          <div role="alert" className="rounded bg-red-100 p-3 text-xs font-bold text-red-800 border border-red-300 flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="text-red-900 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Form Grid 1: Entity Lookup & Document Info */}
        <div className="grid grid-cols-12 gap-3 text-xs">
          {/* Entity Code Search */}
          <div className="col-span-12 md:col-span-3">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              Código / Nome {entityType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'} *
            </label>
            <div className="flex gap-1">
              <input
                ref={entityCodeRef}
                type="text"
                disabled={Boolean(confirmedDocument)}
                value={entityCodeInput}
                onChange={(e) => setEntityCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleResolveEntity();
                  }
                }}
                onBlur={handleResolveEntity}
                placeholder="Introduza código..."
                className="w-full rounded border p-2 font-mono uppercase bg-slate-50 dark:bg-[#282c2e] focus:bg-white dark:focus:bg-[#1f2325]"
              />
              <button
                type="button"
                disabled={Boolean(confirmedDocument)}
                onClick={handleResolveEntity}
                className="rounded bg-[#003366] px-3 font-bold text-white hover:bg-[#002244]"
              >
                <span className="material-symbols-outlined text-sm">search</span>
              </button>
            </div>
            {entitySearchError && <p className="mt-1 text-[11px] font-bold text-red-600">{entitySearchError}</p>}
          </div>

          {/* Direct Dropdown Selection */}
          <div className="col-span-12 md:col-span-4">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              ou Seleccione da Lista
            </label>
            <select
              disabled={Boolean(confirmedDocument)}
              value={selectedEntityId}
              onChange={(e) => {
                setSelectedEntityId(e.target.value);
                setEntityCodeInput('');
                setEntitySearchError('');
              }}
              className="w-full rounded border p-2 font-bold dark:bg-[#282c2e]"
            >
              <option value="">-- Seleccionar {entityType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'} --</option>
              {entityType === 'CUSTOMER'
                ? clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code || c.number || 'CL'}] {c.name} — Saldo: {formatMZN(c.pendingBalance)}
                    </option>
                  ))
                : suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.code || s.number || 'FOR'}] {s.name} — Saldo: {formatMZN(s.pendingBalance ?? 0)}
                    </option>
                  ))}
            </select>
          </div>

          {/* Document Date */}
          <div className="col-span-12 md:col-span-2">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              Data Emissão *
            </label>
            <input
              type="date"
              disabled={Boolean(confirmedDocument)}
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-full rounded border p-2 font-mono dark:bg-[#282c2e]"
            />
          </div>

          {/* Optional Target Document Link */}
          <div className="col-span-12 md:col-span-3">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              Doc. Referência (Opcional)
            </label>
            <select
              disabled={Boolean(confirmedDocument) || !selectedEntityId}
              value={targetDocumentId}
              onChange={(e) => setTargetDocumentId(e.target.value)}
              className="w-full rounded border p-2 font-mono dark:bg-[#282c2e]"
            >
              <option value="">-- Sem afectação directa --</option>
              {eligibleDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.displayNumber} ({doc.date}) — Pendente: {formatMZN(doc.outstandingAmount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Entity Card & Financial Impact Banner */}
        {selectedEntity && (
          <div className="rounded-lg border p-4 bg-slate-50 dark:bg-[#282c2e] border-slate-200 dark:border-[#43474f] space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-12 md:col-span-4">
                <span className="text-slate-500 block uppercase text-[10px]">Nome Entidade:</span>
                <b className="text-sm text-[#001e40] dark:text-[#a7c8ff] font-bold">{selectedEntity.name}</b>
              </div>
              <div className="col-span-6 md:col-span-2">
                <span className="text-slate-500 block uppercase text-[10px]">NUIT:</span>
                <b className="font-mono">{selectedEntity.nuit || 'N/A'}</b>
              </div>
              <div className="col-span-6 md:col-span-3">
                <span className="text-slate-500 block uppercase text-[10px]">Morada / Telefone:</span>
                <span>{selectedEntity.address || selectedEntity.phone || 'Sem morada registada'}</span>
              </div>
              <div className="col-span-12 md:col-span-3 text-right font-mono">
                <span className="text-slate-500 block uppercase text-[10px]">Saldo Actual:</span>
                <b className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatMZN(selectedEntity.balance)}</b>
              </div>
            </div>

            {/* Explicit Impact Banner */}
            <div className="p-3 rounded border text-xs font-bold flex items-center space-x-2 bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <span className="material-symbols-outlined text-lg">info</span>
              <span>{impactSummary.impactText}</span>
            </div>
          </div>
        )}

        {/* Reason & Notes Fields */}
        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 md:col-span-6">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              Motivo do Aviso de Crédito *
            </label>
            <input
              type="text"
              disabled={Boolean(confirmedDocument)}
              maxLength={250}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Abatimento comercial concedido, Regularização de saldo..."
              className="w-full rounded border p-2 dark:bg-[#282c2e]"
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase block mb-1">
              Observações Adicionais
            </label>
            <input
              type="text"
              disabled={Boolean(confirmedDocument)}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas para auditoria..."
              className="w-full rounded border p-2 dark:bg-[#282c2e]"
            />
          </div>
        </div>

        {/* Advice Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
              Descrição dos Valores do Aviso ({items.length} Linha{items.length > 1 ? 's' : ''})
            </h3>
            {!confirmedDocument && (
              <button
                type="button"
                onClick={addLineItem}
                className="px-3 py-1 rounded bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold uppercase flex items-center space-x-1"
              >
                <span>+ Adicionar Linha</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded border dark:border-[#43474f]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase border-b">
                <tr>
                  <th className="p-2 w-12 text-center">#</th>
                  <th className="p-2">Descrição do Ajuste</th>
                  <th className="p-2 w-36 text-right">Valor Líquido (MZN)</th>
                  <th className="p-2 w-24 text-right">IVA %</th>
                  <th className="p-2 w-32 text-right">Valor IVA (MZN)</th>
                  <th className="p-2 w-36 text-right">Valor Total (MZN)</th>
                  {!confirmedDocument && <th className="p-2 w-12 text-center">Acção</th>}
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                    <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        disabled={Boolean(confirmedDocument)}
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Descrição da regularização de crédito..."
                        className="w-full rounded border p-1 font-sans dark:bg-[#1f2325]"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={Boolean(confirmedDocument)}
                        value={item.netAmount || ''}
                        onChange={(e) => updateLineItem(item.id, 'netAmount', e.target.value)}
                        className="w-full rounded border p-1 text-right font-mono font-bold dark:bg-[#1f2325]"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        disabled={Boolean(confirmedDocument)}
                        value={item.taxRate}
                        onChange={(e) => updateLineItem(item.id, 'taxRate', e.target.value)}
                        className="w-full rounded border p-1 text-right font-mono dark:bg-[#1f2325]"
                      />
                    </td>
                    <td className="p-2 text-right font-bold text-slate-600 dark:text-slate-300">
                      {formatMZN(item.taxAmount)}
                    </td>
                    <td className="p-2 text-right font-bold text-[#006e25] dark:text-emerald-400">
                      {formatMZN(item.totalAmount)}
                    </td>
                    {!confirmedDocument && (
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => removeLineItem(item.id)}
                          className="text-red-600 hover:text-red-800 disabled:opacity-30"
                          title="Remover linha"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary & Totals Bar */}
        <div className="grid grid-cols-12 gap-4 items-center border-t pt-4 dark:border-[#43474f]">
          <div className="col-span-12 md:col-span-6 space-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
            <div>Saldo Anterior: <b>{formatMZN(impactSummary.currentBal)}</b></div>
            <div>Impacto do Aviso de Crédito: <b className="text-blue-700 font-bold">-{formatMZN(grandTotal)}</b></div>
            <div className="text-sm font-bold text-[#001e40] dark:text-white">Novo Saldo Estimado: <b className="text-emerald-700 dark:text-emerald-400">{formatMZN(impactSummary.estimatedNewBalance)}</b></div>
          </div>

          <div className="col-span-12 md:col-span-6 space-y-1 text-right font-mono">
            <div className="text-xs text-slate-600 dark:text-slate-300">Total Líquido: <b>{formatMZN(subtotal)}</b></div>
            <div className="text-xs text-slate-600 dark:text-slate-300">Total IVA: <b>{formatMZN(taxTotal)}</b></div>
            <div className="text-lg font-black text-[#006e25] dark:text-emerald-400">Total do Aviso de Crédito: {formatMZN(grandTotal)}</div>
          </div>
        </div>

        {/* Operational Shortcut Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 dark:border-[#43474f]">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
            <span>[F2] Confirmar</span>
            <span>[F5] Novo</span>
            <span>[F9] Imprimir</span>
            <span>[Esc] Voltar</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleNewDocument}
              className="px-4 py-2.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-[#282c2e] text-xs font-bold uppercase transition-colors"
            >
              Novo Documento (F5)
            </button>

            {confirmedDocument && onPrintRecord && (
              <button
                type="button"
                onClick={() => onPrintRecord(confirmedDocument)}
                className="px-4 py-2.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold uppercase shadow transition-colors flex items-center space-x-1"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Imprimir Documento (F9)</span>
              </button>
            )}

            {!confirmedDocument && (
              <button
                type="button"
                disabled={!selectedEntityId || grandTotal <= 0}
                onClick={() => {
                  if (!selectedEntityId || grandTotal <= 0) return;
                  setIsConfirming(true);
                }}
                className="px-5 py-2.5 rounded bg-[#006e25] hover:bg-[#00551c] disabled:opacity-50 text-white text-xs font-black uppercase shadow-md transition-colors"
              >
                Confirmar Aviso (F2)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal (Phase 1) */}
      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-sans">
          <div className="w-full max-w-lg rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center space-x-3 border-b pb-3 dark:border-[#43474f]">
              <span className="material-symbols-outlined text-2xl text-amber-500">warning</span>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide text-[#001e40] dark:text-[#a7c8ff]">
                  Confirmar {docTitle}
                </h3>
                <p className="text-xs text-slate-500">Por favor confirme a gravação definitiva deste aviso financeiro de crédito.</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-[#282c2e] p-4 rounded border">
              <div>Entidade: <b>{selectedEntity?.name}</b> (NUIT: {selectedEntity?.nuit || 'N/A'})</div>
              <div>Motivo: <b>{reason || docTitle}</b></div>
              <div>Linhas: <b>{items.length}</b> | Total do Aviso: <b className="text-emerald-700 dark:text-emerald-400">{formatMZN(grandTotal)}</b></div>
              <hr className="my-2 border-slate-200 dark:border-slate-700" />
              <div>Saldo Actual: <b>{formatMZN(impactSummary.currentBal)}</b></div>
              <div>Novo Saldo Estimado: <b className="text-blue-700 dark:text-blue-300">{formatMZN(impactSummary.estimatedNewBalance)}</b></div>
              <div className="text-[11px] font-sans text-amber-700 dark:text-amber-300 mt-2 font-bold">
                ⚠️ Nota: Esta operação altera a conta corrente e NÃO efectua saídas ou entradas físicas de stock.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsConfirming(false)}
                className="px-4 py-2 rounded border font-bold text-xs uppercase hover:bg-slate-100 dark:hover:bg-[#282c2e]"
              >
                Voltar (Esc)
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleExecuteSave}
                className="px-5 py-2 rounded bg-[#006e25] hover:bg-[#00551c] text-white text-xs font-black uppercase shadow"
              >
                {saving ? 'A gravar na base de dados...' : 'Confirmar e Gravar (F2 / Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
