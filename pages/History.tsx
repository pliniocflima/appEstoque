
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, deleteMovementWithReversal } from '../services/db';
import { auth } from '../services/firebase';
import { Movement, Category } from '../types';
import { ArrowUpRight, ArrowDownRight, History as HistoryIcon, Search, Trash2, AlertTriangle, X, Filter, Tag } from 'lucide-react';
import { useApp } from '../App';
import { Button } from '../components/Button';

const History: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'todos' | 'entrada' | 'saída' | 'ajuste'>('todos');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Movement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const user = auth.currentUser;
  const { profile } = useApp();

  useEffect(() => {
    if (user && profile) {
      const unsubMov = subscribeToCollection('movements', profile.householdId, (data) => {
        setMovements(data as Movement[]);
      });
      const unsubCat = subscribeToCollection('categories', profile.householdId, (data) => {
        setCategories(data as Category[]);
      });
      return () => { unsubMov(); unsubCat(); };
    }
  }, [user, profile]);

  const sortedMovements = [...movements].sort((a, b) => {
    const timeA = a.dateTime?.seconds || 0;
    const timeB = b.dateTime?.seconds || 0;
    return timeB - timeA;
  });

  const filteredMovements = sortedMovements.filter(m => {
    const matchesFilter = filter === 'todos' || m.type === filter;
    const matchesCategory = selectedCategory === 'todas' || m.categoryId === selectedCategory;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      m.subcategoryName.toLowerCase().includes(searchLower) ||
      (m.productName || '').toLowerCase().includes(searchLower) ||
      (m.categoryName || '').toLowerCase().includes(searchLower);
      
    return matchesFilter && matchesSearch && matchesCategory;
  });

  const formatDate = (ts: any) => {
    if (!ts) return 'Pendente...';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'Data inválida';
    }
  };

  const getMovementStyle = (m: Movement) => {
    const isPositive = m.type === 'ajuste' ? m.quantity > 0 : m.type === 'entrada';
    return {
      isPositive,
      bgColor: isPositive ? 'bg-green-50' : 'bg-red-50',
      textColor: isPositive ? 'text-green-600' : 'text-red-600',
      icon: isPositive ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />
    };
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteMovementWithReversal(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      alert("Erro ao excluir: " + (err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <HistoryIcon className="mr-2 text-blue-600" /> Histórico de Estoque
        </h2>
        
        <div className="flex bg-gray-200/50 p-1 rounded-lg self-start overflow-x-auto max-w-full">
          {(['todos', 'entrada', 'saída', 'ajuste'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'todos' ? 'Tudo' : f}
            </button>
          ))}
        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTRO DE CATEGORIA */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Pesquisar por item, produto ou categoria..."
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
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
          {filteredMovements.map((m) => {
            const style = getMovementStyle(m);

            return (
              <div key={m.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <div className={`p-2 rounded-full mr-4 ${style.bgColor} ${style.textColor} self-start mt-1`}>
                    {style.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-gray-900 truncate">{m.subcategoryName}</h4>
                          <span className="bg-gray-100 text-gray-500 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap">
                            {m.categoryName || 'Outros'}
                          </span>
                        </div>
                        {m.productName && m.productName !== 'Genérico' && (
                          <p className="text-xs text-blue-500 font-medium italic truncate">{m.productName}</p>
                        )}
                      </div>
                      <span className={`text-sm font-mono font-bold whitespace-nowrap ml-4 ${style.textColor}`}>
                        {m.displayQuantity}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mt-2">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                          {m.type === 'ajuste' || m.origin === 'manual' 
                            ? 'Ajuste de Estoque' 
                            : m.origin === 'compra' 
                              ? `Compra em: ${m.location || 'Não informado'}` 
                              : 'Consumo Doméstico'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {formatDate(m.dateTime)}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setPendingDelete(m)} 
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Excluir (Reverte Estoque)"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMovements.length === 0 && (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <HistoryIcon size={40} className="text-gray-100" />
              <p className="italic">
                {searchTerm || selectedCategory !== 'todas' 
                  ? 'Nenhum resultado para os filtros aplicados.' 
                  : 'Nenhuma movimentação registrada.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Movimentação?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Ao excluir, o estoque de <span className="font-bold text-gray-700">"{pendingDelete.subcategoryName}"</span> será 
                <span className="text-red-600 font-bold"> REVERTIDO</span> automaticamente para manter a integridade.
              </p>
              
              <div className="space-y-3">
                <Button 
                  fullWidth 
                  variant="danger" 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="py-3 font-bold"
                >
                  {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                </Button>
                <button 
                  onClick={() => setPendingDelete(null)}
                  disabled={isDeleting}
                  className="w-full py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
            <button 
              onClick={() => setPendingDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
