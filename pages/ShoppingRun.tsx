
import React, { useEffect, useState } from 'react';
import { subscribeToCollection, processPurchase, updateCartItem, removeFromCart } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Product, CartItem, Measure } from '../types';
import { Button } from '../components/Button';
import { Trash2, Save, ShoppingBag, Loader2, Info, MapPin, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';

const ShoppingRun: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Função para pegar a data atual no fuso -3 (Brasília) formatada para datetime-local
  const getBrazilNow = () => {
    const now = new Date();
    // Ajusta para UTC-3 (subtrai 3 horas)
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
      const unsubProd = subscribeToCollection('products', profile.householdId, (data) => setProducts(data as Product[]));
      const unsubMsr = subscribeToCollection('measures', profile.householdId, (data) => setMeasures(data as Measure[]));
      const unsubCart = subscribeToCollection('cart', profile.householdId, (data) => setCart(data as CartItem[]));
      
      return () => { unsubSub(); unsubProd(); unsubMsr(); unsubCart(); };
    }
  }, [user, profile]);

  const total = cart.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);

  const handleUpdateItem = async (id: string, field: string, value: any) => {
    const data: any = { [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        data.productName = product.name;
        data.unit = product.measureUnit;
        if (product.lastPrice) data.unitPrice = product.lastPrice;
      } else {
        const cartItem = cart.find(c => c.id === id);
        const sub = subcategories.find(s => s.id === cartItem?.subcategoryId);
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
    if (!user || !profile) return;
    
    setIsProcessing(true);
    setShowConfirm(false);
    try {
      console.log("Processando compra. Data:", purchaseDate, "Local:", location);
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
      console.log("Compra salva com sucesso.");
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Erro ao salvar compra:", err);
      alert(`Erro crítico ao salvar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <h2 className="text-xl font-bold text-gray-700">Registrando no Banco...</h2>
        <p className="text-gray-500 text-sm italic text-center px-6">Estamos atualizando seu estoque e criando o histórico. Não feche a janela.</p>
      </div>
    );
  }

  // Tela de Confirmação Customizada (Substitui window.confirm)
  if (showConfirm) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 max-w-sm w-full space-y-6 text-center">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-blue-600" size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Confirmar Compra?</h2>
            <p className="text-gray-500 text-sm mt-2">Confira o resumo antes de salvar no histórico.</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-400">Estabelecimento:</span>
              <span className="font-bold text-gray-700">{location || 'Não informado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Itens:</span>
              <span className="font-bold text-gray-700">{cart.length}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-700 font-bold uppercase text-xs">Total</span>
              <span className="font-bold text-blue-600 text-lg">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col space-y-3 pt-4">
            <Button fullWidth onClick={executeFinish} className="py-4 font-bold text-lg">
              Confirmar e Finalizar
            </Button>
            <button 
              onClick={() => setShowConfirm(false)}
              className="text-gray-400 text-sm font-medium hover:text-gray-600 flex items-center justify-center"
            >
              <XCircle size={16} className="mr-1" /> Voltar e Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 bg-gray-50 py-4 z-10 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <ShoppingBag className="mr-2 text-blue-600" /> No Mercado
            </h2>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 font-bold uppercase tracking-tighter">Total Carrinho</div>
            <div className="text-2xl font-bold text-blue-600">R$ {total.toFixed(2)}</div>
          </div>
        </div>

        {/* Inputs de Cabeçalho da Compra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Estabelecimento (ex: Carrefour, Padaria)"
              className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 rounded-lg bg-gray-50"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="datetime-local" 
              className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 rounded-lg bg-gray-50 text-gray-600"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-medium">O carrinho está vazio.</p>
          <p className="text-sm text-gray-300">Vá para 'Lista de Compras' para adicionar itens aqui.</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/lista-de-compras')}>
            Ver Lista
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {cart.map((item) => {
            const suggestion = calculateSuggestion(item);
            return (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{item.subcategoryName}</h3>
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Item de Estoque</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Produto / Marca</label>
                    <select
                      className="w-full text-sm border-gray-200 rounded-lg p-2 bg-gray-50 border focus:ring-2 focus:ring-blue-500"
                      value={item.productId || ''}
                      onChange={(e) => handleUpdateItem(item.id, 'productId', e.target.value)}
                    >
                      <option value="">-- Genérico --</option>
                      {products
                        .filter(p => p.subcategoryId === item.subcategoryId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unitQuantity}{p.measureUnit})</option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Quantas Emb.</label>
                        {suggestion !== null && (
                          <span className="text-[9px] text-blue-600 font-bold flex items-center">
                             Sugestão: {suggestion}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step="1"
                        placeholder="0"
                        className="w-full text-sm border-gray-200 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 font-bold"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Preço Unitário (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full text-sm border-gray-200 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500"
                        value={item.unitPrice}
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
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80">
          <Button fullWidth onClick={() => setShowConfirm(true)} className="shadow-2xl py-4 bg-blue-600 hover:bg-blue-700">
            <Save size={20} className="mr-2" /> Finalizar Compra
          </Button>
        </div>
      )}
    </div>
  );
};

export default ShoppingRun;
