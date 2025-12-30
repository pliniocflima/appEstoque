import React, { useEffect, useState } from 'react';
import { subscribeToCollection, toggleShoppingList } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category } from '../types';
import { Button } from '../components/Button';
import { Check, Plus, AlertCircle } from 'lucide-react';

const ShoppingList: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  // Merge Category Name
  const enrichedSubcategories = subcategories.map(sub => ({
    ...sub,
    categoryName: categories.find(c => c.id === sub.categoryId)?.name || 'Sem Categoria'
  }));

  const itemsToBuy = enrichedSubcategories.filter(s => s.isOnShoppingList);
  const itemsLowStock = enrichedSubcategories.filter(s => s.currentStock < s.targetStock && !s.isOnShoppingList);
  const otherItems = enrichedSubcategories.filter(s => !s.isOnShoppingList && s.currentStock >= s.targetStock);

  const handleAutoList = async () => {
    // Add all low stock items to shopping list
    const updates = itemsLowStock.map(item => toggleShoppingList(item.id, true));
    await Promise.all(updates);
  };

  const handleToggle = async (id: string, currentStatus: boolean | undefined) => {
    await toggleShoppingList(id, !currentStatus);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Planejar Compras</h2>
        {itemsLowStock.length > 0 && (
          <Button onClick={handleAutoList} className="flex items-center justify-center">
            <Plus size={18} className="mr-2" />
            Adicionar {itemsLowStock.length} itens com baixo estoque
          </Button>
        )}
      </div>

      {/* Active Shopping List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <h3 className="font-semibold text-blue-800">Na Lista de Compras ({itemsToBuy.length})</h3>
        </div>
        {itemsToBuy.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sua lista está vazia.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {itemsToBuy.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    Estoque: {item.currentStock} / {item.targetStock} {item.unit} • {item.categoryName}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleToggle(item.id, true)}>
                  <span className="text-red-500 text-sm">Remover</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low Stock Suggestions */}
      {itemsLowStock.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center">
            <AlertCircle size={18} className="text-red-600 mr-2" />
            <h3 className="font-semibold text-red-800">Sugestões (Estoque Baixo)</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsLowStock.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-red-500 font-medium">
                    Abaixo do alvo: {item.currentStock} / {item.targetStock} {item.unit}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => handleToggle(item.id, false)}>
                  Adicionar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">Outros Itens</h3>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {otherItems.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div>
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-green-600">
                  OK: {item.currentStock} / {item.targetStock} {item.unit}
                </div>
              </div>
              <Button variant="ghost" onClick={() => handleToggle(item.id, false)}>
                <Plus size={18} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;