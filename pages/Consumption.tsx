
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, updateStockWithLog } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category } from '../types';
import { Button } from '../components/Button';
import { Minus, Search, Filter, X } from 'lucide-react';
import { useApp } from '../App';

const Consumption: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [amounts, setAmounts] = useState<{[key: string]: string}>({});
  const user = auth.currentUser;
  const { profile } = useApp();

  useEffect(() => {
    if (user && profile) {
      const unsubSub = subscribeToCollection('subcategories', profile.householdId, (data) => setSubcategories(data as Subcategory[]));
      const unsubCat = subscribeToCollection('categories', profile.householdId, (data) => setCategories(data as Category[]));
      return () => { unsubSub(); unsubCat(); };
    }
  }, [user, profile]);

  const filteredItems = subcategories
    .map(sub => ({
      ...sub,
      categoryName: categories.find(c => c.id === sub.categoryId)?.name || 'Outros'
    }))
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'todas' || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const catCompare = a.categoryName.localeCompare(b.categoryName);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

  const getStockColorClass = (item: Subcategory) => {
    const current = item.currentStock || 0;
    const min = item.minimumStock || 0;
    const target = item.targetStock || 0;

    if (current < min) return 'text-red-600 font-bold';
    if (current < target) return 'text-yellow-600 font-bold';
    return 'text-green-600 font-medium';
  };

  const handleConsume = async (item: Subcategory) => {
    if (!user || !profile) return;
    const amountStr = amounts[item.id];
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    const newStock = Math.max(0, item.currentStock - amount);
    
    await updateStockWithLog(user.uid, profile.householdId, {
      type: 'saída',
      origin: 'consumo',
      subcategoryId: item.id,
      subcategoryName: item.name,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      quantity: -amount,
      displayQuantity: `-${amount} ${item.measureUnit}`,
    }, newStock);
    
    setAmounts(prev => ({ ...prev, [item.id]: '' }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Registrar Consumo</h2>

      {/* BARRA DE PESQUISA E FILTRO */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="O que você usou?"
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-sm"
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
        <div className="divide-y divide-gray-100">
          {filteredItems.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1 mr-4 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="font-bold text-gray-800 truncate">{item.name}</div>
                  <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                    {item.categoryName}
                  </span>
                </div>
                <div className={`text-xs font-mono ${getStockColorClass(item)}`}>
                  Estoque: {item.currentStock} {item.measureUnit}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 shrink-0">
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="w-36 p-2 pr-12 text-sm border border-gray-300 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={amounts[item.id] || ''}
                    onChange={(e) => setAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">
                    {item.measureUnit}
                  </span>
                </div>
                <Button 
                  onClick={() => handleConsume(item)}
                  disabled={!amounts[item.id]}
                  variant="danger"
                  className="p-2 h-9 w-9 flex items-center justify-center rounded-lg shadow-sm active:scale-95 transition-transform"
                >
                  <Minus size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
            <Search size={32} className="text-gray-200" />
            <p className="italic text-sm">Nenhum item encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Consumption;
