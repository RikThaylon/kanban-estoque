import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const POLITICA = [
  { id: 'len',  label: 'Mínimo 8 caracteres',    check: s => s.length >= 8 },
  { id: 'up',   label: '1 letra maiúscula',        check: s => /[A-Z]/.test(s) },
  { id: 'num',  label: '1 número',                 check: s => /[0-9]/.test(s) },
  { id: 'esp',  label: '1 caractere especial',     check: s => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s) },
  { id: 'match',label: 'Senhas coincidem',         check: (s, c) => s === c && s.length > 0 },
];

const RecuperacaoSenha = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const checks = POLITICA.map(p => ({
    ...p,
    passed: p.id === 'match' ? p.check(novaSenha, confirmarSenha) : p.check(novaSenha),
  }));
  const allPassed = checks.every(c => c.passed);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allPassed) return;

    setStatus('loading');
    setErrorMsg('');
    try {
      await api.post('/auth/reset-password', { token, nova_senha: novaSenha, confirmar_senha: confirmarSenha });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Token inválido, expirado ou já utilizado.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-950/80 to-slate-950">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-white font-bold text-xl mb-2">Token Inválido</h1>
          <p className="text-white/60 text-sm mb-6">Este link não contém um token de recuperação válido.</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center">
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-950/80 to-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-accent to-red-800 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Redefinir Senha</h1>
          <p className="text-white/50 text-sm mt-1">Digite sua nova senha segura</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl modal-spring-enter">

          {/* Sucesso */}
          {status === 'success' && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Senha redefinida!</h2>
              <p className="text-white/60 text-sm mb-6">
                Sua senha foi alterada com sucesso. Todas as sessões anteriores foram encerradas.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center">
                Fazer Login
              </button>
            </div>
          )}

          {/* Erro */}
          {status === 'error' && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Erro na redefinição</p>
                <p className="text-red-400 text-sm mt-0.5">{errorMsg}</p>
                <button
                  onClick={() => navigate('/login')}
                  className="text-red-300 text-xs underline mt-2 hover:text-white"
                >
                  Solicitar nova recuperação
                </button>
              </div>
            </div>
          )}

          {/* Formulário */}
          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-1.5">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showNova ? 'text' : 'password'}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-accent focus:bg-white/15 focus:outline-none transition-all"
                    placeholder="Nova senha forte"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showNova ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white/70 text-sm font-medium mb-1.5">Confirmar Nova Senha</label>
                <div className="relative">
                  <input
                    type={showConfirmar ? 'text' : 'password'}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-accent focus:bg-white/15 focus:outline-none transition-all"
                    placeholder="Confirme a nova senha"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmar(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showConfirmar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Checklist de política */}
              {novaSenha && (
                <div className="space-y-1.5 p-4 bg-white/5 rounded-xl border border-white/10 badge-pop">
                  {checks.map(c => (
                    <div key={c.id} className={`flex items-center gap-2 text-xs transition-colors ${c.passed ? 'text-emerald-400' : 'text-white/40'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors ${c.passed ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={!allPassed || status === 'loading'}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm transition-all
                  bg-gradient-to-r from-accent to-red-800 text-white
                  hover:from-red-500 hover:to-red-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {status === 'loading'
                  ? 'Redefinindo...'
                  : <><ShieldCheck className="w-4 h-4" /> Redefinir Senha</>
                }
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecuperacaoSenha;
