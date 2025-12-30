import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ShoppingBag, Utensils, Settings, LogOut, Menu, X } from 'lucide-react';
import { auth } from '../services/firebase';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lista-de-compras', icon: ShoppingCart, label: 'Lista de Compras' },
    { to: '/compras', icon: ShoppingBag, label: 'Executar Compra' },
    { to: '/consumo', icon: Utensils, label: 'Consumo' },
    { to: '/gestao-itens', icon: Settings, label: 'Gestão de Itens' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-blue-600">Estoque de Casa</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-500">
            <X size={24} />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors mt-8"
          >
            <LogOut size={20} className="mr-3" />
            Sair
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center h-16 px-4 bg-white border-b border-gray-200">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-600 p-2 -ml-2 rounded-md hover:bg-gray-100"
          >
            <Menu size={24} />
          </button>
          <span className="ml-4 font-semibold text-gray-900">Estoque de Casa</span>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;