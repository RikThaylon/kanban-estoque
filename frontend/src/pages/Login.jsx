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
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Left side - Welcome/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600 text-lg font-bold shadow-sm">
              B
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Brimajor Kanban</span>
          </div>
        </div>
        
        <div className="max-w-2xl relative z-10">
          <h1 className="text-4xl lg:text-5xl font-black mb-6 leading-[1.1] tracking-tight">
            Controle industrial com visão de comando em tempo real.
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed font-medium">
            Kanban, compras, máquinas e aprovações em uma superfície operacional para decisão rápida no chão de fábrica.
          </p>
        </div>

        {/* Isometric illustration - full panel watermark with blue fade */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img 
            src="/supply-chain-flow.jpg" 
            alt="Fluxo logístico industrial" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-25"
          />
          {/* Blue overlay - ensures text readability */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.4) 45%, rgba(15,23,42,0.5) 65%, rgba(15,23,42,0.9) 100%)'
            }}
          />
        </div>

        <div className="relative z-10 flex items-center gap-6 text-sm text-blue-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Sessão 100% segura</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-300" />
            <span>Monitoramento em tempo real</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1"></span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-gray-50 relative">
        <div className="w-full max-w-md space-y-8 bg-white shadow-xl rounded-2xl p-8 sm:p-10 border border-gray-100">
          
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600 text-white text-lg font-bold shadow-sm">
                B
              </div>
              <span className="text-xl font-bold text-gray-900">Brimajor Kanban</span>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Acesso Operacional
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Por favor, insira suas credenciais para entrar no sistema.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 animate-slide-in">
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
                  className="block w-full rounded-xl border-0 py-3 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-shadow"
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
                  className="block w-full rounded-xl border-0 py-3 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-shadow"
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
                  className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Manter conectado
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !username || !senha} 
              className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#002244] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003366] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
