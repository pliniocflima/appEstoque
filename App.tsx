import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/firebase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ShoppingList from './pages/ShoppingList';
import ShoppingRun from './pages/ShoppingRun';
import Consumption from './pages/Consumption';
import Management from './pages/Management';

// Loading Spinner
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <Loading />;
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes inside Layout */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lista-de-compras" element={<ShoppingList />} />
          <Route path="/compras" element={<ShoppingRun />} />
          <Route path="/consumo" element={<Consumption />} />
          <Route path="/gestao-itens" element={<Management />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;