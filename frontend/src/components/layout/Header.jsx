import React from 'react';
import { Bell, Menu, LogOut, User } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const { toggleSidebar, alertsUnread } = useUiStore();
  const { user, isSocketConnected } = useAuthStore();
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-surface-200 shadow-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 -ml-2 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-surface-100 transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-50 border border-surface-200 rounded-full text-sm">
          <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500 animate-pulse-dot' : 'bg-red-500'}`}></div>
          <span className="text-navy-600 font-medium">{isSocketConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 text-navy-400 hover:text-navy-700 transition-colors">
          <Bell className="w-5 h-5" />
          {alertsUnread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {alertsUnread > 9 ? '9+' : alertsUnread}
            </span>
          )}
        </button>

        <div className="h-8 w-px bg-surface-200"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-navy-700 leading-tight">{user?.nome || 'Usuário'}</p>
            <p className="text-xs text-navy-400 capitalize">{(user?.perfil || 'Perfil').replace(/_/g, ' ')}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-600">
            <User className="w-5 h-5" />
          </div>
          <button 
            onClick={logout}
            className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
            title="Sair do sistema"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
