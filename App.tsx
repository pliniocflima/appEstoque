
import React, { useEffect, useState, createContext, useContext, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/firebase';
import { getOrCreateProfile, subscribeToCollection } from './services/db';
import { UserProfile, Category, Subcategory, Product, Measure, CartItem } from './types';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ShoppingList from './pages/ShoppingList';
import ShoppingRun from './pages/ShoppingRun';
import Consumption from './pages/Consumption';
import Management from './pages/Management';
import Settings from './pages/Settings';
import History from './pages/History';
import Reports from './pages/Reports';
import StockAudit from './pages/StockAudit';

// Contexto Global de Dados
interface DataContextType {
  categories: Category[];
  subcategories: Subcategory[];
  products: Product[];
  measures: Measure[];
  cart: CartItem[];
  loading: boolean;
  syncing: boolean;
  hasPending: boolean;
}

interface AppContextType {
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  data: DataContextType;
}

const DataContext = createContext<DataContextType>({
  categories: [],
  subcategories: [],
  products: [],
  measures: [],
  cart: [],
  loading: true,
  syncing: false,
  hasPending: false
});

const AppContext = createContext<AppContextType>({ 
  profile: null, 
  refreshProfile: async () => {},
  data: { 
    categories: [], subcategories: [], products: [], measures: [], cart: [], 
    loading: true, syncing: false, hasPending: false 
  }
});

export const useApp = () => useContext(AppContext);
export const useData = () => useContext(DataContext);

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-500 font-medium animate-pulse">Sincronizando despensa...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Status State
  const [dataLoading, setDataLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  // Usamos um objeto simples para rastrear pendências por coleção
  const [pendingWrites, setPendingWrites] = useState<Record<string, boolean>>({});

  const refreshProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const p = await getOrCreateProfile(user.uid, user.email);
      setProfile(p);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await refreshProfile();
      } else {
        setProfile(null);
        setDataLoading(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Monitora mudanças no objeto pendingWrites para atualizar o hasPending global
  useEffect(() => {
    const isAnyPending = Object.values(pendingWrites).some(v => v === true);
    setHasPending(isAnyPending);
  }, [pendingWrites]);

  const updatePendingState = (key: string, isPending: boolean) => {
    setPendingWrites(prev => {
      if (prev[key] === isPending) return prev;
      return { ...prev, [key]: isPending };
    });
  };

  // Sincronização Global em Tempo Real
  useEffect(() => {
    if (profile) {
      setSyncing(true);
      const hId = profile.householdId;

      const unsubCat = subscribeToCollection('categories', hId, (d, meta) => {
        setCategories(d as Category[]);
        updatePendingState('categories', meta.hasPendingWrites);
      });

      const unsubSub = subscribeToCollection('subcategories', hId, (d, meta) => {
        setSubcategories(d as Subcategory[]);
        setDataLoading(false);
        setSyncing(false);
        updatePendingState('subcategories', meta.hasPendingWrites);
      });

      const unsubProd = subscribeToCollection('products', hId, (d, meta) => {
        setProducts(d as Product[]);
        updatePendingState('products', meta.hasPendingWrites);
      });

      const unsubMsr = subscribeToCollection('measures', hId, (d, meta) => {
        setMeasures(d as Measure[]);
        updatePendingState('measures', meta.hasPendingWrites);
      });

      const unsubCart = subscribeToCollection('cart', hId, (d, meta) => {
        setCart(d as CartItem[]);
        updatePendingState('cart', meta.hasPendingWrites);
      });

      const unsubMov = subscribeToCollection('movements', hId, (d, meta) => {
        updatePendingState('movements', meta.hasPendingWrites);
      });

      return () => {
        unsubCat();
        unsubSub();
        unsubProd();
        unsubMsr();
        unsubCart();
        unsubMov();
      };
    }
  }, [profile]);

  const dataValue = useMemo(() => ({
    categories,
    subcategories,
    products,
    measures,
    cart,
    loading: dataLoading,
    syncing,
    hasPending
  }), [categories, subcategories, products, measures, cart, dataLoading, syncing, hasPending]);

  if (authLoading) return <Loading />;

  return (
    <AppContext.Provider value={{ profile, refreshProfile, data: dataValue }}>
      <DataContext.Provider value={dataValue}>
        <HashRouter>
          <Routes>
            <Route path="/" element={profile ? <Navigate to="/dashboard" /> : <Login />} />
            <Route element={profile ? <Layout /> : <Navigate to="/" />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/lista-de-compras" element={<ShoppingList />} />
              <Route path="/compras" element={<ShoppingRun />} />
              <Route path="/consumo" element={<Consumption />} />
              <Route path="/conferencia" element={<StockAudit />} />
              <Route path="/historico" element={<History />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/gestao-itens" element={<Management />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataContext.Provider>
    </AppContext.Provider>
  );
};

export default App;
