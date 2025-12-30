import React, { useEffect, useState } from 'react';
import { subscribeToCollection, processPurchase, updateStock } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory, Product, CartItem } from '../types';
import { Button } from '../components/Button';
import { Trash2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShoppingRun: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const unsubSub = subscribeToCollection('subcategories', user.uid, (data) => {
        const subs = data as Subcategory[];
        setSubcategories(subs);
        
        // Initialize cart with items marked on shopping list
        // Only if cart is empty to avoid overwriting ongoing work
        if (cart.length === 0) {
          const initialCart = subs
            .filter(s => s.isOnShoppingList)
            .map(s => ({
              id: Math.random().toString(36).substr(2, 9),
              subcategoryId: s.id,
              subcategoryName: s.name,
              quantity: s.targetStock - s.currentStock > 0 ? s.targetStock - s.currentStock : 1, // Default to diff
              unitPrice: 0,
              unit: s.unit
            }));
          setCart(initialCart);
        }
      });
      const unsubProd = subscribeToCollection('products', user.uid, (data) => setProducts(data as Product[]));
      return () => {
        unsubSub();
        unsubProd();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    setTotal(newTotal);
  }, [cart]);

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // If product changed, update price if available
      if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.productName = product.name;
          if (product.lastPrice) updated.unitPrice = product.lastPrice;
        }
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleFinish = async () => {
    if (cart.length === 0) return;
    if (!window.confirm(`Finalizar compra? Total: R$ ${total.toFixed(2)}`)) return;

    // 1. Update stocks in Firestore
    for (const item of cart) {
      const sub = subcategories.find(s => s.id === item.subcategoryId);
      if (sub) {
        // Calculate new stock
        const newStock = sub.currentStock + Number(item.quantity);
        await updateStock(sub.id, newStock);
      }
    }

    // 2. Process Purchase (remove from list, update last price)
    await processPurchase(cart);
    
    alert('Estoque atualizado com sucesso!');
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center sticky top-0 bg-gray-50 py-4 z-10 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Carrinho</h2>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Estimado</div>
          <div className="text-2xl font-bold text-blue-600">R$ {total.toFixed(2)}</div>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Nenhum item no carrinho. Adicione itens na Lista de Compras.
        </div>
      ) : (
        <div className="space-y-4">
          {cart.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800">{item.subcategoryName}</h3>
                <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Produto (Marca/Tipo)</label>
                  <select
                    className="w-full text-sm border-gray-300 rounded-lg p-2 bg-gray-50"
                    value={item.productId || ''}
                    onChange={(e) => updateCartItem(item.id, 'productId', e.target.value)}
                  >
                    <option value="">Genérico / Outro</option>
                    {products
                      .filter(p => p.subcategoryId === item.subcategoryId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qtd ({item.unit})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full text-sm border-gray-300 rounded-lg p-2 border"
                      value={item.quantity}
                      onChange={(e) => updateCartItem(item.id, 'quantity', parseFloat(e.target.value))}
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full text-sm border-gray-300 rounded-lg p-2 border"
                      value={item.unitPrice}
                      onChange={(e) => updateCartItem(item.id, 'unitPrice', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 text-right text-sm font-medium text-gray-600">
                Subtotal: R$ {(item.quantity * item.unitPrice).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button for Finish */}
      <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-64">
        <Button 
          fullWidth 
          onClick={handleFinish} 
          disabled={cart.length === 0}
          className="shadow-lg flex items-center justify-center py-4"
        >
          <Save size={20} className="mr-2" />
          Finalizar Compra
        </Button>
      </div>
    </div>
  );
};

export default ShoppingRun;