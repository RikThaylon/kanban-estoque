import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !senha) return;

    const success = await login(username.trim(), senha);
    if (success) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-800 p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-navy-600 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-kanban-verde rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-kanban-verde rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
            K
          </div>
          <h1 className="text-2xl font-bold text-navy-800">Kanban Estoque</h1>
          <p className="text-navy-400 text-sm mt-1">Gestão industrial inteligente</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 animate-slide-in">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5" htmlFor="username">
              Usuário
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-navy-300" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-surface-200 rounded-xl text-navy-700 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde transition-all bg-surface-50 focus:bg-white"
                placeholder="ex: admin"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5" htmlFor="senha">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-navy-300" />
              </div>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-surface-200 rounded-xl text-navy-700 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde transition-all bg-surface-50 focus:bg-white"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !senha}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-navy-700 hover:bg-navy-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Sistema'}
          </button>
        </form>

        <details className="mt-8 text-xs text-navy-400">
          <summary className="cursor-pointer text-center hover:text-navy-600 select-none">
            Usuários disponíveis (clique para expandir)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-navy-500">
            <span>admin</span><span>Admin@123</span>
            <span>plant</span><span>Plant@123</span>
            <span>geneng</span><span>Geneng@123</span>
            <span>processos</span><span>Epc@123</span>
            <span>producao</span><span>Epd@123</span>
            <span>gerente.op</span><span>Gop@123</span>
            <span>supervisor</span><span>Sup@123</span>
            <span>comprador</span><span>Cmp@123</span>
            <span>facilitador</span><span>Fac@123</span>
          </div>
        </details>
      </div>
    </div>
  );
};

export default Login;
