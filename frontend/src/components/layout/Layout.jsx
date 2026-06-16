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
    <div className="min-h-screen">
      <Sidebar />

      {/* Backdrop para mobile (clica fora pra fechar) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-steel-900/55 backdrop-blur-sm z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header />
        <main className="flex-1 overflow-x-hidden px-3 py-4 sm:p-6 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastRail />
    </div>
  );
};

const ToastRail = () => {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((toast) => setTimeout(() => dismissToast(toast.id), 5200));
    return () => timers.forEach(clearTimeout);
  }, [dismissToast, toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-3 top-20 z-50 grid w-[min(380px,calc(100vw-1.5rem))] gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          role="status"
          className={`rounded-md border-l-4 bg-white p-3 text-left shadow-panel transition hover:-translate-y-0.5 ${
            toast.tipo === 'success' ? 'border-green-500' : toast.tipo === 'warning' ? 'border-amber-500' : 'border-red-500'
          }`}
        >
          <div className="text-sm font-bold text-steel-900">{toast.titulo}</div>
          <div className="mt-0.5 text-xs text-steel-600">{toast.mensagem}</div>
        </button>
      ))}
    </div>
  );
};

export default Layout;
