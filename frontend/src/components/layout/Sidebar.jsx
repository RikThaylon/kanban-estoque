import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart2,
  Cog,
  GitBranch,
  LayoutDashboard,
  Network,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { perfilTemPagina } from '../../utils/permissoes';

const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const { user } = useAuthStore();
  const { data: permissoes } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });

  const menuItems = [
    { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'produtos', path: '/produtos', icon: Package, label: 'Produtos' },
    { key: 'movimentacoes', path: '/movimentacoes', icon: ArrowLeftRight, label: 'Movimentacoes' },
    { key: 'pedidos', path: '/pedidos', icon: ShoppingCart, label: 'Pedidos de Compra' },
    { key: 'grafo', path: '/grafo', icon: Network, label: 'Grafo' },
    { key: 'fornecedores', path: '/fornecedores', icon: Truck, label: 'Fornecedores' },
    { key: 'configuracoes', path: '/configuracoes', icon: Settings, label: 'Configuracoes' },
    { key: 'maquinas', path: '/maquinas', icon: Cog, label: 'Maquinas' },
    { key: 'alertas', path: '/alertas', icon: AlertTriangle, label: 'Alertas' },
    { key: 'raci', path: '/raci', icon: GitBranch, label: 'Matriz RACI' },
    { key: 'relatorios', path: '/relatorios', icon: BarChart2, label: 'Relatorios' },
    { key: 'usuarios', path: '/usuarios', icon: Users, label: 'Usuarios' },
  ];

  const filteredItems = menuItems.filter(item => perfilTemPagina(permissoes, user?.perfil, item.key));

  const widthClass = sidebarOpen ? 'w-64' : 'w-20';
  const mobileTranslate = sidebarOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <aside
      className={`fixed top-0 left-0 h-screen text-white transition-all duration-300 z-20 flex flex-col
        bg-[linear-gradient(180deg,#050505_0%,#161616_54%,#050505_100%)]
        border-r border-white/10 shadow-[18px_0_48px_rgba(5,5,5,0.28)]
        ${widthClass}
        ${mobileTranslate} lg:translate-x-0
      `}
      aria-label="Navegacao principal"
    >
      <div className="h-16 flex items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center shrink-0 font-display font-black text-lg text-white shadow-[0_0_0_1px_rgba(255,255,255,0.20),0_10px_24px_rgba(215,25,32,0.28)]">
            K
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <span className="block font-display font-bold text-lg leading-tight">Kanban Estoque</span>
              <span className="block text-[10px] uppercase text-white/45">Industrial control</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-white/60 hover:text-white p-1 rounded-md hover:bg-white/10"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 lg:py-6 flex flex-col gap-1.5 px-3">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
            className={({ isActive }) => `
              relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-all overflow-hidden whitespace-nowrap
              ${isActive
                ? 'bg-accent/20 text-white font-bold shadow-[inset_3px_0_0_#d71920]'
                : 'text-white/[0.62] hover:bg-white/[0.08] hover:text-white'}
            `}
            title={!sidebarOpen ? item.label : ''}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="m-3 rounded-md border border-white/10 bg-white/[0.06] p-3 text-xs text-white/[0.54]">
          <div className="font-bold text-white/80">Turno conectado</div>
          <div className="mt-1 truncate">{user?.nome || 'Operador'}</div>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/3 bg-accent" />
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
