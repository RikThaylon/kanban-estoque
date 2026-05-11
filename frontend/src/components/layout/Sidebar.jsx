import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, BarChart2, AlertTriangle, ArrowLeftRight, Users, GitBranch, X, Cog, Truck } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const { user } = useAuthStore();

  const menuItems = [
    { path: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',          roles: ['*'] },
    { path: '/produtos',      icon: Package,         label: 'Produtos',           roles: ['*'] },
    { path: '/movimentacoes', icon: ArrowLeftRight,  label: 'Movimentações',      roles: ['*'] },
    { path: '/pedidos',       icon: ShoppingCart,    label: 'Pedidos de Compra',  roles: ['*'] },
    { path: '/fornecedores',  icon: Truck,           label: 'Fornecedores',       roles: ['admin'] },
    { path: '/maquinas',      icon: Cog,             label: 'Máquinas',           roles: ['*'] },
    { path: '/alertas',       icon: AlertTriangle,   label: 'Alertas',            roles: ['*'] },
    { path: '/raci',          icon: GitBranch,       label: 'Matriz RACI',        roles: ['*'] },
    { path: '/relatorios',    icon: BarChart2,       label: 'Relatórios',         roles: ['admin', 'gerente_operacoes', 'gerente_engenharia', 'plant_manager', 'comprador'] },
    { path: '/usuarios',      icon: Users,           label: 'Usuários',           roles: ['admin', 'plant_manager', 'gerente_engenharia', 'eng_processos', 'eng_producao', 'gerente_operacoes'] },
  ];

  const filteredItems = menuItems.filter(item =>
    item.roles.includes('*') || item.roles.includes(user?.perfil) || user?.perfil === 'admin'
  );

  // Estratégia responsiva:
  // - Mobile (<lg): sidebar é drawer; sidebarOpen=true desliza pra dentro, com largura w-64
  // - Desktop (>=lg): sidebar sempre visível; sidebarOpen alterna entre w-64 (full) e w-20 (mini)
  const widthClass = sidebarOpen ? 'w-64' : 'w-20';
  const mobileTranslate = sidebarOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-navy-800 text-white transition-all duration-300 z-20 flex flex-col
        ${widthClass}
        ${mobileTranslate} lg:translate-x-0
      `}
      aria-label="Navegação principal"
    >
      {/* Topo: logo + botão fechar (mobile) */}
      <div className="h-16 flex items-center justify-between border-b border-navy-700 px-4">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 rounded bg-kanban-verde flex items-center justify-center shrink-0 font-bold text-lg">K</div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tight">Kanban Estoque</span>}
        </div>
        {/* Botão fechar (apenas em mobile) */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-navy-300 hover:text-white p-1 rounded"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Itens de menu */}
      <nav className="flex-1 overflow-y-auto py-4 lg:py-6 flex flex-col gap-1.5 px-3">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors overflow-hidden whitespace-nowrap
              ${isActive ? 'bg-navy-600 text-white font-medium' : 'text-navy-200 hover:bg-navy-700 hover:text-white'}
            `}
            title={!sidebarOpen ? item.label : ''}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="p-4 border-t border-navy-700 text-xs text-navy-400">
          Kanban Industrial v1.0
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
