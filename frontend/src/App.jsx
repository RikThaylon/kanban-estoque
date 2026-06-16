import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, authChecked } = useAuthStore();
  const { checkAuth, logout } = useAuth();
  
  useEffect(() => {
    checkAuth();
  }, []);

  // Monitoramento de Inatividade (10 min)
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // Inicia o timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, logout]);

  if (!authChecked) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const PageRoute = ({ pagina, children }) => {
  const { user } = useAuthStore();
  const { data: permissoes, isLoading } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });

  if (isLoading) return <FullPageLoader />;
  if (!perfilTemPagina(permissoes, user?.perfil, pagina)) {
    return (
      <div className="p-8 text-center text-steel-500">
        Você não tem acesso a esta página.
      </div>
    );
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
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
              <Route path="*" element={<div className="p-8 text-center text-gray-500">Página em construção</div>} />
            </Route>
          </Route>
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
