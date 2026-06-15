import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Boxes,
  Cpu,
  Factory,
  Gauge,
  Loader2,
  Lock,
  LogIn,
  PackageCheck,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const operations = [
  { label: 'Turno online', value: 'A-02', Icon: Activity },
  { label: 'Itens rastreados', value: '1.284', Icon: Boxes },
  { label: 'SLA compras', value: '18 min', Icon: Zap },
];

const kanbanFlow = [
  { label: 'Consumo', value: 'M42', Icon: Factory },
  { label: 'Ponto PR', value: '76%', Icon: Gauge },
  { label: 'Cotação', value: '3x', Icon: Cpu },
  { label: 'Recebimento', value: 'Hoje', Icon: PackageCheck },
];

const stockSignals = [
  {
    code: 'ROL-6204',
    machine: 'Linha prensa 04',
    level: '12 un',
    status: 'Reposição',
    percent: 38,
    tone: 'bg-amber-500',
  },
  {
    code: 'COR-AX12',
    machine: 'Esteira pintura',
    level: '6 un',
    status: 'Crítico',
    percent: 18,
    tone: 'bg-red-500',
  },
  {
    code: 'GRX-500',
    machine: 'CNC célula B',
    level: '44 un',
    status: 'Seguro',
    percent: 76,
    tone: 'bg-emerald-500',
  },
];

const formulas = [
  ['ES', 'Estoque seguro', '14,8'],
  ['PR', 'Reposição', '42,0'],
  ['EOQ', 'Compra ideal', '118'],
];

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
    <div className="auth-page min-h-dvh overflow-x-hidden text-steel-900">
      <main className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
        <section className="order-2 flex min-h-[560px] flex-col justify-between gap-8 px-5 py-8 sm:px-8 lg:order-1 lg:min-h-dvh lg:px-12 lg:py-10 xl:px-16">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/60 bg-white/50 px-3 py-2 text-xs font-bold uppercase text-steel-700 shadow-control backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
              Linha de estoque viva
            </div>

            <h1 className="mt-7 max-w-4xl font-display text-4xl font-black leading-[1.03] text-steel-900 sm:text-5xl xl:text-6xl">
              Controle industrial com visão de comando em tempo real.
            </h1>

            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-steel-600">
              Kanban, compras, máquinas e aprovações em uma superfície operacional para decisão rápida no chão de fábrica.
            </p>

            <div className="mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
              {operations.map(({ label, value, Icon }) => (
                <div key={label} className="liquid-glass rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-steel-900 text-white shadow-control">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-lg font-black text-steel-900">{value}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase text-steel-600">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid max-w-6xl items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="liquid-glass rounded-lg p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-accent">Fluxo Kanban</p>
                  <h2 className="text-lg font-black text-steel-900">Da baixa ao recebimento</h2>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-md border border-white/50 bg-white/50 px-3 py-2 text-xs font-bold text-steel-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Auditoria ativa
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {kanbanFlow.map(({ label, value, Icon }, index) => (
                  <div key={label} className="relative rounded-md border border-white/60 bg-white/40 p-4 shadow-control">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/75 text-steel-900 shadow-control">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      {index < kanbanFlow.length - 1 && (
                        <ArrowRight className="hidden h-4 w-4 text-accent md:block" aria-hidden="true" />
                      )}
                    </div>
                    <p className="mt-4 text-xs font-bold uppercase text-steel-500">{label}</p>
                    <p className="mt-1 font-mono text-2xl font-black text-steel-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="liquid-glass rounded-lg p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-accent">Radar de estoque</p>
                    <h2 className="text-lg font-black text-steel-900">Sinais do turno</h2>
                  </div>
                  <Gauge className="h-5 w-5 text-steel-600" aria-hidden="true" />
                </div>

                <div className="mt-4 space-y-3">
                  {stockSignals.map((item) => (
                    <div key={item.code} className="rounded-md border border-white/60 bg-white/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-black text-steel-900">{item.code}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-steel-600">{item.machine}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-black text-steel-900">{item.level}</p>
                          <p className="mt-1 text-xs font-bold uppercase text-steel-500">{item.status}</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-md bg-steel-900/10">
                        <div className={`h-full rounded-md ${item.tone}`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {formulas.map(([code, label, value]) => (
                  <div key={code} className="liquid-glass rounded-lg p-3">
                    <p className="font-mono text-lg font-black text-steel-900">{code}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase text-steel-500">{label}</p>
                    <p className="mt-3 font-mono text-xl font-black text-accent">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="order-1 flex min-h-dvh items-center justify-center px-5 py-8 sm:px-8 lg:order-2 lg:px-10">
          <div className="auth-panel liquid-glass w-full max-w-md rounded-lg p-5 sm:p-6">
            <div className="mb-7">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-2xl font-black text-white shadow-[0_18px_38px_rgba(215,25,32,0.32)]">
                  K
                </div>
                <div>
                  <h2 className="font-display text-3xl font-black text-steel-900">Kanban Estoque</h2>
                  <p className="mt-1 text-sm font-semibold text-steel-600">Acesso operacional seguro</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-md border border-red-200 bg-red-50/90 p-4 animate-slide-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-navy-600 mb-2" htmlFor="username">
                  Usuário
                </label>
                <div className="auth-field relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-navy-400" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-md border border-white/60 bg-white/60 py-3 pl-10 pr-3 text-navy-900 placeholder:text-navy-300 focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                <div className="auth-field relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-navy-400" />
                  </div>
                  <input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="block w-full rounded-md border border-white/60 bg-white/60 py-3 pl-10 pr-3 text-navy-900 placeholder:text-navy-300 focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Entrar no sistema
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-bold text-steel-600">
              <div className="flex items-center gap-2 rounded-md border border-white/60 bg-white/40 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Sessão segura
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/60 bg-white/40 px-3 py-2">
                <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
                Log rastreável
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default Login;
