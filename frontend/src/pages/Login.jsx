import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Lock, User } from 'lucide-react';
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
    <div className="min-h-dvh grid lg:grid-cols-[1fr_480px] bg-surface-100 text-navy-900 overflow-hidden">
      <section className="hidden lg:flex relative p-10 xl:p-14 industrial-surface text-steel-900 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(215,25,32,0.14),transparent_38%,rgba(5,5,5,0.06))]" />
        <div className="relative z-10 flex flex-col justify-between w-full">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-steel-700/15 bg-white/70 px-3 py-2 text-xs font-bold uppercase text-steel-700">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Linha de estoque viva
            </div>
            <h1 className="mt-8 max-w-2xl font-display text-5xl xl:text-6xl font-black leading-[1.02] text-steel-900">
              Controle industrial com ritmo de turno.
            </h1>
            <p className="mt-5 max-w-xl text-base text-steel-600">
              Kanban, compras, máquinas e aprovações em uma interface feita para decisão rápida no chão de fábrica.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-2xl">
            {[
              ['ES', 'Estoque seguro'],
              ['PR', 'Reposicao'],
              ['EOQ', 'Compra ideal'],
            ].map(([code, label]) => (
              <div key={code} className="rounded-md border border-steel-700/12 bg-white/72 p-4 shadow-panel">
                <div className="font-mono text-2xl font-black text-steel-900">{code}</div>
                <div className="mt-1 text-xs font-bold uppercase text-steel-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="flex min-h-dvh items-center justify-center bg-white px-4 py-8 sm:px-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            <div className="mx-auto lg:mx-0 w-12 h-12 rounded-md bg-accent flex items-center justify-center text-white font-display font-black text-2xl shadow-[0_14px_32px_rgba(215,25,32,0.28)]">
              K
            </div>
            <h2 className="mt-5 font-display text-3xl font-black text-navy-900">Kanban Estoque</h2>
            <p className="mt-2 text-sm font-medium text-navy-500">Acesso operacional seguro</p>
          </div>

          <div className="rounded-lg border border-surface-200 bg-white p-5 sm:p-6 shadow-panel">
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 animate-slide-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-navy-600 mb-2" htmlFor="username">
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-navy-400" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-md border border-surface-300 bg-white pl-10 pr-3 py-3 text-navy-900 placeholder:text-navy-300 focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="usuário"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-navy-600 mb-2" htmlFor="senha">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-navy-400" />
                  </div>
                  <input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="block w-full rounded-md border border-surface-300 bg-white pl-10 pr-3 py-3 text-navy-900 placeholder:text-navy-300 focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="senha"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !senha}
                className="btn-primary w-full mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no sistema'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
