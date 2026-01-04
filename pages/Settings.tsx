
import React, { useEffect, useState, useMemo } from 'react';
import { subscribeToCollection, addMeasure, deleteItem, updateItem, updateHousehold } from '../services/db';
import { useApp } from '../App';
import { Measure, Subcategory, Category } from '../types';
import { Button } from '../components/Button';
import { Trash2, Ruler, Edit2, Check, X, ShieldAlert, Target, Users, Copy, Share2, Home, Plus, AlertTriangle, CheckCircle2, Search, Filter } from 'lucide-react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'measures' | 'stock' | 'household'>('measures');
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { profile, refreshProfile } = useApp();

  // Search & Filter for Stock
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');

  // Form State
  const [ctrl, setCtrl] = useState('Peso');
  const [unit, setUnit] = useState('');
  const [mult, setMult] = useState('1');
  const [houseCode, setHouseCode] = useState('');

  // UI Modals / Alerts
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [measureToDelete, setMeasureToDelete] = useState<Measure | null>(null);

  useEffect(() => {
    if (profile) {
      const uM = subscribeToCollection('measures', profile.householdId, (d) => setMeasures(d));
      const uS = subscribeToCollection('subcategories', profile.householdId, (d) => setSubcategories(d as Subcategory[]));
      const uC = subscribeToCollection('categories', profile.householdId, (d) => setCategories(d as Category[]));
      return () => { uM(); uS(); uC(); };
    }
  }, [profile]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleJoinHouse = async () => {
    if (!profile || !houseCode) return;
    await updateHousehold(profile.uid, houseCode);
    await refreshProfile();
    setToast({ message: "Sucesso! Você agora compartilha o estoque desta casa.", type: 'success' });
    setHouseCode('');
    setShowJoinConfirm(false);
  };

  const copyCode = () => {
    if (profile) {
      navigator.clipboard.writeText(profile.householdId);
      setToast({ message: "Código copiado com sucesso!", type: 'success' });
    }
  };

  const handleDeleteMeasure = async () => {
    if (measureToDelete) {
      await deleteItem('measures', measureToDelete.id);
      setMeasureToDelete(null);
    }
  };

  const filteredStock = useMemo(() => {
    return subcategories
      .filter(s => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = s.name.toLowerCase().includes(searchLower) || (s.categoryName || '').toLowerCase().includes(searchLower);
        const matchesCategory = selectedCategory === 'todas' || s.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        // Regra: Categoria > Nome do Item
        const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '');
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name);
      });
  }, [subcategories, searchTerm, selectedCategory]);

  const sortedCategoriesDropdown = useMemo(() => {
    // Regra: Ordem Alfabética
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const sortedMeasuresList = useMemo(() => {
    return [...measures].sort((a, b) => {
      // Regra: Controle > Multiplicador
      const ctrlCompare = (a.measureControl || '').localeCompare(b.measureControl || '');
      if (ctrlCompare !== 0) return ctrlCompare;
      return (Number(a.measureMultiplier) || 0) - (Number(b.measureMultiplier) || 0);
    });
  }, [measures]);

  return (
    <div className="space-y-6 pb-10">
      <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>

      {toast && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-lg border flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit overflow-x-auto">
        {(['measures', 'stock', 'household'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchTerm(''); setSelectedCategory('todas'); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-xs whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'measures' && <Ruler size={16} />}
            {tab === 'stock' && <Target size={16} />}
            {tab === 'household' && <Home size={16} />}
            {tab === 'measures' ? 'Medidas' : tab === 'stock' ? 'Estoque Alvo' : 'Gestão da Casa'}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        {activeTab === 'household' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-purple-50 p-4 rounded-lg flex items-start">
              <Users className="text-purple-600 mr-3 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-purple-900">Compartilhamento Familiar</h3>
                <p className="text-sm text-purple-700">Use o código abaixo em outros celulares para sincronizar o estoque em tempo real.</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Seu Código da Casa</label>
              <div className="flex items-center justify-center mt-2 space-x-2">
                <code className="text-xl font-mono font-bold text-gray-800 bg-white px-4 py-2 rounded-lg border">{profile?.householdId}</code>
                <button onClick={copyCode} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm" title="Copiar código">
                  <Copy size={20}/>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700">Entrar em uma Casa Existente</label>
              <div className="flex gap-2">
                <input 
                  className="flex-1 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 border-gray-200 outline-none" 
                  placeholder="Insira o código da família..." 
                  value={houseCode}
                  onChange={e => setHouseCode(e.target.value)}
                />
                <Button onClick={() => setShowJoinConfirm(true)} variant="secondary" disabled={!houseCode}>Conectar</Button>
              </div>
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                <ShieldAlert className="text-red-500" size={16} />
                <p className="text-[10px] text-red-600 font-medium">Cuidado: Seus itens atuais não serão migrados. Você passará a ver apenas os itens do novo código.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'measures' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (profile) await addMeasure(profile.uid, profile.householdId, { measureControl: ctrl, measureUnit: unit, measureMultiplier: Number(mult) });
              setUnit(''); setMult('1');
              setToast({ message: "Medida adicionada com sucesso!", type: 'success' });
            }} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="md:col-span-4 font-semibold text-gray-700 text-sm mb-1">Nova Unidade de Medida</div>
              <select className="border p-2 rounded-lg bg-white outline-none" value={ctrl} onChange={e => setCtrl(e.target.value)}>
                <option>Peso</option><option>Volume</option><option>Quantidade</option>
              </select>
              <input className="border p-2 rounded-lg bg-white outline-none" placeholder="Símbolo (Ex: kg, L, un)" value={unit} onChange={e => setUnit(e.target.value)} required />
              <input type="number" step="0.001" className="border p-2 rounded-lg bg-white outline-none" placeholder="Multiplicador" value={mult} onChange={e => setMult(e.target.value)} required />
              <Button type="submit"><Plus size={18} className="mr-1" /> Adicionar</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 uppercase text-[10px] font-bold tracking-wider border-b">
                  <tr>
                    <th className="pb-3 px-2">Medida</th>
                    <th className="pb-3 px-2">Multiplicador</th>
                    <th className="pb-3 px-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedMeasuresList.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-2 font-bold text-gray-700">
                        {m.measureUnit} <span className="font-normal text-[10px] text-gray-400 uppercase ml-2">({m.measureControl})</span>
                      </td>
                      <td className="py-4 px-2 font-mono text-gray-500">{m.measureMultiplier}</td>
                      <td className="py-4 px-2 text-right">
                        <button onClick={() => setMeasureToDelete(m)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Barra de Pesquisa e Filtro */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Pesquisar item para configurar..."
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16}/></button>}
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <select 
                  className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none text-sm font-medium min-w-[160px]"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="todas">Todas Categorias</option>
                  {sortedCategoriesDropdown.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredStock.map(s => (
                <div key={s.id} className="p-4 border rounded-xl hover:bg-gray-50 transition-colors shadow-sm bg-white group">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{s.name}</h4>
                    <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">{s.categoryName}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-tight">Estoque Mínimo</label>
                      <div className="flex items-center">
                        <input 
                          type="number" step="0.1"
                          className="w-full border border-gray-200 rounded-l-lg p-2 text-center font-bold text-sm bg-white focus:ring-1 focus:ring-red-400 outline-none" 
                          defaultValue={s.minimumStock}
                          onBlur={async (e) => await updateItem('subcategories', s.id, { minimumStock: Number(e.target.value) })}
                        />
                        <span className="bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg px-2 py-2 text-[9px] font-bold text-gray-400 outline-none">{s.measureUnit}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-tight">Estoque Alvo</label>
                      <div className="flex items-center">
                        <input 
                          type="number" step="0.1"
                          className="w-full border border-gray-200 rounded-l-lg p-2 text-center font-bold text-blue-600 text-sm bg-white focus:ring-1 focus:ring-blue-400 outline-none" 
                          defaultValue={s.targetStock}
                          onBlur={async (e) => await updateItem('subcategories', s.id, { targetStock: Number(e.target.value) })}
                        />
                        <span className="bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg px-2 py-2 text-[9px] font-bold text-gray-400 outline-none">{s.measureUnit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredStock.length === 0 && (
              <div className="text-center py-10 text-gray-400 italic text-sm">Nenhum item encontrado.</div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showJoinConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-200">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Home size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Conectar a nova casa?</h3>
            <p className="text-sm text-gray-500 mb-6">Sua conexão atual será perdida. Você passará a ver o estoque de <strong>{houseCode}</strong>.</p>
            <div className="space-y-3">
              <Button fullWidth onClick={handleJoinHouse}>Sim, conectar agora</Button>
              <button onClick={() => setShowJoinConfirm(false)} className="w-full py-2 text-sm font-medium text-gray-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {measureToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Medida?</h3>
            <p className="text-sm text-gray-500 mb-6">Deseja excluir a unidade de medida <strong>"{measureToDelete.measureUnit}"</strong>?</p>
            <div className="space-y-3">
              <Button fullWidth variant="danger" onClick={handleDeleteMeasure}>Confirmar Exclusão</Button>
              <button onClick={() => setMeasureToDelete(null)} className="w-full py-2 text-sm font-medium text-gray-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
