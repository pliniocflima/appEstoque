
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, updateStockWithLog } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category } from '../types';
import { Search, ClipboardCheck, Scale, Check, X, Filter } from 'lucide-react';
import { useApp } from '../App';

const StockAudit: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  
  const user = auth.currentUser;
  const { profile } = useApp();

  useEffect(() => {
    if (user && profile) {
      const unsubSub = subscribeToCollection('subcategories', profile.householdId, (data) => setSubcategories(data as Subcategory[]));
      const unsubCat = subscribeToCollection('categories', profile.householdId, (data) => setCategories(data as Category[]));
      return () => { unsubSub(); unsubCat(); };
    }
  }, [user, profile]);

  const handleAdjustStock = async (item: Subcategory) => {
    if (!user || !profile || !adjustValue) return;
    const newVal = Number(adjustValue);
    const diff = newVal - item.currentStock;
    if (diff === 0) { setAdjustingId(null); return; }

    const diffPrefix = diff > 0 ? '+' : '';
    const formattedDiff = `${diffPrefix}${diff.toFixed(1).replace('.0', '')}`;
    
    await updateStockWithLog(user.uid, profile.householdId, {
      type: 'ajuste',
      origin: 'manual',
      subcategoryId: item.id,
      subcategoryName: item.name,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      quantity: diff,
      displayQuantity: `${formattedDiff} ${item.measureUnit} (Ajuste para ${newVal} ${item.measureUnit})`
    }, newVal);

    setAdjustingId(null);
    setAdjustValue('');
  };

  const filteredItems = subcategories
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = item.name.toLowerCase().includes(searchLower) || 
                           (item.categoryName || '').toLowerCase().includes(searchLower);
      const matchesCategory = selectedCategory === 'todas' || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Regra: Categoria > Nome
      const catA = a.categoryName || '';
      const catB = b.categoryName || '';
      const catCompare = catA.localeCompare(catB);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <ClipboardCheck className="mr-2 text-blue-600" /> Conferência de Estoque
        </h2>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar item ou categoria..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <select 
            className="pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none text-sm font-medium min-w-[180px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="todas">Todas Categorias</option>
            {categories.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Estoque Atual</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map(item => (
                <tr key={item.id} className={`hover:bg-blue-50/10 transition-colors ${adjustingId === item.id ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-gray-800 text-sm truncate">{item.name}</div>
                      <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                        {item.categoryName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {adjustingId === item.id ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                        <input
                          type="number"
                          step="0.1"
                          className="w-20 p-1.5 border-2 border-blue-500 rounded-lg font-bold text-center text-sm"
                          value={adjustValue}
                          onChange={(e) => setAdjustValue(e.target.value)}
                          autoFocus
                        />
                        <span className="text-[10px] font-bold text-blue-600">{item.measureUnit}</span>
                      </div>
                    ) : (
                      <div className="font-mono font-bold text-gray-700 bg-gray-50 px-2.5 py-0.5 rounded-full w-fit text-xs border border-gray-100">
                        {item.currentStock} <span className="text-[9px] font-normal text-gray-400 ml-0.5">{item.measureUnit}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {adjustingId === item.id ? (
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => handleAdjustStock(item)}
                          className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => setAdjustingId(null)}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setAdjustingId(item.id); setAdjustValue(item.currentStock.toString()); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 ml-auto font-bold text-[10px] uppercase"
                      >
                        <Scale size={14} />
                        <span className="hidden sm:inline">Ajustar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                    Nenhum item encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockAudit;
