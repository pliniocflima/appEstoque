
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, updateStockWithLog } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category } from '../types';
import { Button } from '../components/Button';
import { Minus, Search } from 'lucide-react';
import { useApp } from '../App';

const Consumption: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a,b) => a.name.localeCompare(b.name));

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
      // Adicionado o sinal de negativo explicitamente para o histórico
      displayQuantity: `-${amount} ${item.measureUnit}`,
    }, newStock);
    
    setAmounts(prev => ({ ...prev, [item.id]: '' }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Registrar Consumo</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="O que você usou hoje? (ex: Arroz, Detergente...)"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredItems.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="font-bold text-gray-800">{item.name}</div>
                <div className="text-xs text-gray-400 uppercase font-semibold">{item.categoryName}</div>
                <div className={`text-sm mt-1 font-mono ${getStockColorClass(item)}`}>
                  Disponível: {item.currentStock} {item.measureUnit}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    className="w-24 p-2 pr-8 text-sm border border-gray-300 rounded-lg text-right font-bold"
                    value={amounts[item.id] || ''}
                    onChange={(e) => setAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">
                    {item.measureUnit}
                  </span>
                </div>
                <Button 
                  onClick={() => handleConsume(item)}
                  disabled={!amounts[item.id]}
                  variant="danger"
                  className="p-2 h-10 w-10 flex items-center justify-center rounded-lg"
                  title="Registrar Saída"
                >
                  <Minus size={20} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            Nenhum item encontrado na sua despensa.
          </div>
        )}
      </div>
    </div>
  );
};

export default Consumption;
