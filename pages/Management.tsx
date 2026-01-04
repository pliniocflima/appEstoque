
import React, { useState, useMemo } from 'react';
import { addCategory, addSubcategory, addProduct, deleteItem, updateItem } from '../services/db';
import { auth } from '../services/firebase';
import { useApp, useData } from '../App';
import { Button } from '../components/Button';
import { Trash2, Plus, Edit2, Check, X, Package, Tag, Layers, AlertCircle, ShieldAlert, Search, Filter } from 'lucide-react';
// Import missing types for casting to fix union type errors
import { Category, Subcategory, Product } from '../types';

type Tab = 'categories' | 'subcategories' | 'products';

interface DeleteState {
  type: 'category' | 'subcategory' | 'product';
  id: string;
  name: string;
  blocked: boolean;
  reason?: string;
}

const Management: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('subcategories');
  const { categories, subcategories, products, measures, loading } = useData();
  const { profile } = useApp();
  const user = auth.currentUser;

  // Search & Filter Global State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');

  // Forms State
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newSubMeasureId, setNewSubMeasureId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSubId, setNewProdSubId] = useState('');
  const [newProdMeasureId, setNewProdMeasureId] = useState('');
  const [newProdQty, setNewProdQty] = useState('1');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCatId, setEditCatId] = useState('');

  // Delete Modal State
  const [deleteRequest, setDeleteRequest] = useState<DeleteState | null>(null);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const sortedMeasures = useMemo(() => [...measures].sort((a, b) => a.measureUnit.localeCompare(b.measureUnit)), [measures]);
  
  // Filtros dinâmicos baseados na aba
  const filteredData = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    if (activeTab === 'categories') {
      return sortedCategories.filter(c => c.name.toLowerCase().includes(searchLower));
    }
    
    if (activeTab === 'subcategories') {
      return subcategories
        .filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(searchLower) || (s.categoryName || '').toLowerCase().includes(searchLower);
          const matchesCategory = selectedCategory === 'todas' || s.categoryId === selectedCategory;
          return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
          const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '');
          if (catCompare !== 0) return catCompare;
          return a.name.localeCompare(b.name);
        });
    }

    if (activeTab === 'products') {
      return products
        .filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchLower) || 
                               (p.subcategoryName || '').toLowerCase().includes(searchLower) ||
                               (p.categoryName || '').toLowerCase().includes(searchLower);
          const matchesCategory = selectedCategory === 'todas' || p.categoryId === selectedCategory;
          return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
          const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '');
          if (catCompare !== 0) return catCompare;
          const subCompare = (a.subcategoryName || '').localeCompare(b.subcategoryName || '');
          if (subCompare !== 0) return subCompare;
          return a.name.localeCompare(b.name);
        });
    }
    
    return [];
  }, [activeTab, searchTerm, selectedCategory, sortedCategories, subcategories, products]);

  const selectedSubForNewProduct = subcategories.find(s => s.id === newProdSubId);
  const compatibleMeasuresForNewProduct = useMemo(() => {
    if (!selectedSubForNewProduct) return [];
    return sortedMeasures.filter(m => m.measureControl === selectedSubForNewProduct.measureControl);
  }, [selectedSubForNewProduct, sortedMeasures]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && profile && newCatName) {
      await addCategory(user.uid, profile.householdId, newCatName);
      setNewCatName('');
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === newSubCatId);
    const msr = measures.find(m => m.id === newSubMeasureId);
    if (user && profile && newSubName && cat && msr) {
      await addSubcategory(user.uid, profile.householdId, {
        name: newSubName,
        categoryId: cat.id,
        categoryName: cat.name,
        measureId: msr.id,
        measureControl: msr.measureControl,
        measureUnit: msr.measureUnit,
        minimumStock: 0,
        targetStock: 0,
        currentStock: 0
      });
      setNewSubName(''); setNewSubCatId(''); setNewSubMeasureId('');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const sub = subcategories.find(s => s.id === newProdSubId);
    const msr = measures.find(m => m.id === (newProdMeasureId || sub?.measureId));
    
    if (user && profile && newProdName && sub && msr) {
      const nameInApp = `${newProdName} (${newProdQty}${msr.measureUnit})`;
      await addProduct(user.uid, profile.householdId, {
        name: newProdName,
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        categoryId: sub.categoryId,
        categoryName: sub.categoryName,
        measureId: msr.id,
        measureControl: msr.measureControl,
        measureUnit: msr.measureUnit,
        unitQuantity: Number(newProdQty),
        nameInApp,
        allowed: true,
        comments: ''
      });
      setNewProdName(''); setNewProdSubId(''); setNewProdQty('1'); setNewProdMeasureId('');
    }
  };

  const initiateDelete = (type: 'category' | 'subcategory' | 'product', id: string, name: string) => {
    let blocked = false;
    let reason = '';

    if (type === 'category') {
      const hasSub = subcategories.some(s => s.categoryId === id);
      if (hasSub) {
        blocked = true;
        reason = 'Esta categoria possui itens vinculados.';
      }
    } else if (type === 'subcategory') {
      const sub = subcategories.find(s => s.id === id);
      const hasProd = products.some(p => p.subcategoryId === id);
      const hasStock = (sub?.currentStock || 0) > 0;
      if (hasProd) {
        blocked = true;
        reason = 'Este item possui produtos específicos vinculados.';
      } else if (hasStock) {
        blocked = true;
        reason = `Este item ainda possui estoque.`;
      }
    }

    setDeleteRequest({ type, id, name, blocked, reason });
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    const colMap = { category: 'categories', subcategory: 'subcategories', product: 'products' };
    await deleteItem(colMap[deleteRequest.type], deleteRequest.id);
    setDeleteRequest(null);
  };

  const saveEditCategory = async (id: string) => {
    if (!editName.trim()) return;
    await updateItem('categories', id, { name: editName });
    setEditingId(null);
  };

  const saveEditSubcategory = async (id: string) => {
    const cat = categories.find(c => c.id === editCatId);
    if (!cat) return;
    await updateItem('subcategories', id, {
      name: editName,
      categoryId: cat.id,
      categoryName: cat.name
    });
    setEditingId(null);
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando dados de gestão...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Cadastro e Gestão</h2>

      <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
        {(['categories', 'subcategories', 'products'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditingId(null); setSearchTerm(''); setSelectedCategory('todas'); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'categories' && <Tag size={16} />}
            {tab === 'subcategories' && <Package size={16} />}
            {tab === 'products' && <Layers size={16} />}
            {tab === 'subcategories' ? 'Itens' : tab === 'products' ? 'Produtos' : 'Categorias'}
          </button>
        ))}
      </div>

      {/* Barra de Pesquisa e Filtro Inteligente */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={`Pesquisar em ${activeTab === 'subcategories' ? 'itens' : activeTab === 'products' ? 'produtos' : 'categorias'}...`}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16}/></button>}
        </div>
        {activeTab !== 'categories' && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            <select 
              className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none text-sm font-medium min-w-[160px]"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="todas">Todas Categorias</option>
              {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        {activeTab === 'subcategories' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddSubcategory} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <input className="border p-2 rounded-lg text-sm" placeholder="Nome do Item" value={newSubName} onChange={e => setNewSubName(e.target.value)} required />
              <select className="border p-2 rounded-lg text-sm" value={newSubCatId} onChange={e => setNewSubCatId(e.target.value)} required>
                <option value="">Categoria...</option>
                {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="border p-2 rounded-lg text-sm" value={newSubMeasureId} onChange={e => setNewSubMeasureId(e.target.value)} required>
                <option value="">Medida...</option>
                {sortedMeasures.map(m => <option key={m.id} value={m.id}>{m.measureUnit}</option>)}
              </select>
              <Button type="submit" className="md:col-span-3 py-2 text-sm">Cadastrar Novo Item</Button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Cast filteredData to Subcategory[] to fix type errors on properties unique to Subcategory */}
              {(filteredData as Subcategory[]).map(s => (
                <div key={s.id} className="p-4 border rounded-xl hover:bg-gray-50 flex flex-col justify-between transition-colors shadow-sm group">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      {editingId === s.id ? (
                        <input className="flex-1 border p-1 rounded text-sm mb-1" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{s.name}</span>
                          <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">{s.categoryName}</span>
                        </div>
                      )}
                      <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                         {editingId === s.id ? (
                          <>
                            <button onClick={() => saveEditSubcategory(s.id)} className="text-green-600 p-1"><Check size={18}/></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 p-1"><X size={18}/></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditCatId(s.categoryId); }} className="text-gray-300 hover:text-blue-600 p-1"><Edit2 size={16}/></button>
                            <button onClick={() => initiateDelete('subcategory', s.id, s.name)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId === s.id ? (
                      <select className="border p-1 rounded text-[10px] w-full mt-1" value={editCatId} onChange={e => setEditCatId(e.target.value)}>
                        {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-bold tracking-tight">{s.measureControl}: {s.measureUnit}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <input className="flex-1 border p-2 rounded-lg text-sm" placeholder="Nome da Categoria..." value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
              <Button type="submit"><Plus size={18} /></Button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Cast filteredData to Category[] */}
              {(filteredData as Category[]).map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors shadow-sm group">
                  {editingId === c.id ? (
                    <input className="flex-1 border p-1 rounded mr-2 text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                  ) : (
                    <span className="font-bold text-gray-700 text-sm">{c.name}</span>
                  )}
                  <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    {editingId === c.id ? (
                      <button onClick={() => saveEditCategory(c.id)} className="text-green-600 p-1"><Check size={18}/></button>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="text-gray-300 hover:text-blue-600 p-1"><Edit2 size={16}/></button>
                        <button onClick={() => initiateDelete('category', c.id, c.name)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="md:col-span-1">
                <input className="w-full border p-2 rounded-lg text-sm" placeholder="Marca/Produto (ex: Tio João)" value={newProdName} onChange={e => setNewProdName(e.target.value)} required />
              </div>
              <div className="md:col-span-1">
                <select className="w-full border p-2 rounded-lg text-sm" value={newProdSubId} onChange={e => setNewProdSubId(e.target.value)} required>
                  <option value="">Item Pai...</option>
                  {subcategories.sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name} ({s.categoryName})</option>)}
                </select>
              </div>
              <div className="md:col-span-1 flex gap-1">
                <input type="number" step="0.01" className="flex-1 border p-2 rounded-lg text-sm" placeholder="Qtd Emb." value={newProdQty} onChange={e => setNewProdQty(e.target.value)} required />
                <select 
                  className="flex-1 border p-2 rounded-lg text-[10px] font-bold" 
                  value={newProdMeasureId} 
                  onChange={e => setNewProdMeasureId(e.target.value)}
                  disabled={!selectedSubForNewProduct}
                >
                  <option value="">{selectedSubForNewProduct ? `Unid (${selectedSubForNewProduct.measureUnit})` : 'Unidade...'}</option>
                  {compatibleMeasuresForNewProduct.map(m => (
                    <option key={m.id} value={m.id}>{m.measureUnit}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="md:col-span-1 py-2 text-sm">Cadastrar</Button>
            </form>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Cast filteredData to Product[] to fix type errors on properties unique to Product */}
              {(filteredData as Product[]).map(p => (
                <div key={p.id} className="p-4 border rounded-xl hover:bg-gray-50 flex flex-col justify-between transition-colors shadow-sm group">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-sm truncate">{p.nameInApp}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 font-bold tracking-tight">{p.subcategoryName}</span>
                        <span className="bg-gray-100 text-gray-400 text-[7px] px-1 py-0.5 rounded font-bold uppercase shrink-0">{p.categoryName}</span>
                      </div>
                    </div>
                    <button onClick={() => initiateDelete('product', p.id, p.name)} className="text-gray-300 hover:text-red-500 p-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {deleteRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteRequest.blocked ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
              {deleteRequest.blocked ? <ShieldAlert size={32} /> : <AlertCircle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{deleteRequest.blocked ? 'Ação Bloqueada' : 'Confirmar'}</h3>
            <p className="text-sm text-gray-500 mb-6">{deleteRequest.blocked ? deleteRequest.reason : `Excluir "${deleteRequest.name}"?`}</p>
            <div className="space-y-3">
              {!deleteRequest.blocked && <Button fullWidth variant="danger" onClick={confirmDelete}>Excluir Agora</Button>}
              <button onClick={() => setDeleteRequest(null)} className="w-full py-2 text-sm font-medium text-gray-400">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
