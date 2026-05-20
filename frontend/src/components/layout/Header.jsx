import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Radio, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const TITLES = {
  dashboard: ['Centro de comando', 'Visao operacional do estoque Kanban'],
  produtos: ['Catalogo tecnico', 'Itens, parametros e curvas de consumo'],
  movimentacoes: ['Movimentacoes', 'Entradas, saidas e ajustes de estoque'],
  pedidos: ['Compras e aprovacao', 'Solicitacoes, status e recebimentos'],
  maquinas: ['Maquinas e departamentos', 'Vinculos produtivos e responsaveis'],
  alertas: ['Alertas', 'Riscos e pendencias do sistema'],
  relatorios: ['Relatorios', 'Analise gerencial e exportacoes'],
  usuarios: ['Usuarios', 'Perfis e acessos'],
  fornecedores: ['Fornecedores', 'Base de compra e lead times'],
  configuracoes: ['Configuracoes', 'Regras administrativas do fluxo'],
  raci: ['Matriz RACI', 'Responsabilidades do processo'],
};

const Header = () => {
  const { toggleSidebar, alertsUnread } = useUiStore();
  const { user, isSocketConnected } = useAuthStore();
  const { logout } = useAuth();
  const location = useLocation();

  const [title, subtitle] = useMemo(() => {
    const key = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
    return TITLES[key] || ['Kanban Estoque', 'Operacao industrial'];
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
    <header className="sticky top-0 z-10 border-b border-steel-700/10 bg-[rgba(247,248,245,0.78)] backdrop-blur-xl px-3 sm:px-6 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
      <div className="h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-1 rounded-md text-steel-600 hover:text-steel-900 hover:bg-white/70 transition-colors"
            aria-label="Alternar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold text-steel-500 hidden sm:block">Kanban Estoque</p>
            <h1 className="font-display text-base sm:text-lg font-bold text-steel-900 leading-tight truncate">{title}</h1>
            <p className="text-xs text-steel-500 hidden md:block truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/70 border border-steel-700/10 rounded-md text-sm shadow-control">
            <Radio className={`w-4 h-4 ${isSocketConnected ? 'text-signal-green' : 'text-signal-red'}`} />
            <span className="text-steel-700 font-bold">{isSocketConnected ? 'Online' : 'Offline'}</span>
          </div>

          <Link
            to="/alertas"
            className="relative p-2 text-steel-600 hover:text-steel-900 hover:bg-white/70 rounded-md transition-colors"
            aria-label="Alertas"
          >
            <Bell className="w-5 h-5" />
            {badgeTotal > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-signal-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeTotal > 9 ? '9+' : badgeTotal}
              </span>
            )}
          </Link>

          <div className="h-7 w-px bg-steel-700/10 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-steel-900 leading-tight truncate max-w-[150px]">{user?.nome || 'Usuario'}</p>
              <p className="text-xs text-steel-500 capitalize">{(user?.perfil || 'Perfil').replace(/_/g, ' ')}</p>
            </div>
            <div className="w-9 h-9 rounded-md bg-steel-900 flex items-center justify-center text-accent shrink-0">
              <User className="w-5 h-5" />
            </div>
            <button
              onClick={logout}
              className="p-2 text-steel-600 hover:text-signal-red hover:bg-white/70 rounded-md transition-colors"
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
