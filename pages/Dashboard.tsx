import React, { useEffect, useState } from 'react';
import { subscribeToCollection } from '../services/db';
import { auth } from '../services/firebase';
import { Subcategory } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { ShoppingCart, Utensils, AlertTriangle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const unsub = subscribeToCollection('subcategories', user.uid, (data) => {
        setSubcategories(data as Subcategory[]);
      });
      return () => unsub();
    }
  }, [user]);

  const totalItems = subcategories.length;
  const lowStockItems = subcategories.filter(s => s.currentStock < s.targetStock).length;
  const okStockItems = totalItems - lowStockItems;

  const data = [
    { name: 'Em Estoque', value: okStockItems, color: '#22c55e' },
    { name: 'Baixo Estoque', value: lowStockItems, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Stats Cards */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total de Itens</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{totalItems}</h3>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Utensils className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Precisa Comprar</p>
              <h3 className="text-3xl font-bold text-red-600 mt-2">{lowStockItems}</h3>
            </div>
            <div className="bg-red-50 p-3 rounded-full">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
          <h3 className="text-lg font-semibold mb-4">Saúde do Estoque</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Shortcuts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            <Link 
              to="/lista-de-compras" 
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center">
                <ShoppingCart className="text-blue-600 mr-3" size={20} />
                <span className="font-medium text-gray-700">Ver Lista de Compras</span>
              </div>
              <span className="text-sm text-gray-500">Go &rarr;</span>
            </Link>
            <Link 
              to="/consumo" 
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center">
                <Utensils className="text-orange-600 mr-3" size={20} />
                <span className="font-medium text-gray-700">Registrar Consumo</span>
              </div>
              <span className="text-sm text-gray-500">Go &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;