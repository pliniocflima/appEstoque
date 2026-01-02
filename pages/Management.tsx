
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, addCategory, addSubcategory, addProduct, deleteItem, updateItem } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Category, Measure, Product, Movement } from '../types';
import { Button } from '../components/Button';
import { Trash2, Plus, Edit2, Check, X, Package, Tag, Layers, AlertCircle, ShieldAlert } from 'lucide-react';
import { useApp } from '../App';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const user = auth.currentUser;
  const { profile } = useApp();

  // Forms State
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newSubMeasureId, setNewSubMeasureId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSubId, setNewProdSubId] = useState('');
  const [newProdQty, setNewProdQty] = useState('1');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [editMeasureId, setEditMeasureId] = useState('');
  const [editSubId, setEditSubId] = useState('');
  const [editQty, setEditQty] = useState('');

  // Delete Modal State
  const [deleteRequest, setDeleteRequest] = useState<DeleteState | null>(null);

  useEffect(() => {
    if (user && profile) {
      const u1 = subscribeToCollection('categories', profile.householdId, (d) => setCategories(d as Category[]));
      const u2 = subscribeToCollection('subcategories', profile.householdId, (d) => setSubcategories(d as Subcategory[]));
      const u3 = subscribeToCollection('measures', profile.householdId, (d) => setMeasures(d as Measure[]));
      const u4 = subscribeToCollection('products', profile.householdId, (d) => setProducts(d as Product[]));
      const u5 = subscribeToCollection('movements', profile.householdId, (d) => setMovements(d as Movement[]));
      return () => { u1(); u2(); u3(); u4(); u5(); };
    }
  }, [user, profile]);

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const sortedMeasures = [...measures].sort((a, b) => a.measureUnit.localeCompare(b.measureUnit));
  const sortedSubOptions = [...subcategories].sort((a, b) => {
    const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '');
    return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name);
  });

  const selectedSubForNewProduct = subcategories.find(s => s.id === newProdSubId);

  // Handlers
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
        currentStock: 0,
        productsQuantity: 0
      });
      setNewSubName(''); setNewSubCatId(''); setNewSubMeasureId('');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const sub = subcategories.find(s => s.id === newProdSubId);
    if (user && profile && newProdName && sub) {
      const nameInApp = `${newProdName} (${newProdQty}${sub.measureUnit})`;
      await addProduct(user.uid, profile.householdId, {
        name: newProdName,
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        categoryId: sub.categoryId,
        categoryName: sub.categoryName,
        measureId: sub.measureId,
        measureControl: sub.measureControl,
        measureUnit: sub.measureUnit,
        unitQuantity: Number(newProdQty),
        nameInApp,
        allowed: true,
        comments: ''
      });
      setNewProdName(''); setNewProdSubId(''); setNewProdQty('1');
    }
  };

  const initiateDelete = (type: 'category' | 'subcategory' | 'product', id: string, name: string) => {
    let blocked = false;
    let reason = '';

    if (type === 'category') {
      const hasSub = subcategories.some(s => s.categoryId === id);
      if (hasSub) {
        blocked = true;
        reason = 'Esta categoria possui itens vinculados. Remova ou mova os itens antes de excluir.';
      }
    } else if (type === 'subcategory') {
      const sub = subcategories.find(s => s.id === id);
      const hasProd = products.some(p => p.subcategoryId === id);
      const hasStock = (sub?.currentStock || 0) > 0;
      const hasHistory = movements.some(m => m.subcategoryId === id);
      
      if (hasProd) {
        blocked = true;
        reason = 'Este item possui produtos específicos vinculados. Exclua os produtos primeiro.';
      } else if (hasStock) {
        blocked = true;
        reason = `Este item ainda possui estoque (${sub?.currentStock} ${sub?.measureUnit}). Zere o estoque antes de tentar excluir.`;
      } else if (hasHistory) {
        blocked = true;
        reason = 'Este item possui registros no histórico de movimentações (compras ou consumos). Para manter a integridade dos seus relatórios, ele não pode ser excluído.';
      }
    } else if (type === 'product') {
      const hasHistory = movements.some(m => m.productId === id);
      if (hasHistory) {
        blocked = true;
        reason = 'Este produto específico já foi utilizado em compras registradas no histórico. Ele não pode ser removido para não invalidar os registros passados.';
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
    const subsToUpdate = subcategories.filter(s => s.categoryId === id);
    for (const sub of subsToUpdate) await updateItem('subcategories', sub.id, { categoryName: editName });
    const prodsToUpdate = products.filter(p => p.categoryId === id);
    for (const prod of prodsToUpdate) await updateItem('products', prod.id, { categoryName: editName });
    setEditingId(null);
  };

  const saveEditSubcategory = async (id: string) => {
    const cat = categories.find(c => c.id === editCatId);
    const msr = measures.find(m => m.id === editMeasureId);
    if (!cat || !msr) return;
    await updateItem('subcategories', id, {
      name: editName,
      categoryId: cat.id,
      categoryName: cat.name,
      measureId: msr.id,
      measureControl: msr.measureControl,
      measureUnit: msr.measureUnit
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Cadastro e Gestão</h2>

      <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
        {(['categories', 'subcategories', 'products'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditingId(null); }}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {activeTab === 'subcategories' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddSubcategory} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="md:col-span-3 font-semibold text-gray-700 text-sm">Novo Item (Ex: Arroz, Feijão, Sabão)</div>
              <input className="border p-2 rounded-lg" placeholder="Nome do Item" value={newSubName} onChange={e => setNewSubName(e.target.value)} required />
              <select className="border p-2 rounded-lg" value={newSubCatId} onChange={e => setNewSubCatId(e.target.value)} required>
                <option value="">Categoria...</option>
                {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="border p-2 rounded-lg" value={newSubMeasureId} onChange={e => setNewSubMeasureId(e.target.value)} required>
                <option value="">Unidade de Medida...</option>
                {sortedMeasures.map(m => <option key={m.id} value={m.id}>{m.measureUnit} ({m.measureControl})</option>)}
              </select>
              <Button type="submit" className="md:col-span-3">Cadastrar Item</Button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-gray-400 text-xs uppercase border-b">
                  <tr><th className="pb-3">Item</th><th className="pb-3">Categoria</th><th className="pb-3">Unidade</th><th className="pb-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {[...subcategories].sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 ${editingId === s.id ? 'bg-blue-50/30' : ''}`}>
                      <td className="py-4 font-medium">
                        {editingId === s.id ? <input className="border p-1 rounded w-full" value={editName} onChange={e => setEditName(e.target.value)} /> : s.name}
                      </td>
                      <td className="py-4 text-sm">
                        {editingId === s.id ? (
                          <select className="border p-1 rounded w-full" value={editCatId} onChange={e => setEditCatId(e.target.value)}>
                            {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        ) : s.categoryName}
                      </td>
                      <td className="py-4 text-sm text-gray-500">{s.measureUnit}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {editingId === s.id ? (
                            <>
                              <button onClick={() => saveEditSubcategory(s.id)} className="text-green-600 p-1"><Check size={18}/></button>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 p-1"><X size={18}/></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditCatId(s.categoryId); setEditMeasureId(s.measureId); }} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={16}/></button>
                              <button onClick={() => initiateDelete('subcategory', s.id, s.name)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <input className="flex-1 border p-2 rounded-lg" placeholder="Nome da Categoria (Ex: Limpeza, Matinais)" value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
              <Button type="submit"><Plus size={18} className="mr-1" /> Criar</Button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCategories.map(c => (
                <div key={c.id} className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${editingId === c.id ? 'bg-blue-50/30 border-blue-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                  {editingId === c.id ? (
                    <input className="flex-1 border p-1 rounded mr-2 focus:ring-1 focus:ring-blue-400 outline-none font-semibold text-gray-700" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                  ) : (
                    <span className="font-semibold text-gray-700">{c.name}</span>
                  )}
                  <div className="flex gap-1">
                    {editingId === c.id ? (
                      <>
                        <button onClick={() => saveEditCategory(c.id)} className="text-green-600 p-1 hover:bg-green-50 rounded transition-colors"><Check size={18}/></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 p-1 hover:bg-gray-100 rounded transition-colors"><X size={18}/></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="text-gray-300 hover:text-blue-600 p-1 transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => initiateDelete('category', c.id, c.name)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
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
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="md:col-span-3 font-semibold text-gray-700 text-sm">Novo Produto (Produto específico)</div>
              <input className="border p-2 rounded-lg" placeholder="Produto (Ex: Camil, Omo, Nestlé)" value={newProdName} onChange={e => setNewProdName(e.target.value)} required />
              <select className="border p-2 rounded-lg" value={newProdSubId} onChange={e => setNewProdSubId(e.target.value)} required>
                <option value="">Vincular ao Item...</option>
                {sortedSubOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.categoryName})</option>)}
              </select>
              <div className="relative flex items-center">
                <input type="number" step="0.01" className={`border p-2 rounded-lg w-full ${selectedSubForNewProduct ? 'pr-12' : ''}`} placeholder="Peso/Qtd Emb." value={newProdQty} onChange={e => setNewProdQty(e.target.value)} required />
                {selectedSubForNewProduct && <span className="absolute right-3 text-xs font-bold text-gray-400 pointer-events-none">{selectedSubForNewProduct.measureUnit}</span>}
              </div>
              <Button type="submit" className="md:col-span-3">Cadastrar Produto</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-gray-400 text-xs uppercase border-b">
                  <tr><th className="pb-3">Produto</th><th className="pb-3">Item</th><th className="pb-3">Emb. Padrão</th><th className="pb-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {[...products].sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-4 font-medium">{p.name}</td>
                      <td className="py-4 text-sm text-gray-500">{p.subcategoryName}</td>
                      <td className="py-4 text-sm font-mono">{p.unitQuantity} {p.measureUnit}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => initiateDelete('product', p.id, p.name)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CUSTOM DELETE MODAL */}
      {deleteRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteRequest.blocked ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                {deleteRequest.blocked ? <ShieldAlert size={32} /> : <AlertCircle size={32} />}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {deleteRequest.blocked ? 'Não é possível excluir' : 'Confirmar Exclusão'}
              </h3>
              
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {deleteRequest.blocked 
                  ? deleteRequest.reason 
                  : <>Tem certeza que deseja excluir <strong>"{deleteRequest.name}"</strong>? Esta ação não pode ser desfeita.</>}
              </p>

              <div className="space-y-3">
                {!deleteRequest.blocked && (
                  <Button fullWidth variant="danger" onClick={confirmDelete} className="py-3 font-bold">Excluir Agora</Button>
                )}
                <button onClick={() => setDeleteRequest(null)} className="w-full py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
                  {deleteRequest.blocked ? 'Entendido' : 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
