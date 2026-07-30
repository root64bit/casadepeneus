import React, { useEffect, useState } from 'react';
import { Article, ReferenceOption } from '../types';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (article: Omit<Article, 'id'>) => Promise<void>;
  categories: ReferenceOption[];
  brands: ReferenceOption[];
  units: ReferenceOption[];
  taxCodes: ReferenceOption[];
}

export const NewArticleModal: React.FC<NewArticleModalProps> = ({ isOpen, onClose, onSave, categories, brands, units, taxCodes }) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [minStock, setMinStock] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [taxCodeId, setTaxCodeId] = useState('');
  const [taxRate, setTaxRate] = useState<number>(16);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCategoryId(categories[0]?.id ?? '');
    setIsCustomCategory(false);
    setCustomCategoryName('');
    setBrandId('');
    setIsCustomBrand(false);
    setCustomBrandName('');
    setUnitId(units[0]?.id ?? '');
    setCostPrice(0);
    setSellPrice(0);
    setMinStock(0);
    setTaxCodeId(taxCodes[0]?.id ?? '');
    const firstRateMatch = taxCodes[0]?.name.match(/(\d+(?:\.\d+)?)%/);
    setTaxRate(firstRateMatch ? Number(firstRateMatch[1]) : 16);
  }, [isOpen, categories, units, taxCodes]);

  if (!isOpen) return null;

  const profitMargin = costPrice > 0 ? ((sellPrice - costPrice) / costPrice) * 100 : 0;
  const sellPriceWithIva = sellPrice * (1 + taxRate / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !description) {
      alert('Por favor preencha o código e a descrição do artigo.');
      return;
    }
    if (isCustomCategory && !customCategoryName.trim()) {
      alert('Por favor introduza o nome da nova categoria.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const selectedCategory = categories.find((item) => item.id === categoryId);
      const catName = isCustomCategory ? customCategoryName.trim() : (selectedCategory?.name ?? '');
      const normalizedCategory = catName.toLowerCase();
      const brName = isCustomBrand ? customBrandName.trim() : (brands.find((item) => item.id === brandId)?.name ?? '');

      await onSave({
        code: code.toUpperCase(),
        description,
        category: normalizedCategory || 'geral',
        categoryId: isCustomCategory ? undefined : categoryId,
        categoryName: isCustomCategory ? customCategoryName.trim() : undefined,
        brandId: isCustomBrand ? undefined : (brandId || undefined),
        brandName: isCustomBrand ? customBrandName.trim() : undefined,
        unitId,
        brand: brName || undefined,
        size: undefined,
        unit: units.find((item) => item.id === unitId)?.code ?? '',
        stock: 0,
        minStock: Number(minStock),
        costPrice: Number(costPrice),
        profitMargin: Math.round(profitMargin * 100) / 100,
        sellPrice: Number(sellPrice),
        sellPriceWithIva: Math.round(sellPriceWithIva * 100) / 100,
        taxCodeId: taxCodeId || undefined,
        taxRate: Number(taxRate),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao guardar artigo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f2325] rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-[#c3c6d1] dark:border-[#43474f]">
        <div className="bg-[#001e40] text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <span className="material-symbols-outlined mr-2">add_circle</span>
            Cadastrar Novo Artigo
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
                Código do Artigo *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: ART-001"
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring font-mono uppercase"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase">
                  Categoria *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[11px] text-[#003366] dark:text-[#a7c8ff] font-bold hover:underline"
                >
                  {isCustomCategory ? '✔ Selecionar Existente' : '✏ Nova Categoria'}
                </button>
              </div>
              {isCustomCategory ? (
                <input
                  type="text"
                  required
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  placeholder="Escreva a nova categoria (ex: Baterias, Jantes, Óleos...)"
                  className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring font-bold"
                />
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsCustomCategory(true);
                    } else {
                      setCategoryId(e.target.value);
                    }
                  }}
                  className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring"
                >
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  <option value="__NEW__">➕ Escrever nova categoria...</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
              Descrição Detalhada *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Bateria Willard 65Ah ou Óleo Castrol 5W30..."
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase">
                Marca / Fabricante (opcional)
              </label>
              <button
                type="button"
                onClick={() => setIsCustomBrand(!isCustomBrand)}
                className="text-[11px] text-[#003366] dark:text-[#a7c8ff] font-bold hover:underline"
              >
                {isCustomBrand ? '✔ Selecionar Existente' : '✏ Nova Marca'}
              </button>
            </div>
            {isCustomBrand ? (
              <input
                type="text"
                value={customBrandName}
                onChange={(e) => setCustomBrandName(e.target.value)}
                placeholder="Escreva a nova marca (ex: Continental, Maxxis, Castrol...)"
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring font-bold"
              />
            ) : (
              <select
                value={brandId}
                onChange={(event) => {
                  if (event.target.value === '__NEW__') {
                    setIsCustomBrand(true);
                  } else {
                    setBrandId(event.target.value);
                  }
                }}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-2 text-sm focus-ring"
              >
                <option value="">Sem marca</option>
                {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value="__NEW__">➕ Escrever nova marca...</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 bg-[#f3f4f5] dark:bg-[#282c2e] p-3 rounded border border-[#c3c6d1] dark:border-[#43474f] sm:grid-cols-2 lg:grid-cols-5">
            <div><label className="block text-[11px] font-bold text-[#43474f] dark:text-[#c3c6d1] mb-1">Unidade</label><select required value={unitId} onChange={(event) => setUnitId(event.target.value)} className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-sm">{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div>
              <label className="block text-[11px] font-bold text-[#43474f] dark:text-[#c3c6d1] mb-1">Taxa IVA %</label>
              <div className="flex space-x-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-sm font-mono font-bold text-[#006e25]"
                />
                <select
                  value={taxCodeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTaxCodeId(id);
                    const match = taxCodes.find((t) => t.id === id)?.name.match(/(\d+(?:\.\d+)?)%/);
                    if (match) setTaxRate(Number(match[1]));
                  }}
                  className="w-20 border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1 text-xs"
                  title="Selecionar código de imposto predefinido"
                >
                  {taxCodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#43474f] dark:text-[#c3c6d1] mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-sm font-mono text-red-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#43474f] dark:text-[#c3c6d1] mb-1">Preço Custo (MZN)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#43474f] dark:text-[#c3c6d1] mb-1">Preço Venda s/ IVA</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-sm font-mono text-blue-600 font-bold"
              />
            </div>
          </div>

          <div className="bg-[#003366]/10 p-3 rounded flex justify-between items-center text-sm font-mono">
            <div>
              <span className="text-xs text-[#43474f] block">Preço Venda (s/ IVA):</span>
              <strong className="text-[#001e40] dark:text-white">{sellPrice.toFixed(2)} MZN</strong>
              {profitMargin !== 0 && (
                <span className="text-[10px] ml-2 text-green-700 font-bold">
                  (Margem: {profitMargin > 0 ? '+' : ''}{profitMargin.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-[#43474f] block">Preço Final (c/ IVA {taxRate}%):</span>
              <strong className="text-[#006e25] text-base">{sellPriceWithIva.toFixed(2)} MZN</strong>
            </div>
          </div>

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
              disabled={saving}
              className="px-6 py-2 bg-[#006e25] text-white rounded font-bold text-xs uppercase hover:brightness-110 transition-all shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'A guardar…' : 'Guardar Artigo (F2)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
