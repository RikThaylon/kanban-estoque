import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Radio, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const TITLES = {
  dashboard: ['Centro de comando', 'Visão operacional do estoque Kanban'],
  produtos: ['Catálogo técnico', 'Itens, parâmetros e curvas de consumo'],
  movimentacoes: ['Movimentações', 'Entradas, saídas e ajustes de estoque'],
  pedidos: ['Compras e aprovação', 'Solicitações, status e recebimentos'],
  grafo: ['Informações', 'Peças, máquinas, compras e responsáveis'],
  maquinas: ['Máquinas e departamentos', 'Vínculos produtivos e responsáveis'],
  alertas: ['Alertas', 'Riscos e pendências do sistema'],
  relatorios: ['Relatórios', 'Análise gerencial e exportações'],
  usuarios: ['Usuários', 'Perfis e acessos'],
  fornecedores: ['Fornecedores', 'Base de compra e lead times'],
  configuracoes: ['Configurações', 'Regras administrativas do fluxo'],
  raci: ['Matriz RACI', 'Responsabilidades do processo'],
};

const Header = () => {
  const { toggleSidebar, alertsUnread } = useUiStore();
  const { user, isSocketConnected } = useAuthStore();
  const { logout } = useAuth();
  const location = useLocation();

  const [title, subtitle] = useMemo(() => {
    const key = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
    return TITLES[key] || ['Kanban Estoque', 'Operação industrial'];
  }, [location.pathname]);

  const { data: notificacoes } = useQuery({
    queryKey: ['notificacoes', user?.perfil],
    queryFn: async () => {
      const [movs, n1, n2, n3] = await Promise.all([
        api.get('/movimentacoes/pendentes').then((res) => Array.isArray(res.data) ? res.data.length : 0).catch(() => 0),
        api.get('/pedidos', { params: { status: 'AGUARDANDO_APROVACAO', limit: 1 } }).then((res) => res.data?.total || 0).catch(() => 0),
        api.get('/pedidos', { params: { status: 'AGUARDANDO_GERENTE', limit: 1 } }).then((res) => res.data?.total || 0).catch(() => 0),
        api.get('/pedidos', { params: { status: 'APROVADO', limit: 1 } }).then((res) => res.data?.total || 0).catch(() => 0),
      ]);
      return movs + n1 + n2 + n3;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const badgeTotal = alertsUnread + (notificacoes || 0);

  return (
    <header className="sticky top-0 z-10 border-b border-primary/15 bg-white/85 backdrop-blur-xl px-3 shadow-[0_10px_28px_rgba(0,68,204,0.06)] sm:px-6 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
      <div className="h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-1 rounded-md text-steel-600 hover:text-primary hover:bg-blue-50 transition-colors"
            aria-label="Alternar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold text-primary hidden sm:block">Brimajor Kanban</p>
            <h1 className="font-display text-base sm:text-lg font-bold text-steel-900 leading-tight truncate">{title}</h1>
            <p className="text-xs text-steel-500 hidden md:block truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/80 border border-primary/15 rounded-md text-sm shadow-control">
            <Radio className={`w-4 h-4 ${isSocketConnected ? 'text-signal-green' : 'text-signal-red'}`} />
            <span className="text-steel-700 font-bold">{isSocketConnected ? 'Online' : 'Offline'}</span>
          </div>

          <Link
            to="/alertas"
            className="relative p-2 text-steel-600 hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
            aria-label="Alertas"
          >
            <Bell className="w-5 h-5" />
            {badgeTotal > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-signal-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeTotal > 9 ? '9+' : badgeTotal}
              </span>
            )}
          </Link>

          <div className="h-7 w-px bg-primary/15 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-steel-900 leading-tight truncate max-w-[150px]">{user?.nome || 'Usuário'}</p>
              <p className="text-xs text-steel-500 capitalize">{(user?.perfil || 'Perfil').replace(/_/g, ' ')}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shrink-0 shadow-sm">
              <User className="w-4 h-4" />
            </div>
            <button
              onClick={logout}
              className="p-2 text-steel-600 hover:text-signal-red hover:bg-red-50 rounded-md transition-colors"
              title="Sair do sistema"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
