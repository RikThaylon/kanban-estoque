import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Activity, AlertTriangle, Box, CheckCircle, Clock, Database, Server, Settings, TrendingUp, Users, Factory, MapPin, Search, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { useSapMode } from '../hooks/useSapMode';

// --- MOCK PROVIDER DATA ---
const mockData = {
  company: 'Global Industries Corp',
  plants: 3,
  warehouses: 12,
  products: 18452,
  todayMovements: 326,
  openOrders: 18,
  pendingReceipts: 7,
  kpis: [
    { title: 'Inventory Value', value: '$14.2M', trend: '+2.4%' },
    { title: 'Inventory Accuracy', value: '99.8%', trend: '+0.1%' },
    { title: 'Coverage Days', value: '14.2', trend: '-1.1' },
    { title: 'Turnover Ratio', value: '8.4', trend: '+0.3' },
    { title: 'ABC A Items', value: '1,240', trend: 'Stable' },
    { title: 'Stockouts', value: '3', trend: '-2' },
    { title: 'Health Score', value: '94/100', trend: '+1' },
    { title: 'Lead Time (Avg)', value: '12d', trend: '-1d' }
  ],
  inventoryEvolution: [
    { name: 'Jan', value: 12.1 }, { name: 'Feb', value: 12.4 }, { name: 'Mar', value: 12.8 },
    { name: 'Apr', value: 13.5 }, { name: 'May', value: 13.9 }, { name: 'Jun', value: 14.2 }
  ],
  abcCurve: [
    { name: 'A (70%)', value: 1240 }, { name: 'B (20%)', value: 3800 }, { name: 'C (10%)', value: 13412 }
  ],
  alerts: [
    { id: 1, type: 'critical', msg: 'Material M-400 (Bearings) below minimum safety stock.', time: '10m ago' },
    { id: 2, type: 'warning', msg: 'Supplier "TechCorp" delayed delivery by 2 days.', time: '1h ago' },
    { id: 3, type: 'info', msg: 'Purchase recommendation: 500 units of M-102 (Screws).', time: '2h ago' },
    { id: 4, type: 'critical', msg: 'Production Risk: Assembly Line 3 missing components.', time: '3h ago' }
  ],
  topConsumers: [
    { name: 'Assembly Line 1', val: 4500 }, { name: 'Machining', val: 3200 }, { name: 'Packaging', val: 1800 }
  ],
  syncLogs: [
    { id: 104, status: 'SUCCESS', records: 1420, duration: 1.2, time: '14:30:00' },
    { id: 103, status: 'SUCCESS', records: 890, duration: 0.8, time: '14:15:00' },
    { id: 102, status: 'WARNING', records: 120, duration: 2.1, time: '14:00:00' }
  ],
  pcp: {
    goal: 500, material: 'Motor Block V8', required: 500, current: 320, missing: 180, recommended: 200
  },
  bom: [
    { id: 'M-100', name: 'Engine V8', level: 0, status: 'ok' },
    { id: 'M-101', name: 'Cylinder Head', level: 1, status: 'ok' },
    { id: 'M-102', name: 'Valves', level: 2, status: 'critical' }, // Missing
    { id: 'M-103', name: 'Pistons', level: 1, status: 'ok' },
  ]
};

const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6'];

