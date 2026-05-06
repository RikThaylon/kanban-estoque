import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSocket } from '../../hooks/useSocket';
import { useUiStore } from '../../stores/uiStore';

const Layout = () => {
  // Inicializa socket global ao renderizar layout protegido
  useSocket();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const location = useLocation();

  // Fecha sidebar ao mudar de rota (UX mobile)
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Inicializa estado conforme tamanho de tela
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 1024);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar />

      {/* Backdrop para mobile (clica fora pra fechar) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-900/40 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header />
        <main className="flex-1 overflow-x-hidden bg-surface-50 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
