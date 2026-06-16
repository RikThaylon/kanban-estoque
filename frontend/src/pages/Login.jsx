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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-900 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm text-xl font-bold shadow-lg">
              B
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Brimajor Kanban</span>
          </div>
        </div>
        
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1 mb-6 text-[10px] font-bold tracking-widest text-white uppercase backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Linha de estoque viva
          </div>
          <h1 className="text-4xl lg:text-5xl font-black mb-6 leading-[1.1] tracking-tight">
            Controle industrial com visão de comando em tempo real.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed font-medium mb-12">
            Kanban, compras, máquinas e aprovações em uma superfície operacional para decisão rápida no chão de fábrica.
          </p>
          <div className="relative w-full max-w-md mx-auto aspect-video">
            <img 
              src="/supply-chain-flow.png" 
              alt="Fluxo logístico" 
              className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl mix-blend-screen opacity-90"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-blue-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Sessão 100% segura</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Monitoramento em tempo real</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white text-xl font-bold shadow-lg">
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

            <button 
              type="submit" 
              disabled={loading || !username || !senha} 
              className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
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