export default function SapIntegration() {
  const isSapModeFront = useSapMode();

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 bg-[#0f172a] text-slate-200 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Server className="text-blue-500" size={28} />
            Operational Intelligence Platform
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">DEMO ENVIRONMENT</span>
            Simulated SAP S/4HANA Connection for {mockData.company}
          </p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <Activity className="text-emerald-500" size={18} />
            <span className="text-sm font-semibold">Worker Running</span>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>Last Sync: <strong className="text-slate-200">14:37 (1.4s)</strong></p>
            <p>Provider: <strong className="text-slate-200">MockProvider</strong></p>
          </div>
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card title="Plants" val={mockData.plants} icon={Factory} />
        <Card title="Warehouses" val={mockData.warehouses} icon={MapPin} />
        <Card title="Products" val={mockData.products.toLocaleString()} icon={Box} />
        <Card title="Movements" val={mockData.todayMovements} icon={ArrowRight} />
        <Card title="Open POs" val={mockData.openOrders} icon={Clock} />
        <Card title="Receipts" val={mockData.pendingReceipts} icon={CheckCircle} />
      </div>

      {/* EXECUTIVE KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mockData.kpis.map((kpi, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between hover:bg-slate-800 transition">
            <span className="text-slate-400 text-sm font-medium">{kpi.title}</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-2xl font-bold text-white">{kpi.value}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${kpi.trend.startsWith('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {kpi.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Inventory Evolution (Millions $)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockData.inventoryEvolution}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#colorVal)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ABC Classification">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mockData.abcCurve} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {mockData.abcCurve.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs mt-2 text-slate-400">
            <span><span className="text-[#0ea5e9]">●</span> A: 70%</span>
            <span><span className="text-[#3b82f6]">●</span> B: 20%</span>
            <span><span className="text-[#6366f1]">●</span> C: 10%</span>
          </div>
        </ChartCard>

        <ChartCard title="Top Consumption Points">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockData.topConsumers} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
              <Bar dataKey="val" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* BOTTOM SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ALERTS & PCP */}
        <div className="lg:col-span-1 space-y-6">
          <SectionBox title="Live Operational Alerts" icon={ShieldAlert}>
            <div className="space-y-3">
              {mockData.alerts.map(a => (
                <div key={a.id} className={`p-3 rounded-lg border flex items-start gap-3 ${a.type === 'critical' ? 'bg-red-900/20 border-red-500/30' : a.type === 'warning' ? 'bg-amber-900/20 border-amber-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                  <AlertTriangle className={`mt-0.5 ${a.type === 'critical' ? 'text-red-400' : a.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`} size={16} />
                  <div>
                    <p className="text-sm font-medium text-slate-200 leading-tight">{a.msg}</p>
                    <span className="text-xs text-slate-500">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionBox>
        </div>

        {/* BOM & GRAPH */}
        <div className="lg:col-span-1 space-y-6">
          <SectionBox title="PCP & Purchase Recommendation" icon={Cpu}>
            <div className="bg-slate-800/80 p-4 rounded border border-slate-700">
              <h4 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Production Goal: {mockData.pcp.goal}x {mockData.pcp.material}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><span className="text-slate-500 block">Required</span><strong className="text-white text-lg">{mockData.pcp.required}</strong></div>
                <div><span className="text-slate-500 block">Current Stock</span><strong className="text-blue-400 text-lg">{mockData.pcp.current}</strong></div>
                <div><span className="text-slate-500 block">Missing Qty</span><strong className="text-red-400 text-lg">{mockData.pcp.missing}</strong></div>
                <div><span className="text-slate-500 block">Recommendation</span><strong className="text-emerald-400 text-lg">Buy {mockData.pcp.recommended}</strong></div>
              </div>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded transition text-sm">
                Generate Purchase Order
              </button>
            </div>
          </SectionBox>

          <SectionBox title="Material BOM Graph" icon={NetworkIcon}>
            <div className="p-4 bg-slate-900 rounded border border-slate-700/50">
              {mockData.bom.map((node, i) => (
                <div key={node.id} className="flex items-center gap-2 mb-2" style={{ marginLeft: `${node.level * 20}px` }}>
                  <div className={`w-2 h-2 rounded-full ${node.status === 'critical' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className={`text-sm ${node.status === 'critical' ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                    {node.id} - {node.name}
                  </span>
                  {node.status === 'critical' && <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 rounded ml-auto border border-red-500/30">STOCKOUT RISK</span>}
                </div>
              ))}
            </div>
          </SectionBox>
        </div>

        {/* SYNC MONITOR */}
        <div className="lg:col-span-1">
          <SectionBox title="Sync Monitor & Queue" icon={Database}>
            <div className="overflow-hidden rounded border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Records</th>
                    <th className="px-3 py-2">ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {mockData.syncLogs.map(l => (
                    <tr key={l.id} className="bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-300">{l.time}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${l.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{l.records}</td>
                      <td className="px-3 py-2 text-slate-500">{l.duration}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-slate-800/50 rounded border border-slate-700 flex justify-between items-center text-sm">
              <span className="text-slate-400">Next Execution:</span>
              <span className="text-white font-medium">14:45:00</span>
            </div>
          </SectionBox>
        </div>
      </div>
    </div>
  );
}

function Card({ title, val, icon: Icon }) {
  return (
    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center">
      <Icon className="text-blue-500 mb-2 opacity-80" size={24} />
      <span className="text-2xl font-black text-white">{val}</span>
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{title}</span>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 shadow-lg">
      <h3 className="text-sm font-bold text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SectionBox({ title, icon: Icon, children }) {
  return (
    <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="text-slate-400" size={18} />
        <h3 className="font-bold text-white text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function NetworkIcon(props) {
  return <Activity {...props} />; // Placeholder
}
