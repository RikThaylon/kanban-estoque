import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ConsumptionChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center industrial-surface rounded-md border border-dashed border-steel-300">
        <p className="text-steel-500 font-bold">Sem dados de consumo disponiveis</p>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    name: new Date(d.semana).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    consumo: parseFloat(d.consumo),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF7" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#3F4959', fontSize: 12, fontWeight: 700 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#3F4959', fontSize: 12, fontWeight: 700 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(0, 136, 255, 0.10)' }}
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(0,68,204,0.18)', boxShadow: '0 18px 42px rgba(0,36,96,0.12)' }}
            labelStyle={{ color: '#000000', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Bar dataKey="consumo" fill="#005DFF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ConsumptionChart;
