import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useAuth } from './hooks/useAuth';
import api from './services/api';
import { perfilTemPagina } from './utils/permissoes';

// Lazy load pages
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Produtos = React.lazy(() => import('./pages/Produtos'));
const ProdutoDetalhe = React.lazy(() => import('./pages/ProdutoDetalhe'));
const Pedidos = React.lazy(() => import('./pages/Pedidos'));
const AcompanharPedido = React.lazy(() => import('./pages/AcompanharPedido'));
const GrafoRelacionamentos = React.lazy(() => import('./pages/GrafoRelacionamentos'));
const Movimentacoes = React.lazy(() => import('./pages/Movimentacoes'));
const Alertas = React.lazy(() => import('./pages/Alertas'));
const Relatorios = React.lazy(() => import('./pages/Relatorios'));
const Maquinas = React.lazy(() => import('./pages/Maquinas'));
const Usuarios = React.lazy(() => import('./pages/Usuarios'));
const Fornecedores = React.lazy(() => import('./pages/Fornecedores'));
const Configuracoes = React.lazy(() => import('./pages/Configuracoes'));
const Raci = React.lazy(() => import('./pages/Raci'));
const AuditoriaMonteCarlo = React.lazy(() => import('./pages/AuditoriaMonteCarlo'));
const Seguranca = React.lazy(() => import('./pages/Seguranca'));
const RecuperacaoSenha = React.lazy(() => import('./pages/RecuperacaoSenha'));
const Layout = React.lazy(() => import('./components/layout/Layout'));

// Loading Fallback
const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-steel-200 border-t-accent rounded-full animate-spin mb-4"></div>
      <p className="text-steel-700 font-bold">Carregando sistema...</p>
    </div>
  </div>
);

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

// Protected Route Wrapper — Phase 4.1: explicit state machine
const ProtectedRoute = () => {
  const { isAuthenticated, authStatus } = useAuthStore();
  const { checkAuth, logout, initMultiTabSync } = useAuth();
  const authCheckRun = React.useRef(false);
  
  useEffect(() => {
    if (!authCheckRun.current) {
      authCheckRun.current = true;
      checkAuth();
    }
  }, []);

  // Phase 4.3 — Multi-tab sync: if another tab logs out, this tab reflects it
  useEffect(() => {
    return initMultiTabSync();
  }, []);

  // Phase 4.2 — Show clear message when session was revoked for security reasons
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      const wasSecurityRevocation = sessionStorage.getItem('kanban_security_logout');
      if (wasSecurityRevocation) {
        sessionStorage.removeItem('kanban_security_logout');
        // Message will be picked up by the Login page
        sessionStorage.setItem('kanban_login_message', 'Sua sessão foi encerrada por motivos de segurança. Faça login novamente.');
      }
    }
  }, [authStatus]);

  const [showIdleModal, setShowIdleModal] = React.useState(false);
  const [countdown, setCountdown] = React.useState(60);

  const idleTimeoutRef = React.useRef(null);
  const countdownIntervalRef = React.useRef(null);
  const showIdleModalRef = React.useRef(false);

  useEffect(() => {
    showIdleModalRef.current = showIdleModal;
  }, [showIdleModal]);

  const startIdleTimer = React.useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      setShowIdleModal(true);
      setCountdown(60);
    }, 10 * 60 * 1000); // 10 minutos
  }, []);

  const handleKeepSession = () => {
    setShowIdleModal(false);
    startIdleTimer();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setShowIdleModal(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    let lastExecution = 0;
    const handleUserActivity = () => {
      if (showIdleModalRef.current) return;
      const now = Date.now();
      if (now - lastExecution >= 5000) {
        startIdleTimer();
        lastExecution = now;
      }
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleUserActivity));

    startIdleTimer();

    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
    };
  }, [isAuthenticated, startIdleTimer]);

  useEffect(() => {
    if (!showIdleModal) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setShowIdleModal(false);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showIdleModal, logout]);

  // Phase 4.1 — ONLY show loader while actively checking; never flash /login prematurely
  if (authStatus === 'checking') {
    return <FullPageLoader />;
  }

  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <Outlet />
      {showIdleModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center border border-surface-200">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏳</span>
            </div>
            <h2 className="text-xl font-bold text-steel-800 mb-2">Você está aí?</h2>
            <p className="text-sm text-steel-500 mb-6">
              Sua sessão expirará em <span className="font-bold text-accent font-mono">{countdown}</span> segundos devido a inatividade.
            </p>
            <button
              onClick={handleKeepSession}
              className="btn-primary w-full justify-center"
            >
              Sim, continuar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const PageRoute = ({ pagina, children }) => {
  const { user } = useAuthStore();
  const { data: permissoes, isLoading } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });

  if (isLoading) return <FullPageLoader />;
  if (!perfilTemPagina(permissoes, user?.perfil, pagina)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecuperacaoSenha />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<PageRoute pagina="dashboard"><Dashboard /></PageRoute>} />
              <Route path="/produtos" element={<PageRoute pagina="produtos"><Produtos /></PageRoute>} />
              <Route path="/produtos/:id" element={<PageRoute pagina="produtos"><ProdutoDetalhe /></PageRoute>} />
              <Route path="/movimentacoes" element={<PageRoute pagina="movimentacoes"><Movimentacoes /></PageRoute>} />
              <Route path="/pedidos/acompanhar" element={<PageRoute pagina="pedidos"><AcompanharPedido /></PageRoute>} />
              <Route path="/pedidos" element={<PageRoute pagina="pedidos"><Pedidos /></PageRoute>} />
              <Route path="/grafo" element={<PageRoute pagina="grafo"><GrafoRelacionamentos /></PageRoute>} />
              <Route path="/alertas" element={<PageRoute pagina="alertas"><Alertas /></PageRoute>} />
              <Route path="/relatorios" element={<PageRoute pagina="relatorios"><Relatorios /></PageRoute>} />
              <Route path="/maquinas" element={<PageRoute pagina="maquinas"><Maquinas /></PageRoute>} />
              <Route path="/usuarios" element={<PageRoute pagina="usuarios"><Usuarios /></PageRoute>} />
              <Route path="/fornecedores" element={<PageRoute pagina="fornecedores"><Fornecedores /></PageRoute>} />
              <Route path="/configuracoes" element={<PageRoute pagina="configuracoes"><Configuracoes /></PageRoute>} />
              <Route path="/raci" element={<PageRoute pagina="raci"><Raci /></PageRoute>} />
              <Route path="/simulacao" element={<PageRoute pagina="simulacao"><AuditoriaMonteCarlo /></PageRoute>} />
              <Route path="/seguranca" element={<PageRoute pagina="seguranca"><Seguranca /></PageRoute>} />
              <Route path="*" element={<div className="p-8 text-center text-gray-500">Página em construção</div>} />
            </Route>
          </Route>
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
