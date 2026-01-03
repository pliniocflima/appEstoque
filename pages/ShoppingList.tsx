
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, addToCart, removeFromCart } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category, CartItem } from '../types';
import { Button } from '../components/Button';
import { Check, Plus, AlertCircle, ShoppingCart, AlertTriangle, CheckCircle2, Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';

const ShoppingList: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  
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

  const sortedSubcategories = enrichedSubcategories.sort((a, b) => {
    const catCompare = a.categoryName.localeCompare(b.categoryName);
    if (catCompare !== 0) return catCompare;
    return a.name.localeCompare(b.name);
  });

  const isInCart = (id: string) => cart.some(c => c.subcategoryId === id);

  const filteredData = sortedSubcategories.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'todas' || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsOnList = sortedSubcategories.filter(s => isInCart(s.id));
  
  const itemsCritical = filteredData.filter(s => 
    !isInCart(s.id) && s.currentStock < (s.minimumStock || 0)
  );

  const itemsBelowTarget = filteredData.filter(s => 
    !isInCart(s.id) && 
    s.currentStock >= (s.minimumStock || 0) && 
    s.currentStock < (s.targetStock || 0)
  );

  const itemsOk = filteredData.filter(s => 
    !isInCart(s.id) && s.currentStock >= (s.targetStock || 0)
  );

  const handleToggle = async (item: Subcategory) => {
    const currentlyInCart = isInCart(item.id);

    if (!currentlyInCart && user && profile) {
      await addToCart(user.uid, profile.householdId, {
        subcategoryId: item.id,
        subcategoryName: item.name,
        productId: '',
        productName: 'Genérico',
        productQuantity: 1,
        quantity: 0, 
        unit: item.measureUnit,
        unitPrice: 0 
      });
    } else {
      const cartItem = cart.find(c => c.subcategoryId === item.id);
      if (cartItem) await removeFromCart(cartItem.id);
    }
  };

  const renderItemRow = (item: Subcategory, isSelected: boolean = false) => {
    const current = item.currentStock || 0;
    const min = item.minimumStock || 0;
    const target = item.targetStock || 0;
    const gap = Math.max(0, target - current);

    let statusColor = 'text-green-600';
    if (current < min) statusColor = 'text-red-600';
    else if (current < target) statusColor = 'text-yellow-600';

    return (
      <div key={item.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
            <span className="bg-gray-100 text-gray-500 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              {item.categoryName}
            </span>
          </div>
          <div className={`text-[11px] font-bold ${statusColor}`}>
            Estoque Atual: {current} {item.measureUnit}
            {gap > 0 && (
              <>
                <span className="mx-1.5 opacity-30 text-gray-400">|</span>
                Comprar: {gap.toFixed(1).replace('.0', '')} {item.measureUnit}
              </>
            )}
            {gap === 0 && current >= target && (
              <>
                <span className="mx-1.5 opacity-30 text-gray-400">|</span>
                Em Dia
              </>
            )}
          </div>
        </div>
        
        {isSelected ? (
          <button 
            onClick={() => handleToggle(item)} 
            className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors shrink-0"
          >
            Remover
          </button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => handleToggle(item)} className="shrink-0 border-gray-200">
            <Plus size={16} className="text-blue-600" />
          </Button>
        )}
      </div>
    );
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

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar item ou categoria..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Check size={18} /> Itens Selecionados ({itemsOnList.length})
          </h3>
        </div>
        {itemsOnList.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic text-sm">Toque no + dos itens abaixo para planejar sua compra.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {itemsOnList.map(item => renderItemRow(item, true))}
          </div>
        )}
      </div>

      {itemsCritical.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center text-red-700">
              <AlertCircle size={18} className="mr-2" />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Estoque Crítico</h3>
            </div>
            <span className="bg-red-200 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{itemsCritical.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsCritical.map(item => renderItemRow(item, false))}
          </div>
        </div>
      )}

      {itemsBelowTarget.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 overflow-hidden">
          <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
            <div className="flex items-center text-yellow-700">
              <AlertTriangle size={18} className="mr-2" />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Reposição</h3>
            </div>
            <span className="bg-yellow-200 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{itemsBelowTarget.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsBelowTarget.map(item => renderItemRow(item, false))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center text-gray-600">
            <CheckCircle2 size={18} className="mr-2" />
            <h3 className="font-bold uppercase text-[10px] tracking-widest">Em Dia</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {itemsOk.map(item => renderItemRow(item, false))}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;
