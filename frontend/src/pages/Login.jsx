import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, AlertCircle, Loader2, Lock, LogIn, ShieldCheck, User, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Restaurar rota original após login (ex: usuário foi redirecionado do /produtos)
  const from = location.state?.from?.pathname || '/dashboard';

  // Estados do Modal de Recuperação de Senha
  const [recuperarOpen, setRecuperarOpen] = useState(false);
  const [recUser, setRecUser] = useState('');
  const [recMotivo, setRecMotivo] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recSucesso, setRecSucesso] = useState('');
  const [recErro, setRecErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !senha) return;

    const doLogin = async (lat, lon) => {
      const success = await login(username.trim(), senha, lat, lon);
      if (success) navigate(from, { replace: true });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => doLogin(position.coords.latitude, position.coords.longitude),
        () => doLogin(null, null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      doLogin(null, null);
    }
  };

  const handleSolicitarRecuperacao = async (e) => {
    e.preventDefault();
    if (!recUser.trim()) return;

    setRecLoading(true);
    setRecErro('');
    setRecSucesso('');

    try {
      const response = await api.post('/auth/forgot-password', {
        username: recUser.trim(),
        motivo: recMotivo.trim() || undefined,
      });
      setRecSucesso(response.data.message || 'Solicitação enviada com sucesso.');
      setRecUser('');
      setRecMotivo('');
    } catch (err) {
      setRecErro(err.response?.data?.message || 'Erro ao enviar solicitação.');
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans p-4 sm:p-6">
      
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img 
          src="/supply-chain-flow.jpg" 
          alt="Fluxo logístico industrial" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-luminosity"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.6) 50%, rgba(15,23,42,0.95) 100%)'
          }}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8 w-full">
          <div className="flex items-center gap-3 mb-4 p-2">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-accent to-red-800 text-white text-xl sm:text-2xl font-bold shadow-lg shadow-red-900/50 border border-red-400/30">
              K
            </div>
            <span className="text-2xl sm:text-3xl font-bold tracking-wide text-white drop-shadow-lg">
              Smart Kanban
            </span>
          </div>
          
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700/30 rounded-2xl p-4 mb-5 shadow-xl">
            <h1 className="text-base sm:text-lg font-medium text-slate-200 max-w-[320px] mx-auto leading-relaxed">
              Controle industrial com visão de comando em tempo real.
            </h1>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-semibold text-slate-200 bg-slate-800/60 px-4 py-2.5 rounded-full border border-slate-700/50 backdrop-blur-md shadow-inner">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sessão segura</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-slate-600"></div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Activity className="w-4 h-4 text-slate-300" />
              <span>Tempo real</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-0.5"></span>
            </div>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="w-full bg-white shadow-2xl rounded-3xl p-6 sm:p-10 border border-white/20 backdrop-blur-xl animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Acesso Operacional
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-gray-500">
              Insira suas credenciais para entrar no sistema
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 mb-6 animate-slide-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
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
                  className="block w-full rounded-xl border-0 py-3.5 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 transition-all bg-gray-50 focus:bg-white"
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
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="senha">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => { setRecuperarOpen(true); setRecSucesso(''); setRecErro(''); }}
                  className="text-xs text-primary hover:text-red-800 font-semibold focus:outline-none"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3.5 pl-11 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 transition-all bg-gray-50 focus:bg-white"
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
              className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-red-800 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-950/20 hover:from-red-600 hover:to-red-900 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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

      {/* Modal de Solicitação de Recuperação (Forgot Password) */}
      {recuperarOpen && (
        <div className="fixed inset-0 bg-navy-900/60 flex items-center justify-center z-50 p-4 modal-overlay-enter">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md modal-spring-enter overflow-hidden">
            <div className="p-5 border-b border-surface-200 flex justify-between items-center bg-surface-50">
              <div>
                <h3 className="font-bold text-steel-800">Recuperação de Senha</h3>
                <p className="text-xs text-steel-400 mt-0.5">Sua solicitação será analisada pelo administrador</p>
              </div>
              <button 
                onClick={() => setRecuperarOpen(false)}
                className="p-1.5 text-steel-400 hover:text-steel-600 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {recSucesso ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-steel-800">{recSucesso}</p>
                  <p className="text-xs text-steel-400">Entre em contato com o suporte ou gestor local para obter seu token de redefinição.</p>
                  <button 
                    onClick={() => setRecuperarOpen(false)}
                    className="btn-secondary w-full mt-4 justify-center"
                  >
                    Fechar Janela
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSolicitarRecuperacao} className="space-y-4">
                  {recErro && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {recErro}
                    </div>
                  )}

                  <div>
                    <label className="label">Username / Usuário *</label>
                    <input 
                      type="text" 
                      className="input w-full"
                      value={recUser}
                      onChange={e => setRecUser(e.target.value)}
                      placeholder="Ex: joao.silva"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Motivo do Chamado (opcional)</label>
                    <textarea 
                      className="input w-full resize-none"
                      rows={2}
                      value={recMotivo}
                      onChange={e => setRecMotivo(e.target.value)}
                      placeholder="Ex: Esqueci a senha temporária / bloqueio de conta"
                    />
                  </div>

                  <div className="pt-2 border-t border-surface-100 flex flex-col gap-2">
                    <div className="flex gap-2 justify-end">
                      <button 
                        type="button" 
                        onClick={() => setRecuperarOpen(false)}
                        className="btn-secondary"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={recLoading || !recUser.trim()}
                        className="btn-primary"
                      >
                        {recLoading ? 'Processando...' : 'Solicitar Chamado'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/recuperar-senha')}
                      className="text-xs text-center text-primary hover:underline pt-1"
                    >
                      Já possui um token de recuperação? Digite o token aqui
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
