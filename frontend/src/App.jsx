import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAuth } from './hooks/useAuth';

// Lazy load pages
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Produtos = React.lazy(() => import('./pages/Produtos'));
const ProdutoDetalhe = React.lazy(() => import('./pages/ProdutoDetalhe'));
const Pedidos = React.lazy(() => import('./pages/Pedidos'));
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
  <div className="min-h-screen flex items-center justify-center bg-surface-50">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4"></div>
      <p className="text-navy-600 font-medium">Carregando sistema...</p>
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

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/produtos/:id" element={<ProdutoDetalhe />} />
              <Route path="/movimentacoes" element={<Movimentacoes />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/alertas" element={<Alertas />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/maquinas" element={<Maquinas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/raci" element={<Raci />} />
              <Route path="*" element={<div className="p-8 text-center text-gray-500">Página em construção</div>} />
            </Route>
          </Route>
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
