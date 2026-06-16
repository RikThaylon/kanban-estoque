import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, Loader2, Lock, LogIn, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const LogisticsMap = () => (
  <svg className="reference-map" viewBox="0 0 620 320" role="img" aria-label="Fluxo industrial conectado">
    <defs>
      <linearGradient id="pathRed" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="#9FCBFF" />
        <stop offset="100%" stopColor="#DCEBFF" stopOpacity="0.30" />
      </linearGradient>
      <linearGradient id="pathGreen" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="#BFE5FF" />
        <stop offset="100%" stopColor="#67C3FF" stopOpacity="0.44" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="9" floodColor="#0044CC" floodOpacity="0.15" stdDeviation="8" />
      </filter>
    </defs>

    <path
      d="M78 192 C145 144 190 136 242 168 C287 196 329 210 382 167 C424 132 467 133 524 176"
      fill="none"
      stroke="#00123D"
      strokeLinecap="round"
      strokeOpacity="0.5"
      strokeWidth="2"
    />
    <path
      d="M80 206 C149 161 190 154 239 188 C283 218 328 232 386 188 C431 154 471 154 526 193"
      fill="none"
      stroke="#00123D"
      strokeLinecap="round"
      strokeOpacity="0.26"
      strokeWidth="2"
    />
    <path
      d="M100 190 C165 132 220 123 273 158 C315 186 362 191 412 148"
      fill="none"
      stroke="url(#pathRed)"
      strokeLinecap="round"
      strokeWidth="22"
    />
    <path
      d="M272 216 C339 184 374 173 438 178 C489 182 518 202 552 238"
      fill="none"
      stroke="url(#pathGreen)"
      strokeLinecap="round"
      strokeWidth="24"
    />

    <g filter="url(#softShadow)" stroke="#00123D" strokeLinejoin="round" strokeWidth="1.8">
      <g transform="translate(42 172)">
        <path d="M0 74 L0 34 L14 34 L14 48 L42 33 L42 48 L70 33 L70 74 Z" fill="#83BBFF" />
        <path d="M-4 74 H78" fill="none" />
        <path d="M9 25 H24 V34 H9 Z" fill="#DCEBFF" />
        <path d="M18 25 V2 H28 V25" fill="#0088FF" />
        <path d="M44 58 H54 M20 58 H30" />
        <path d="M39 -8 C52 -1 64 -1 77 -9 M43 2 C56 9 68 9 81 1" fill="none" opacity="0.45" />
      </g>

      <g transform="translate(225 218)">
        <path d="M0 28 L46 0 L94 27 L47 56 Z" fill="#B8D8FF" />
        <path d="M0 28 V81 L47 109 V56 Z" fill="#83BBFF" />
        <path d="M47 56 L94 27 V80 L47 109 Z" fill="#DCEBFF" />
        <path d="M17 54 L34 64 V84 L17 75 Z" fill="#FFFFFF" />
        <path d="M60 59 H82 V80 H60 Z" fill="#FFFFFF" />
      </g>

      <g transform="translate(351 94)">
        <path d="M0 30 L51 0 L101 28 L50 58 Z" fill="#DCEBFF" />
        <path d="M0 30 V84 L50 113 V58 Z" fill="#83BBFF" />
        <path d="M50 58 L101 28 V82 L50 113 Z" fill="#BFE5FF" />
        <path d="M18 54 H40 V88 H18 Z" fill="#FFFFFF" />
        <path d="M74 58 L86 66 V86 L74 78 Z" fill="#FFFFFF" />
      </g>

      <g transform="translate(182 151)">
        <path d="M0 33 L34 14 L70 35 L35 56 Z" fill="#83BBFF" />
        <path d="M0 33 V65 L35 86 V56 Z" fill="#3F98FF" />
        <path d="M35 56 L70 35 V67 L35 86 Z" fill="#BFE5FF" />
        <path d="M70 45 H94 L110 61 V79 H70 Z" fill="#BFE5FF" />
        <path d="M94 45 V61 H110" fill="#FFFFFF" />
        <circle cx="82" cy="82" r="8" fill="#FFFFFF" />
        <circle cx="109" cy="82" r="8" fill="#FFFFFF" />
      </g>

      <g transform="translate(465 222)">
        <path d="M0 49 L52 21 L104 52 L52 82 Z" fill="#83BBFF" />
        <path d="M0 49 V69 L52 99 V82 Z" fill="#3F98FF" />
        <path d="M52 82 L104 52 V72 L52 99 Z" fill="#BFE5FF" />
        <path d="M22 48 L52 31 L83 50 L52 67 Z" fill="#FFFFFF" />
        <path d="M32 49 L48 59 M44 43 L60 53 M56 37 L72 47" opacity="0.48" />
        <path d="M23 21 L74 51 V7 L23 -23 Z" fill="#BFE5FF" />
        <path d="M31 3 L43 21 L58 15" fill="none" />
      </g>
    </g>

    <path d="M421 172 L431 164 L431 189 L421 197 Z" fill="#FFFFFF" stroke="#00123D" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M431 164 L448 174 L448 199 L431 189 Z" fill="#005DFF" stroke="#00123D" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M435 178 L442 171 M435 178 L444 190" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" />
  </svg>
);

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
    <div className="auth-page reference-auth-page min-h-dvh overflow-x-hidden text-steel-900">
      <main className="reference-stage">
        <section className="reference-copy-block">
          <div className="reference-badge">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
            Brimajor Kanban
          </div>

          <h1 className="reference-title font-display font-black text-steel-900">
            <span>Controle industrial Brimajor</span>
            <span>de comando em tempo real.</span>
          </h1>

          <p className="reference-copy">
            Kanban, compras, máquinas e aprovações em uma superfície operacional para decisão rápida no chão de fábrica.
          </p>
        </section>

        <section className="reference-visual">
          <LogisticsMap />
        </section>

        <aside className="reference-login">
          <div className="reference-panel liquid-glass">
            <div className="reference-brand">
              <div className="reference-logo">B</div>
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-black text-steel-900">Brimajor Kanban</h2>
                <p className="mt-1 text-xs font-semibold text-steel-600">Acesso operacional seguro</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50/90 p-3 animate-slide-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="reference-form">
              <div>
                <label className="reference-label" htmlFor="username">
                  Usuário
                </label>
                <div className="reference-field relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-navy-300" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-md border border-white/70 bg-white/75 py-1.5 pl-9 pr-3 text-sm text-navy-900 placeholder:text-navy-300 focus:border-primary focus:ring-2 focus:ring-accent/20"
                    placeholder="usuário"
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

              <div>
                <label className="reference-label" htmlFor="senha">
                  Senha
                </label>
                <div className="reference-field relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-navy-300" />
                  </div>
                  <input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="block w-full rounded-md border border-white/70 bg-white/75 py-1.5 pl-9 pr-3 text-sm text-navy-900 placeholder:text-navy-300 focus:border-primary focus:ring-2 focus:ring-accent/20"
                    placeholder="senha"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !username || !senha} className="btn-primary reference-submit w-full">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Entrar no sistema
                  </>
                )}
              </button>
            </form>

            <div className="reference-trust-row">
              <div className="reference-trust-pill">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Sessão segura
              </div>
              <div className="reference-trust-pill">
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
