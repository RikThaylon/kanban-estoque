import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ConsumptionChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-surface-50 rounded-lg border border-dashed border-surface-300">
        <p className="text-navy-400">Sem dados de consumo disponíveis</p>
      </div>
    );
  }

  // Formatar dados para o gráfico
  const formattedData = data.map(d => ({
    name: new Date(d.semana).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    consumo: parseFloat(d.consumo)
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF3" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#7090AC', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#7090AC', fontSize: 12 }}
          />
          <Tooltip 
            cursor={{ fill: '#F4F7FA' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#0F2D4A', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Bar dataKey="consumo" fill="#2E6286" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ConsumptionChart;
