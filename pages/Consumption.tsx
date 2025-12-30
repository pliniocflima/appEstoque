import React, { useEffect, useState } from 'react';
import { subscribeToCollection, updateStock } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category } from '../types';
import { Button } from '../components/Button';
import { Minus, Search } from 'lucide-react';

const Consumption: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [amounts, setAmounts] = useState<{[key: string]: string}>({});
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const unsubSub = subscribeToCollection('subcategories', user.uid, (data) => setSubcategories(data as Subcategory[]));
      const unsubCat = subscribeToCollection('categories', user.uid, (data) => setCategories(data as Category[]));
      return () => {
        unsubSub();
        unsubCat();
      };
    }
  }, [user]);

  const filteredItems = subcategories
    .map(sub => ({
      ...sub,
      categoryName: categories.find(c => c.id === sub.categoryId)?.name || 'Outros'
    }))
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleConsume = async (id: string, currentStock: number) => {
    const amountStr = amounts[id];
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    const newStock = Math.max(0, currentStock - amount);
    
    await updateStock(id, newStock);
    
    // Reset input
    setAmounts(prev => ({ ...prev, [id]: '' }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Registrar Consumo</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar item..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredItems.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-500">{item.categoryName}</div>
                <div className={`text-sm mt-1 font-medium ${item.currentStock < item.targetStock ? 'text-red-500' : 'text-green-600'}`}>
                  Estoque: {item.currentStock} {item.unit}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Qtd"
                  className="w-20 p-2 text-sm border border-gray-300 rounded-lg"
                  value={amounts[item.id] || ''}
                  onChange={(e) => setAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                />
                <Button 
                  onClick={() => handleConsume(item.id, item.currentStock)}
                  disabled={!amounts[item.id]}
                  variant="danger"
                  className="p-2"
                >
                  <Minus size={20} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">Nenhum item encontrado.</div>
        )}
      </div>
    </div>
  );
};

export default Consumption;