import React from 'react';
import { Bell, Menu, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const { toggleSidebar, alertsUnread } = useUiStore();
  const { user, isSocketConnected } = useAuthStore();
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-surface-200 shadow-sm flex items-center justify-between px-3 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-1 rounded-lg text-navy-500 hover:text-navy-700 hover:bg-surface-100 transition-colors"
          aria-label="Alternar menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-50 border border-surface-200 rounded-full text-sm">
          <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500 animate-pulse-dot' : 'bg-red-500'}`}></div>
          <span className="text-navy-600 font-medium">{isSocketConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          to="/alertas"
          className="relative p-2 text-navy-500 hover:text-navy-700 hover:bg-surface-100 rounded-lg transition-colors"
          aria-label="Alertas"
        >
          <Bell className="w-5 h-5" />
          {alertsUnread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {alertsUnread > 9 ? '9+' : alertsUnread}
            </span>
          )}
        </Link>

        <div className="h-6 w-px bg-surface-200 hidden sm:block"></div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-navy-700 leading-tight truncate max-w-[140px]">{user?.nome || 'Usuário'}</p>
            <p className="text-xs text-navy-400 capitalize">{(user?.perfil || 'Perfil').replace(/_/g, ' ')}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <button
            onClick={logout}
            className="p-2 text-navy-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sair do sistema"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
