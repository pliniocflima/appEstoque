
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, ShoppingBag, Utensils, Settings, 
  LogOut, Menu, X, Sliders, History, BarChart3, ClipboardCheck, CloudCheck, CloudOff, RefreshCw 
} from 'lucide-react';
import { auth } from '../services/firebase';
import { useData } from '../App';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const { syncing, hasPending } = useData();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  // Lógica de Cores e Rótulos do Status
  let statusColor = 'bg-green-500';
  let statusText = 'Nuvem Atualizada';
  let pulseClass = '';

  if (syncing) {
    statusColor = 'bg-blue-400';
    statusText = 'Sincronizando...';
    pulseClass = 'animate-pulse';
  } else if (hasPending) {
    statusColor = 'bg-gray-400';
    statusText = 'Aguardando Conexão';
    pulseClass = ''; // Estático cinza enquanto aguarda
  }

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lista-de-compras', icon: ShoppingCart, label: 'Lista de Compras' },
    { to: '/compras', icon: ShoppingBag, label: 'Executar Compra' },
    { to: '/consumo', icon: Utensils, label: 'Consumo' },
    { to: '/conferencia', icon: ClipboardCheck, label: 'Conferência' },
    { to: '/historico', icon: History, label: 'Histórico' },
    { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/gestao-itens', icon: Settings, label: 'Gestão de Itens' },
    { to: '/configuracoes', icon: Sliders, label: 'Configurações' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-blue-600">Estoque Casa</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${pulseClass}`}></div>
              <span className={`text-[9px] font-bold uppercase tracking-tighter ${hasPending ? 'text-gray-400' : 'text-gray-400'}`}>
                {statusText}
              </span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-600"><X size={24} /></button>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-120px)]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`
              }
            >
              <item.icon size={18} className="mr-3 shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
          <button onClick={handleLogout} className="flex w-full items-center px-4 py-3 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors mt-4">
            <LogOut size={18} className="mr-3 shrink-0" /> <span className="text-sm">Sair</span>
          </button>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 p-2"><Menu size={24} /></button>
            <span className="ml-2 font-bold text-gray-800">Estoque de Casa</span>
          </div>
          <div className="flex items-center gap-2">
            {hasPending && <RefreshCw size={12} className="text-gray-400 animate-spin" />}
            <div className={`w-2 h-2 rounded-full ${statusColor} ${pulseClass}`}></div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24"><Outlet /></div>
      </main>
    </div>
  );
};

export default Layout;
