import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart2,
  ChevronRight,
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
  Shield,
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { perfilTemPagina } from '../../utils/permissoes';

/* ─────────────────────────────────────────────────────────────────────
   Menu structure – progressive disclosure via groups
   Each group shows a section header only when sidebar is expanded.
   Items with `exact` use end={true} on NavLink.
───────────────────────────────────────────────────────────────────── */
const MENU_GROUPS = [
  {
    label: 'Operacional',
    items: [
      { key: 'dashboard',     path: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
      { key: 'produtos',      path: '/produtos',       icon: Package,         label: 'Produtos' },
      { key: 'movimentacoes', path: '/movimentacoes',  icon: ArrowLeftRight,  label: 'Movimentações' },
      { key: 'pedidos',       path: '/pedidos',        icon: ShoppingCart,    label: 'Pedidos de Compra' },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { key: 'fornecedores',  path: '/fornecedores',   icon: Truck,           label: 'Fornecedores' },
      { key: 'maquinas',      path: '/maquinas',       icon: Cog,             label: 'Máquinas' },
      { key: 'grafo',         path: '/grafo',           icon: Network,         label: 'Informações' },
    ],
  },
  {
    label: 'Análise',
    items: [
      { key: 'alertas',       path: '/alertas',        icon: AlertTriangle,   label: 'Alertas' },
      { key: 'relatorios',    path: '/relatorios',     icon: BarChart2,       label: 'Relatórios' },
      { key: 'simulacao',     path: '/simulacao',      icon: Activity,        label: 'Monte Carlo' },
      { key: 'raci',          path: '/raci',            icon: GitBranch,       label: 'Matriz RACI' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { key: 'usuarios',      path: '/usuarios',       icon: Users,           label: 'Usuários' },
      { key: 'configuracoes', path: '/configuracoes',  icon: Settings,        label: 'Configurações' },
      { key: 'seguranca',     path: '/seguranca',      icon: Shield,          label: 'Segurança' },
    ],
  },
];

/* ── NavItem ──────────────────────────────────────────────────────── */
const NavItem = ({ item, collapsed }) => {
  const Icon = item.icon;
  const location = useLocation();
  const isActive = location.pathname === item.path ||
    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={() =>
        `group relative flex items-center gap-3 rounded-lg transition-all duration-150 select-none
        ${collapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2.5'}
        ${isActive
          ? 'bg-cyan-500/15 text-white font-semibold shadow-[inset_3px_0_0_theme(colors.accent)]'
          : 'text-white/60 hover:bg-white/[0.08] hover:text-white/90'
        }`
      }
    >
      <Icon
        size={18}
        className={`shrink-0 transition-transform duration-200
          ${isActive ? 'text-accent' : 'text-white/50 group-hover:text-white/80'}
          ${collapsed ? '' : ''}`}
        aria-hidden="true"
      />
      {!collapsed && (
        <span className="text-sm leading-none truncate">{item.label}</span>
      )}
      {/* Active indicator dot in collapsed mode */}
      {collapsed && isActive && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-accent" />
      )}
    </NavLink>
  );
};

/* ── Sidebar ──────────────────────────────────────────────────────── */
const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const { user } = useAuthStore();

  const { data: permissoes } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
    staleTime: 5 * 60 * 1000,
  });

  const collapsed = !sidebarOpen;
  const widthClass = collapsed ? 'w-[72px]' : 'w-64';
  const mobileTranslate = sidebarOpen ? 'translate-x-0' : '-translate-x-full';

  const initials = (user?.nome || 'U')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-20 flex flex-col
        text-white overflow-hidden
        transition-[width] duration-300 ease-in-out
        bg-[linear-gradient(168deg,#071525_0%,#0c2340_55%,#071525_100%)]
        border-r border-white/[0.07]
        shadow-[4px_0_32px_rgba(0,10,40,0.35)]
        ${widthClass}
        ${mobileTranslate} lg:translate-x-0
      `}
      aria-label="Navegação principal"
    >
      {/* ── Logo ── */}
      <div className={`h-16 flex items-center border-b border-white/[0.07] shrink-0
        ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}>
        {/* Logo mark */}
        <div className={`
          shrink-0 rounded-lg flex items-center justify-center font-black text-white
          bg-gradient-to-br from-accent to-blue-700
          shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_20px_rgba(0,136,255,0.40)]
          ${collapsed ? 'w-9 h-9 text-base' : 'w-9 h-9 text-base'}
        `}>
          B
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <span className="block font-bold text-[15px] leading-tight tracking-tight text-white">
              Brimajor
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-white/40 leading-tight">
              Kanban Estoque
            </span>
          </div>
        )}

        {/* Close button – mobile only */}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-white/50 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4"
        aria-label="Menu principal">
        {MENU_GROUPS.map(group => {
          const visibleItems = group.items.filter(
            item => perfilTemPagina(permissoes, user?.perfil, item.key)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {/* Group label – hidden when collapsed */}
              {!collapsed && (
                <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30 select-none">
                  {group.label}
                </p>
              )}
              {collapsed && (
                <div className="border-t border-white/[0.06] mx-2 mb-2" />
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavItem key={item.path} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User card ── */}
      <div className={`shrink-0 border-t border-white/[0.07] p-3`}>
        {collapsed ? (
          /* Collapsed: just avatar */
          <div className="flex justify-center">
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm"
              title={user?.nome}
            >
              {initials}
            </div>
          </div>
        ) : (
          /* Expanded: full card */
          <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2.5 border border-white/[0.07]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white/90 truncate leading-tight">
                {user?.nome || 'Operador'}
              </div>
              <div className="text-[10px] text-white/40 capitalize leading-tight mt-0.5">
                {(user?.perfil || 'perfil').replace(/_/g, ' ')}
              </div>
            </div>
            <ChevronRight size={14} className="text-white/20 shrink-0" />
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
