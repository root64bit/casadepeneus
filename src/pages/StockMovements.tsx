import React, { useEffect, useState } from 'react';
import { StockMovement, Article } from '../types';

interface StockMovementsProps {
  movements: StockMovement[];
  articles: Article[];
  onAddMovement: (mov: StockMovement) => Promise<void>;
  canPostEntry: boolean;
  canPostExit: boolean;
}

export const StockMovements: React.FC<StockMovementsProps> = ({
  movements,
  articles,
  onAddMovement,
  canPostEntry,
  canPostExit,
}) => {
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [docRef, setDocRef] = useState(`G-E/${Math.floor(100 + Math.random() * 900)}`);
  const [articleId, setArticleId] = useState(articles[0]?.id || '');
  const [quantity, setQuantity] = useState(10);
  const [entityName, setEntityName] = useState('Continental SA');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canPostEntry && canPostExit) setType('saida');
  }, [canPostEntry, canPostExit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const art = articles.find(a => a.id === articleId);
    if (!art) return;

    setSaving(true);
    setError('');
    try {
      await onAddMovement({
        id: `mov-${Date.now()}`,
        type,
        docRef,
        date: new Date().toISOString().split('T')[0],
        articleCode: art.code,
        articleDescription: art.description,
        quantity,
        entityName,
        operator: 'Operador Balcão'
      });
      alert(`Movimento de ${type.toUpperCase()} registado com sucesso!`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao registar movimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form to Register Stock Movement */}
      {(canPostEntry || canPostExit) && <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-5 rounded shadow-sm">
        <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] text-sm flex items-center mb-4">
          <span className="material-symbols-outlined mr-2">swap_horiz</span>
          Registar Nova Entrada / Saída de Stock
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-4 text-xs">
          {error && (
            <p role="alert" className="col-span-12 rounded bg-red-50 p-3 font-bold text-red-700">
              {error}
            </p>
          )}
          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Tipo de Operação</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring font-bold"
            >
              {canPostEntry && <option value="entrada">ENTRADA (Fornecedor)</option>}
              {canPostExit && <option value="saida">SAÍDA (Ajuste / Cliente)</option>}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Nº Guia / Doc Ref</label>
            <input
              type="text"
              required
              value={docRef}
              onChange={(e) => setDocRef(e.target.value)}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm font-mono focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1">Artigo / Pneu</label>
            <select
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring"
            >
              {articles.map(a => (
                <option key={a.id} value={a.id}>
                  [{a.code}] {a.description} (Stock Atual: {a.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-1">Quantidade</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm font-mono font-bold focus-ring"
            />
          </div>

          <div className="col-span-12 md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={saving || !articleId || quantity <= 0}
              className="w-full py-2.5 bg-[#003366] text-white font-bold text-xs uppercase rounded hover:brightness-110 shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'A registar…' : 'Registar'}
            </button>
          </div>
        </form>
      </section>}

      {/* Movement Logs History Table */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 border-b border-[#c3c6d1] dark:border-[#43474f]">
          <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] text-sm uppercase">Histórico de Movimentos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] text-[#737780] uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Doc Ref</th>
                <th className="p-3">Código</th>
                <th className="p-3">Descrição Artigo</th>
                <th className="p-3 text-center">Qtd</th>
                <th className="p-3">Entidade</th>
                <th className="p-3">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-3 font-sans text-gray-500">{mov.date}</td>
                  <td className="p-3 font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                      mov.type === 'entrada' ? 'bg-[#80f98b]/30 text-[#007327]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                    }`}>
                      {mov.type}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{mov.docRef}</td>
                  <td className="p-3 font-bold">{mov.articleCode}</td>
                  <td className="p-3 font-sans font-medium">{mov.articleDescription}</td>
                  <td className="p-3 text-center font-extrabold text-sm">{mov.quantity}</td>
                  <td className="p-3 font-sans">{mov.entityName}</td>
                  <td className="p-3 font-sans text-gray-500">{mov.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
