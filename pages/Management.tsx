import React, { useEffect, useState } from 'react';
import { subscribeToCollection, addCategory, addSubcategory, addProduct, deleteItem } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category, Product } from '../types';
import { Button } from '../components/Button';
import { Trash2 } from 'lucide-react';

type Tab = 'categories' | 'subcategories' | 'products';

const Management: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('subcategories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const user = auth.currentUser;

  // Forms State
  const [newCatName, setNewCatName] = useState('');
  
  const [newSubName, setNewSubName] = useState('');
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newSubTarget, setNewSubTarget] = useState('');
  const [newSubCurrent, setNewSubCurrent] = useState('');
  const [newSubUnit, setNewSubUnit] = useState('un');

  const [newProdName, setNewProdName] = useState('');
  const [newProdSubId, setNewProdSubId] = useState('');

  useEffect(() => {
    if (user) {
      const u1 = subscribeToCollection('categories', user.uid, (d) => setCategories(d as Category[]));
      const u2 = subscribeToCollection('subcategories', user.uid, (d) => setSubcategories(d as Subcategory[]));
      const u3 = subscribeToCollection('products', user.uid, (d) => setProducts(d as Product[]));
      return () => { u1(); u2(); u3(); };
    }
  }, [user]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && newCatName) {
      await addCategory(user.uid, newCatName);
      setNewCatName('');
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && newSubName && newSubCatId) {
      await addSubcategory(user.uid, {
        name: newSubName,
        categoryId: newSubCatId,
        targetStock: Number(newSubTarget),
        currentStock: Number(newSubCurrent),
        unit: newSubUnit,
      });
      setNewSubName('');
      setNewSubTarget('');
      setNewSubCurrent('');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && newProdName && newProdSubId) {
      await addProduct(user.uid, {
        name: newProdName,
        subcategoryId: newProdSubId
      });
      setNewProdName('');
    }
  };

  const handleDelete = async (collection: string, id: string) => {
    if (window.confirm('Tem certeza?')) {
      await deleteItem(collection, id);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Gestão de Itens</h2>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 pb-1 overflow-x-auto">
        {(['categories', 'subcategories', 'products'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize whitespace-nowrap ${
              activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'subcategories' ? 'Itens (Sub)' : tab === 'products' ? 'Produtos (Marcas)' : 'Categorias'}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        
        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input 
                className="flex-1 border p-2 rounded" 
                placeholder="Nova Categoria (ex: Limpeza)" 
                value={newCatName} 
                onChange={e => setNewCatName(e.target.value)} 
              />
              <Button type="submit">Adicionar</Button>
            </form>
            <ul className="divide-y">
              {categories.map(c => (
                <li key={c.id} className="py-2 flex justify-between items-center">
                  <span>{c.name}</span>
                  <button onClick={() => handleDelete('categories', c.id)} className="text-red-500"><Trash2 size={16}/></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Subcategories Tab */}
        {activeTab === 'subcategories' && (
          <div className="space-y-6">
            <form onSubmit={handleAddSubcategory} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="border p-2 rounded" placeholder="Nome (ex: Arroz)" value={newSubName} onChange={e => setNewSubName(e.target.value)} required />
              <select className="border p-2 rounded" value={newSubCatId} onChange={e => setNewSubCatId(e.target.value)} required>
                <option value="">Selecione Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" className="border p-2 rounded" placeholder="Estoque Atual" value={newSubCurrent} onChange={e => setNewSubCurrent(e.target.value)} required />
              <input type="number" className="border p-2 rounded" placeholder="Estoque Alvo" value={newSubTarget} onChange={e => setNewSubTarget(e.target.value)} required />
              <input className="border p-2 rounded" placeholder="Unidade (ex: kg, un)" value={newSubUnit} onChange={e => setNewSubUnit(e.target.value)} required />
              <Button type="submit" className="md:col-span-2">Salvar Item</Button>
            </form>
            <div className="mt-4">
              {subcategories.map(s => (
                <div key={s.id} className="py-3 border-b flex justify-between items-center">
                  <div>
                    <span className="font-bold">{s.name}</span> <span className="text-sm text-gray-500">({categories.find(c => c.id === s.categoryId)?.name})</span>
                    <div className="text-xs text-gray-400">Estoque: {s.currentStock} / {s.targetStock} {s.unit}</div>
                  </div>
                  <button onClick={() => handleDelete('subcategories', s.id)} className="text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
              Produtos são marcas específicas de um item. Ex: "Arroz Tio João" para o item "Arroz".
            </div>
            <form onSubmit={handleAddProduct} className="flex flex-col md:flex-row gap-2">
              <select className="border p-2 rounded flex-1" value={newProdSubId} onChange={e => setNewProdSubId(e.target.value)} required>
                <option value="">Selecione o Item (Subcategoria)</option>
                {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="border p-2 rounded flex-1" placeholder="Nome do Produto (Marca)" value={newProdName} onChange={e => setNewProdName(e.target.value)} required />
              <Button type="submit">Adicionar</Button>
            </form>
            <ul className="divide-y">
              {products.map(p => (
                <li key={p.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{p.name}</span>
                    <span className="text-sm text-gray-500 ml-2">
                       - {subcategories.find(s => s.id === p.subcategoryId)?.name}
                    </span>
                  </div>
                  <button onClick={() => handleDelete('products', p.id)} className="text-red-500"><Trash2 size={16}/></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Management;