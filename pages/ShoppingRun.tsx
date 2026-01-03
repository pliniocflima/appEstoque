
import React, { useEffect, useState, useMemo } from 'react';
import { subscribeToCollection, processPurchase, updateCartItem, removeFromCart } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Product, CartItem, Measure, Category } from '../types';
import { Button } from '../components/Button';
import { Trash2, Save, ShoppingBag, Loader2, MapPin, Calendar, CheckCircle2, XCircle, Filter, Search, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';

type CartStatus = 'lançado' | 'pendente' | 'vazio';

const ShoppingRun: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'tudo' | CartStatus>('tudo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const getBrazilNow = () => {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return brazilTime.toISOString().slice(0, 16);
  };

  const [location, setLocation] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getBrazilNow());
  
  const user = auth.currentUser;
  const { profile } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      const unsubSub = subscribeToCollection('subcategories', profile.householdId, (data) => setSubcategories(data as Subcategory[]));
      const unsubCat = subscribeToCollection('categories', profile.householdId, (data) => setCategories(data as Category[]));
      const unsubProd = subscribeToCollection('products', profile.householdId, (data) => setProducts(data as Product[]));
      const unsubMsr = subscribeToCollection('measures', profile.householdId, (data) => setMeasures(data as Measure[]));
      const unsubCart = subscribeToCollection('cart', profile.householdId, (data) => setCart(data as CartItem[]));
      
      return () => { unsubSub(); unsubCat(); unsubProd(); unsubMsr(); unsubCart(); };
    }
  }, [user, profile]);

  const total = cart.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);

  const getItemStatus = (item: CartItem): CartStatus => {
    const hasProduct = !!item.productId;
    const hasQty = Number(item.quantity) > 0;
    const hasPrice = Number(item.unitPrice) > 0;

    if (hasProduct && hasQty && hasPrice) return 'lançado';
    if (!hasProduct && !hasQty && !hasPrice) return 'vazio';
    return 'pendente';
  };

  const allLaunched = cart.length > 0 && cart.every(item => getItemStatus(item) === 'lançado');
  const locationFilled = location.trim().length > 0;
  const canFinish = allLaunched && locationFilled;
  const itemsNotLaunchedCount = cart.filter(item => getItemStatus(item) !== 'lançado').length;

  const filteredCart = useMemo(() => {
    return cart.filter(item => {
      const status = getItemStatus(item);
      const matchesStatus = statusFilter === 'tudo' || statusFilter === status;
      
      const sub = subcategories.find(s => s.id === item.subcategoryId);
      const categoryLabel = sub?.categoryName || 'Outros';
      const matchesCategory = selectedCategory === 'todas' || sub?.categoryId === selectedCategory;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (item.subcategoryName || '').toLowerCase().includes(searchLower) ||
        (item.productName || '').toLowerCase().includes(searchLower) ||
        categoryLabel.toLowerCase().includes(searchLower);

      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [cart, statusFilter, searchTerm, selectedCategory, subcategories]);

  const handleUpdateItem = async (id: string, field: string, value: any) => {
    const currentItem = cart.find(c => c.id === id);
    if (!currentItem) return;

    const data: any = { [field]: value };
    
    if (field === 'quantity') {
      data.quantity = Math.max(0, Number(value) || 0);
    }

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        data.productName = product.name;
        data.unit = product.measureUnit;
        
        if (product.lastPrice && Number(currentItem.unitPrice || 0) === 0) {
          data.unitPrice = product.lastPrice;
        }
      } else {
        const sub = subcategories.find(s => s.id === currentItem.subcategoryId);
        data.unit = sub?.measureUnit || '';
        data.productName = 'Genérico';
        data.productId = '';
      }
    }
    
    await updateCartItem(id, data);
  };

  const calculateSuggestion = (item: CartItem) => {
    const sub = subcategories.find(s => s.id === item.subcategoryId);
    const prod = products.find(p => p.id === item.productId);
    
    if (!sub || !prod || prod.unitQuantity <= 0) return null;
    
    const gap = Math.max(0, (sub.targetStock || 0) - (sub.currentStock || 0));
    if (gap <= 0) return 0;

    return Math.ceil(gap / prod.unitQuantity);
  };

  const executeFinish = async () => {
    if (!user || !profile || !canFinish) return;
    setIsProcessing(true);
    setShowConfirm(false);
    try {
      await processPurchase(
        user.uid, 
        profile.householdId, 
        cart, 
        subcategories, 
        products, 
        measures,
        new Date(purchaseDate),
        location
      );
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Erro ao salvar compra:", err);
      alert(`Erro crítico ao salvar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const StatusIcon = ({ status }: { status: CartStatus }) => {
    switch (status) {
      case 'lançado': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'pendente': return <AlertTriangle className="text-yellow-500" size={18} />;
      case 'vazio': return <XCircle className="text-red-500" size={18} />;
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <h2 className="text-xl font-bold text-gray-700">Registrando no Banco...</h2>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 max-w-sm w-full space-y-6 text-center">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-blue-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Confirmar Compra?</h2>
          <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-400">Total</span>
              <span className="font-bold text-blue-600 text-lg">R$ {total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex flex-col space-y-3 pt-4">
            <Button fullWidth onClick={executeFinish} className="py-4 font-bold text-lg">Confirmar e Finalizar</Button>
            <button onClick={() => setShowConfirm(false)} className="text-gray-400 text-sm font-medium hover:text-gray-600">Voltar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm py-4 z-10 border-b border-gray-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center shrink-0">
              <ShoppingBag className="mr-2 text-blue-600" /> No Mercado
            </h2>
            <div className="hidden md:flex flex-1 items-center gap-2 max-w-2xl">
               <div className="relative flex-1">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Local..."
                  className={`w-full pl-8 pr-2 py-1.5 text-xs bg-white border rounded-lg outline-none focus:ring-1 focus:ring-blue-500 shadow-sm ${!locationFilled ? 'border-orange-300' : 'border-gray-200'}`}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="datetime-local" 
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none text-gray-600 shadow-sm"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Total Atual</div>
            <div className="text-xl font-bold text-blue-600">R$ {total.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:hidden">
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="text" placeholder="Local..." className={`w-full pl-8 pr-2 py-2 text-xs bg-white border rounded-lg outline-none shadow-sm ${!locationFilled ? 'border-orange-300' : 'border-gray-200'}`} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="datetime-local" className="w-full pl-8 pr-2 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none text-gray-600 shadow-sm" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
        </div>

        <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit overflow-x-auto">
          {(['tudo', 'lançado', 'pendente', 'vazio'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'lançado' && <CheckCircle2 size={12} className="text-green-500" />}
              {f === 'pendente' && <AlertTriangle size={12} className="text-yellow-500" />}
              {f === 'vazio' && <XCircle size={12} className="text-red-500" />}
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm appearance-none min-w-[180px] shadow-sm font-medium"
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
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium">
          O carrinho está vazio.
        </div>
      ) : filteredCart.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 text-gray-400 italic">
          Nenhum item corresponde aos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCart.map((item) => {
            const status = getItemStatus(item);
            const suggestion = calculateSuggestion(item);
            const sub = subcategories.find(s => s.id === item.subcategoryId);
            const categoryLabel = sub?.categoryName || 'Outros';

            return (
              <div key={item.id} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${status === 'lançado' ? 'border-green-100 bg-green-50/10' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 text-sm">{item.subcategoryName}</h3>
                        <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          {categoryLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-tight">Marca / Produto</label>
                    <select
                      className={`w-full text-xs rounded-lg p-2 bg-white border outline-none focus:ring-1 focus:ring-blue-400 ${item.productId ? 'border-blue-400 bg-blue-50/20' : 'border-gray-200'}`}
                      value={item.productId || ''}
                      onChange={(e) => handleUpdateItem(item.id, 'productId', e.target.value)}
                    >
                      <option value="">-- Escolha um Produto --</option>
                      {products.filter(p => p.subcategoryId === item.subcategoryId).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unitQuantity}{p.measureUnit})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-tight">Embalagens</label>
                        {suggestion !== null && <span className="text-[8px] text-blue-600 font-bold">Sug: {suggestion}</span>}
                      </div>
                      <input
                        type="number"
                        min="0"
                        className={`w-full text-xs rounded-lg p-2 border outline-none font-bold text-left transition-colors ${Number(item.quantity) > 0 ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="0"
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-tight">Preço Unit. (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full text-xs rounded-lg p-2 border outline-none font-bold text-left transition-colors ${Number(item.unitPrice) > 0 ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 space-y-3">
          {!canFinish && (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom-2">
              <ShieldCheck className="text-orange-600 shrink-0" size={18} />
              <div className="text-[10px] text-orange-800 font-bold leading-tight uppercase">
                {!locationFilled && <p className="mb-1">• O LOCAL DA COMPRA É OBRIGATÓRIO.</p>}
                {!allLaunched && <p>• {itemsNotLaunchedCount} ITEM(NS) PRECISA(M) DE PREENCHIMENTO COMPLETO.</p>}
              </div>
            </div>
          )}
          <Button 
            fullWidth 
            onClick={() => setShowConfirm(true)} 
            disabled={!canFinish}
            className={`shadow-2xl py-4 flex items-center justify-center gap-2 ${canFinish ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300'}`}
          >
            <Save size={20} /> Finalizar Compra
          </Button>
        </div>
      )}
    </div>
  );
};

export default ShoppingRun;
