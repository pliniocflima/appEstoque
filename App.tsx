
import React, { useEffect, useState, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/firebase';
import { getOrCreateProfile } from './services/db';
import { UserProfile } from './types';
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

// Contexto para householdId
interface AppContextType {
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
}
const AppContext = createContext<AppContextType>({ profile: null, refreshProfile: async () => {} });
export const useApp = () => useContext(AppContext);

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <Loading />;

  return (
    <AppContext.Provider value={{ profile, refreshProfile }}>
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
    </AppContext.Provider>
  );
};

export default App;
