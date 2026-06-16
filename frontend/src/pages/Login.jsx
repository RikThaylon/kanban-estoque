import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, Loader2, Lock, LogIn, ShieldCheck, User } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans p-4">
      
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img 
          src="/supply-chain-flow.jpg" 
          alt="Fluxo logístico industrial" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-luminosity"
        />
        {/* Blue overlay for readability and dark theme feel */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.6) 50%, rgba(15,23,42,0.9) 100%)'
          }}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white text-2xl font-bold shadow-lg shadow-blue-900/50 border border-blue-500/30">
              B
            </div>
            <span className="text-3xl font-bold tracking-wide text-white drop-shadow-md">Brimajor Kanban</span>
          </div>
          <h1 className="text-lg font-medium text-slate-300 mb-4 max-w-sm drop-shadow">
            Controle industrial com visão de comando em tempo real.
          </h1>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-blue-200 bg-slate-800/40 px-4 py-2 rounded-full border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sessão segura</span>
            </div>
            <div className="w-px h-3 bg-slate-600"></div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-300" />
              <span>Tempo real</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-0.5"></span>
            </div>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="w-full bg-white shadow-2xl rounded-2xl p-8 border border-white/20 backdrop-blur-xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Acesso Operacional
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Insira suas credenciais para entrar no sistema
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 mb-6 animate-slide-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700" htmlFor="username">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all bg-gray-50/50"
                  placeholder="Seu usuário"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all bg-gray-50/50"
                  placeholder="Sua senha"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800 transition-colors"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Manter conectado
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !username || !senha} 
              className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#002244] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003366] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" aria-hidden="true" />
                  Entrar no sistema
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
