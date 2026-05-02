import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, BarChart2, Settings, AlertTriangle, ArrowLeftRight, Users, GitBranch } from 'lucide-react';
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
    { path: '/alertas',       icon: AlertTriangle,   label: 'Alertas',            roles: ['*'] },
    { path: '/raci',          icon: GitBranch,       label: 'Matriz RACI',        roles: ['*'] },
    { path: '/relatorios',    icon: BarChart2,       label: 'Relatórios',         roles: ['admin', 'gerente_operacoes', 'gerente_engenharia', 'plant_manager', 'comprador'] },
    { path: '/usuarios',      icon: Users,           label: 'Usuários',           roles: ['admin', 'plant_manager', 'gerente_engenharia', 'eng_processos', 'eng_producao', 'gerente_operacoes'] },
    { path: '/configuracoes', icon: Settings,        label: 'Configurações',      roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => 
    item.roles.includes('*') || item.roles.includes(user?.perfil) || user?.perfil === 'admin'
  );

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-navy-800 text-white transition-all duration-300 z-20 flex flex-col
        ${sidebarOpen ? 'w-64' : 'w-20'}
      `}
      onMouseEnter={() => !sidebarOpen && setSidebarOpen(true)}
      onMouseLeave={() => sidebarOpen && window.innerWidth > 1024 && setSidebarOpen(false)}
    >
      <div className="h-16 flex items-center justify-center border-b border-navy-700 px-4">
        <div className="flex items-center gap-3 w-full overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 rounded bg-kanban-verde flex items-center justify-center shrink-0 font-bold text-lg">K</div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tight">Kanban Estoque</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors overflow-hidden whitespace-nowrap
              ${isActive ? 'bg-navy-600 text-white font-medium' : 'text-navy-200 hover:bg-navy-700 hover:text-white'}
            `}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>
      
      {sidebarOpen && (
        <div className="p-4 border-t border-navy-700 text-xs text-navy-400">
          Kanban Industrial v1.0
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
