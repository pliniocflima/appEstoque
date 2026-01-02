
import React, { useEffect, useState } from 'react';
import { subscribeToCollection } from '../services/db';
import { auth } from '../services/firebase';
import { Movement } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { TrendingUp, ShoppingBag, Package, Wallet } from 'lucide-react';
import { useApp } from '../App';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Reports: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const user = auth.currentUser;
  const { profile } = useApp();

  useEffect(() => {
    if (user && profile) {
      // Use householdId to aggregate data for the entire home
      const unsub = subscribeToCollection('movements', profile.householdId, (data) => {
        setMovements(data as Movement[]);
      });
      return () => unsub();
    }
  }, [user, profile]);

  // Processar gastos mensais
  const monthlySpending = movements
    .filter(m => m.origin === 'compra' && m.value)
    .reduce((acc, m) => {
      const date = m.dateTime?.toDate ? m.dateTime.toDate() : new Date(m.dateTime);
      const month = date.toLocaleString('pt-BR', { month: 'short' });
      acc[month] = (acc[month] || 0) + (m.value || 0);
      return acc;
    }, {} as Record<string, number>);

  const spendingData = Object.entries(monthlySpending).map(([month, total]) => ({ month, total }));

  // Processar consumo por categoria
  const categoryConsumption = movements
    .filter(m => m.origin === 'consumo')
    .reduce((acc, m) => {
      const cat = m.categoryName || 'Outros';
      acc[cat] = (acc[cat] || 0) + 1; // Contagem de vezes que consumiu
      return acc;
    }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryConsumption)
    .map(([name, value]) => ({ name, value }))
    // Fix: Explicitly treat value as number for the arithmetic operation in sort
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 5);

  const totalSpent = movements
    .filter(m => m.origin === 'compra')
    .reduce((acc, m) => acc + (m.value || 0), 0);

  const totalMovements = movements.length;

  return (
    <div className="space-y-6 pb-10">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <TrendingUp className="mr-2 text-blue-600" /> Relatórios e Insights
      </h2>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center text-blue-600 mb-2">
            <Wallet size={18} className="mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Gasto Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">R$ {totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center text-green-600 mb-2">
            <ShoppingBag size={18} className="mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Compras</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{movements.filter(m => m.origin === 'compra').length} entradas</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center text-orange-600 mb-2">
            <Package size={18} className="mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Consumos</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{movements.filter(m => m.origin === 'consumo').length} saídas</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Gastos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-6">Investimento Mensal (Compras)</h3>
          <div className="h-64">
            {spendingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                  <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total (R$)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Sem dados de compras para exibir gastos." />
            )}
          </div>
        </div>

        {/* Gráfico de Categorias */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-6">Frequência de Consumo por Categoria</h3>
          <div className="h-64">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Sem dados de consumo registrados." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm italic">
    {message}
  </div>
);

export default Reports;
