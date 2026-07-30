import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Article } from '../types';

interface ArticleSearchSelectProps {
  articles: Article[];
  selectedArticleId: string;
  onSelect: (articleId: string) => void;
  /** Extra info shown per option, e.g., price or stock. Default shows code + description + stock. */
  renderLabel?: (article: Article) => string;
  className?: string;
  placeholder?: string;
  searchByCodeOnly?: boolean;
}

export const ArticleSearchSelect: React.FC<ArticleSearchSelectProps> = ({
  articles,
  selectedArticleId,
  onSelect,
  renderLabel,
  className = '',
  placeholder = 'Pesquisar por código ou descrição…',
  searchByCodeOnly = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId),
    [articles, selectedArticleId],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase().trim();
    if (searchByCodeOnly) {
      return articles.filter((a) => a.code.toLowerCase().includes(q));
    }
    const terms = q.split(/\s+/);
    return articles.filter((a) => {
      const haystack = `${a.code} ${a.description} ${a.brand ?? ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [articles, query, searchByCodeOnly]);

  // Reset highlight when filtered list changes
  useEffect(() => setHighlightIndex(0), [filtered]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectArticle = (article: Article) => {
    onSelect(article.id);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) selectArticle(filtered[highlightIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setIsOpen(false);
        setQuery('');
        break;
    }
  };

  const defaultLabel = (a: Article) =>
    `[${a.code}] ${a.description} · Stock ${a.stock}`;

  const label = renderLabel ?? defaultLabel;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected display + search input */}
      <div
        className="flex items-stretch border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden bg-white dark:bg-[#1f2325] cursor-text"
        onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
      >
        <span className="material-symbols-outlined px-2 flex items-center text-[#737780] text-base">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (selectedArticle ? `[${selectedArticle.code}] ${selectedArticle.description}` : '')}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { setQuery(''); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 p-2 text-xs font-bold text-[#003366] dark:text-[#a7c8ff] bg-transparent outline-none placeholder:text-[#737780] placeholder:font-normal"
        />
        {selectedArticle && !isOpen && (
          <span className="flex items-center px-2 text-[10px] font-bold text-[#006e25] bg-[#f3f4f5] dark:bg-[#282c2e] whitespace-nowrap">
            Stock: {selectedArticle.stock}
          </span>
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-[#c3c6d1] dark:border-[#43474f] bg-white dark:bg-[#1f2325] shadow-xl"
        >
          {filtered.length === 0 ? (
            <li className="p-3 text-xs text-[#737780] text-center italic">
              Nenhum artigo encontrado para "{query}"
            </li>
          ) : (
            filtered.slice(0, 100).map((a, idx) => (
              <li
                key={a.id}
                onMouseDown={(e) => { e.preventDefault(); selectArticle(a); }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                  idx === highlightIndex
                    ? 'bg-[#003366] text-white'
                    : a.stock === 0
                      ? 'bg-[#ffdad6]/20 text-[#191c1d] dark:text-white hover:bg-[#003366]/10'
                      : 'text-[#191c1d] dark:text-white hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]'
                }`}
              >
                <span className="flex-1 truncate">
                  <span className="font-bold font-mono">[{a.code}]</span>{' '}
                  <span className="font-medium">{a.description}</span>
                  {a.brand && <span className="ml-1 text-[10px] opacity-60">· {a.brand}</span>}
                </span>
                <span className={`ml-3 text-[10px] font-bold whitespace-nowrap ${
                  idx === highlightIndex
                    ? 'text-white/80'
                    : a.stock === 0
                      ? 'text-[#ba1a1a]'
                      : 'text-[#006e25]'
                }`}>
                  Stock: {a.stock}
                </span>
              </li>
            ))
          )}
          {filtered.length > 100 && (
            <li className="p-2 text-center text-[10px] text-[#737780] border-t border-[#c3c6d1]">
              A mostrar 100 de {filtered.length} resultados. Refine a pesquisa.
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
