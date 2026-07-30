import React, { useMemo, useEffect } from 'react';
import type { Article, StockMovement } from '../types';

interface ArticleLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  articles: Article[];
  movements: StockMovement[];
  onSelectArticleId?: (id: string) => void;
}

export const ArticleLedgerModal: React.FC<ArticleLedgerModalProps> = ({
  isOpen,
  onClose,
  article,
  articles,
  movements,
  onSelectArticleId,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const articleMovements = useMemo(() => {
    if (!article) return [];
    const filtered = movements.filter(
      (m) => m.articleCode?.toLowerCase() === article.code.toLowerCase(),
    );
    // Sort chronologically ascending
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let currentBalance = 0;
    return sorted.map((m) => {
      const isEntrada = m.type === 'entrada';
      const entradas = isEntrada ? m.quantity : 0;
      const saidas = isEntrada ? 0 : m.quantity;
      currentBalance = currentBalance + entradas - saidas;
      return {
        id: m.id,
        date: new Date(m.date).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        }),
        document: m.docRef || (isEntrada ? 'E 000000' : 'V 000000'),
        entradas,
        saidas,
        saldo: currentBalance,
      };
    });
  }, [article, movements]);

  if (!isOpen || !article) return null;

  const todayStr = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-mono">
      <div className="w-full max-w-4xl overflow-hidden rounded border-2 border-yellow-400 bg-[#000080] text-yellow-300 shadow-2xl">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-yellow-400 bg-[#0000aa] px-4 py-2 text-white">
          <h3 className="font-extrabold text-sm uppercase tracking-wider">
            [ Extracto de movimentos de artigos ]
          </h3>
          <button onClick={onClose} className="text-white hover:text-red-400">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Article Picker Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-yellow-400/50 pb-3">
            <div>
              <h2 className="text-base font-black text-white uppercase">
                Extracto de movimentos de artigos
              </h2>
              <p className="text-sm font-bold text-yellow-200">
                Artigo {article.code} — {article.description}
              </p>
              <span className="text-xs text-yellow-400">{todayStr}</span>
            </div>

            {onSelectArticleId && (
              <div className="flex items-center space-x-2 text-xs">
                <label className="font-bold text-white uppercase">Mudar Artigo:</label>
                <select
                  value={article.id}
                  onChange={(e) => onSelectArticleId(e.target.value)}
                  className="rounded border border-yellow-400 bg-[#000055] p-1.5 font-bold text-yellow-300"
                >
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.description}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Table matching legacy terminal view */}
          <div className="max-h-[60vh] overflow-y-auto border border-yellow-400/30">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="border-b-2 border-yellow-400 bg-[#0000aa] text-white uppercase">
                <tr>
                  <th className="p-2 border-r border-yellow-400/30 w-10 text-center">M</th>
                  <th className="p-2 border-r border-yellow-400/30 w-24">Data</th>
                  <th className="p-2 border-r border-yellow-400/30">Documento</th>
                  <th className="p-2 border-r border-yellow-400/30 text-right w-28">Entradas</th>
                  <th className="p-2 border-r border-yellow-400/30 text-right w-28">Saídas</th>
                  <th className="p-2 text-right w-28">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-400/20 text-yellow-100">
                {articleMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-yellow-300/70 italic">
                      Sem registo de movimentos para este artigo.
                    </td>
                  </tr>
                ) : (
                  articleMovements.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-[#0000dd] transition-colors"
                    >
                      <td className="p-2 border-r border-yellow-400/20 text-center font-bold">
                        {row.entradas > 0 ? 'E' : 'S'}
                      </td>
                      <td className="p-2 border-r border-yellow-400/20">{row.date}</td>
                      <td className="p-2 border-r border-yellow-400/20 font-bold text-white">
                        {row.document}
                      </td>
                      <td className="p-2 border-r border-yellow-400/20 text-right font-extrabold text-green-300">
                        {row.entradas.toFixed(3)}
                      </td>
                      <td className="p-2 border-r border-yellow-400/20 text-right font-extrabold text-red-300">
                        {row.saidas.toFixed(3)}
                      </td>
                      <td className="p-2 text-right font-black text-yellow-300 text-sm">
                        {row.saldo.toFixed(3)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-yellow-400 bg-[#0000aa] px-4 py-2 text-xs font-bold text-white">
          <div className="flex items-center space-x-6">
            <span>ESC = Sair</span>
            <span>F9 = Imprimir Extracto</span>
          </div>
          <span>Total de Registos: {articleMovements.length}</span>
        </div>
      </div>
    </div>
  );
};
