
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, toggleShoppingList, addToCart, removeFromCart } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category, CartItem } from '../types';
import { Button } from '../components/Button';
import { Check, Plus, AlertCircle, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';

const ShoppingList: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const user = auth.currentUser;
  const { profile } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      const unsubSub = subscribeToCollection('subcategories', profile.householdId, (data) => setSubcategories(data as Subcategory[]));
      const unsubCat = subscribeToCollection('categories', profile.householdId, (data) => setCategories(data as Category[]));
      const unsubCart = subscribeToCollection('cart', profile.householdId, (data) => setCart(data as CartItem[]));
      return () => { unsubSub(); unsubCat(); unsubCart(); };
    }
  }, [user, profile]);

  const enrichedSubcategories = subcategories.map(sub => ({
    ...sub,
    categoryName: categories.find(c => c.id === sub.categoryId)?.name || 'Sem Categoria'
  }));

  // Agrupamento baseado na nova lógica de criticidade
  const itemsOnList = enrichedSubcategories.filter(s => s.isOnShoppingList);
  
  const itemsCritical = enrichedSubcategories.filter(s => 
    !s.isOnShoppingList && s.currentStock < (s.minimumStock || 0)
  );

  const itemsBelowTarget = enrichedSubcategories.filter(s => 
    !s.isOnShoppingList && 
    s.currentStock >= (s.minimumStock || 0) && 
    s.currentStock < (s.targetStock || 0)
  );

  const itemsOk = enrichedSubcategories.filter(s => 
    !s.isOnShoppingList && s.currentStock >= (s.targetStock || 0)
  );

  const handleToggle = async (item: Subcategory) => {
    const isAdding = !item.isOnShoppingList;
    await toggleShoppingList(item.id, isAdding);

    if (isAdding && user && profile) {
      const existsInCart = cart.find(c => c.subcategoryId === item.id);
      if (!existsInCart) {
        await addToCart(user.uid, profile.householdId, {
          subcategoryId: item.id,
          subcategoryName: item.name,
          productId: '',
          productName: 'Genérico',
          productQuantity: 1,
          quantity: 1,
          unit: item.measureUnit,
          unitPrice: 0
        });
      }
    } else {
      const cartItem = cart.find(c => c.subcategoryId === item.id);
      if (cartItem) await removeFromCart(cartItem.id);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShoppingCart className="mr-2 text-blue-600" /> Planejar Compra
        </h2>
        {cart.length > 0 && (
          <Button onClick={() => navigate('/compras')} variant="primary" className="shadow-lg">
            Ir para o Mercado ({cart.length})
          </Button>
        )}
      </div>

      {/* 1. SELEÇÃO ATUAL (No Carrinho/Lista) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
          <h3 className="font-bold text-white">Itens Selecionados ({itemsOnList.length})</h3>
        </div>
        {itemsOnList.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic text-sm">Toque no + dos itens abaixo para adicionar à lista.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {itemsOnList.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <div className="font-bold text-gray-900">{item.name}</div>
                  <div className="text-[10px] text-gray-400 uppercase font-semibold">
                    {item.categoryName} • Estoque: {item.currentStock} {item.measureUnit}
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle(item)} 
                  className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. ESTOQUE CRÍTICO (Vermelho) */}
      {itemsCritical.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center text-red-700">
              <AlertCircle size={18} className="mr-2" />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Estoque Crítico (Abaixo do Mínimo)</h3>
            </div>
            <span className="bg-red-200 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{itemsCritical.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsCritical.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900">{item.name}</div>
                  <div className="text-xs text-red-500 font-bold">Faltam {(item.targetStock - item.currentStock).toFixed(1)} {item.measureUnit}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleToggle(item)} className="border-red-200 hover:bg-red-50">
                  <Plus size={16} className="text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ABAIXO DO ALVO (Amarelo) */}
      {itemsBelowTarget.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 overflow-hidden">
          <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
            <div className="flex items-center text-yellow-700">
              <AlertTriangle size={18} className="mr-2" />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Reposição (Abaixo do Alvo)</h3>
            </div>
            <span className="bg-yellow-200 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{itemsBelowTarget.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsBelowTarget.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900">{item.name}</div>
                  <div className="text-xs text-yellow-600 font-medium">Sugerido comprar {(item.targetStock - item.currentStock).toFixed(1)} {item.measureUnit}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleToggle(item)} className="border-yellow-200 hover:bg-yellow-50">
                  <Plus size={16} className="text-yellow-600" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CATÁLOGO GERAL (Verde) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center text-gray-600">
            <CheckCircle2 size={18} className="mr-2" />
            <h3 className="font-bold uppercase text-[10px] tracking-widest">Em Dia</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {itemsOk.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <div className="font-medium text-gray-700">{item.name}</div>
                <div className="text-[10px] text-green-600 font-bold uppercase">Estoque OK: {item.currentStock} {item.measureUnit}</div>
              </div>
              <button onClick={() => handleToggle(item)} className="text-gray-300 hover:text-blue-600 p-2">
                <Plus size={20} />
              </button>
            </div>
          ))}
          {itemsOk.length === 0 && (
            <div className="p-8 text-center text-gray-300 text-xs italic">Nenhum item com estoque completo.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;
