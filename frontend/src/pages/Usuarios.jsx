import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Edit2, Trash2, X, Save, Loader2, ShieldCheck, Eye,
  KeyRound, CheckCircle2, XCircle, Clock, Copy, Check, AlertTriangle, RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatDate } from '../utils/formatters';

const PERFIS = [
  { value: 'admin',              label: 'Administrador',          tipo: 'admin' },
  { value: 'plant_manager',      label: 'Plant Manager',          tipo: 'visualizador' },
  { value: 'gerente_engenharia', label: 'Gerente de Engenharia',  tipo: 'visualizador' },
  { value: 'eng_processos',      label: 'Eng. de Processos',      tipo: 'visualizador' },
  { value: 'eng_producao',       label: 'Eng. de Produção',       tipo: 'visualizador' },
  { value: 'gerente_operacoes',  label: 'Gerente de Operações',   tipo: 'aprovador2' },
  { value: 'supervisor_turno',   label: 'Supervisor de Turno',    tipo: 'aprovador1' },
  { value: 'comprador',          label: 'Comprador',              tipo: 'executor' },
  { value: 'facilitador',        label: 'Facilitador Kanban',     tipo: 'executor' },
  { value: 'visualizador',       label: 'Visualizador',           tipo: 'visualizador' },
];

const corPorTipo = {
  admin: 'bg-purple-100 text-purple-700',
  visualizador: 'bg-slate-100 text-slate-600',
  aprovador1: 'bg-amber-100 text-amber-700',
  aprovador2: 'bg-orange-100 text-orange-700',
  executor: 'bg-red-100 text-red-700',
};

const labelPerfil = (v) => PERFIS.find((p) => p.value === v)?.label || v;
const tipoPerfil = (v) => PERFIS.find((p) => p.value === v)?.tipo || 'executor';
const SENHA_MIN = 8;
const SENHA_MAX = 100;
const SENHA_REGEX = /^\S+$/;

// ── Componente: Token de recuperação aprovado ─────────────────────────────────
const TokenModal = ({ token, expiraEm, onClose }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(token);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-steel-800">Solicitação Aprovada</h3>
            <p className="text-xs text-steel-400">Token gerado com sucesso — válido por 2 horas</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">
            Este token <strong>não será exibido novamente</strong>. Copie e entregue ao usuário
            por canal interno seguro (presencialmente, sistema de mensagens interno, etc.).
          </p>
        </div>

        <div className="bg-surface-100 rounded-xl p-4 mb-4">
          <p className="text-xs text-steel-500 mb-2 font-semibold uppercase tracking-wide">Token de recuperação</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-steel-800 break-all bg-white border border-surface-200 rounded-lg px-3 py-2 leading-relaxed">
              {token}
            </code>
            <button
              onClick={copiar}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                copiado
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-primary text-white hover:bg-red-800'
              }`}
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {expiraEm && (
          <p className="text-xs text-steel-400 mb-5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Expira em: <span className="font-semibold text-steel-600">{formatDate(expiraEm)}</span>
          </p>
        )}

        <div className="border-t border-surface-200 pt-4">
          <p className="text-xs text-steel-400 mb-3">
            O usuário deverá acessar a tela de login, clicar em "Esqueci minha senha" e,
            quando solicitado, inserir este token para criar uma nova senha.
          </p>
          <button onClick={onClose} className="btn-primary w-full justify-center">
            Entendi — Token anotado
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Componente: Modal de rejeição ─────────────────────────────────────────────
const RejeicaoModal = ({ solicitacao, onConfirm, onClose, loading }) => {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-steel-800">Rejeitar Solicitação</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-100 rounded-lg">
            <X className="w-5 h-5 text-steel-400" />
          </button>
        </div>
        <p className="text-sm text-steel-600 mb-4">
          Rejeitar a solicitação de <strong>{solicitacao.usuario_nome}</strong> ({solicitacao.username})?
        </p>
        <div className="mb-4">
          <label className="label">Motivo da rejeição (opcional)</label>
          <textarea
            className="input w-full resize-none"
            rows={3}
            placeholder="Ex: Identidade não verificada presencialmente, conta ativa sem problema..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onConfirm(motivo)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-red-800 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Rejeitar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Aba: Recuperação de Senha (admin) ─────────────────────────────────────────
const RecuperacaoSenhaAdmin = () => {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [tokenModal, setTokenModal] = useState(null); // { token, expira_em }
  const [rejeicaoModal, setRejeicaoModal] = useState(null); // solicitacao
  const [acaoLoading, setAcaoLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data } = await api.get('/auth/password-reset-requests');
      setSolicitacoes(data.solicitacoes || data || []);
    } catch (e) {
      setErro(e.response?.data?.message || 'Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const aprovar = async (id) => {
    setAcaoLoading(true);
    try {
      const { data } = await api.post(`/auth/password-reset-requests/${id}/approve`);
      setTokenModal({ token: data.token, expira_em: data.expira_em });
      await carregar();
    } catch (e) {
      alert(e.response?.data?.message || 'Erro ao aprovar solicitação.');
    } finally {
      setAcaoLoading(false);
    }
  };

  const rejeitar = async (motivo) => {
    if (!rejeicaoModal) return;
    setAcaoLoading(true);
    try {
      await api.post(`/auth/password-reset-requests/${rejeicaoModal.id}/reject`, {
        motivo_rejeicao: motivo || undefined,
      });
      setRejeicaoModal(null);
      await carregar();
    } catch (e) {
      alert(e.response?.data?.message || 'Erro ao rejeitar solicitação.');
    } finally {
      setAcaoLoading(false);
    }
  };

  const pendentes = solicitacoes.filter((s) => s.status === 'PENDENTE');
  const historico = solicitacoes.filter((s) => s.status !== 'PENDENTE');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-steel-800">Solicitações de Recuperação de Senha</h2>
          <p className="text-sm text-steel-400">
            Usuários que solicitaram recuperação aguardam sua aprovação. Aprove para gerar um token de redefinição.
          </p>
        </div>
        <button onClick={carregar} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-steel-400" />
        </div>
      ) : (
        <>
          {/* Pendentes */}
          <div>
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1 border-b border-red-100 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Pendentes ({pendentes.length})
            </h3>
            {pendentes.length === 0 ? (
              <p className="text-sm text-steel-400 py-6 text-center">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="space-y-3">
                {pendentes.map((s) => (
                  <div key={s.id} className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-steel-800">{s.usuario_nome}</span>
                        <span className="font-mono text-xs text-steel-400">@{s.username}</span>
                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          PENDENTE
                        </span>
                      </div>
                      <p className="text-xs text-steel-400 mt-1">
                        Solicitado em: {formatDate(s.criado_em)}
                        {s.motivo && <> · <span className="italic">"{s.motivo}"</span></>}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setRejeicaoModal(s)}
                        disabled={acaoLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-surface-300 hover:bg-red-50 hover:border-red-200 hover:text-primary text-steel-600 rounded-lg text-sm font-semibold transition-colors"
                      >
                        <XCircle className="w-4 h-4" /> Rejeitar
                      </button>
                      <button
                        onClick={() => aprovar(s.id)}
                        disabled={acaoLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-red-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                      >
                        {acaoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        Aprovar + Gerar Token
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-steel-500 uppercase tracking-wider mb-3 pb-1 border-b border-surface-200">
                Histórico recente ({historico.length})
              </h3>
              <div className="divide-y divide-surface-100 rounded-xl border border-surface-200 overflow-hidden">
                {historico.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <span className="font-medium text-steel-700">{s.usuario_nome}</span>
                      <span className="text-steel-400 font-mono text-xs ml-2">@{s.username}</span>
                      {s.motivo_rejeicao && (
                        <p className="text-xs text-steel-400 mt-0.5 italic">"{s.motivo_rejeicao}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        s.status === 'APROVADO'  ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'REJEITADO' ? 'bg-red-100 text-red-700' :
                        s.status === 'UTILIZADO' ? 'bg-steel-100 text-steel-600' :
                        'bg-surface-100 text-steel-500'
                      }`}>
                        {s.status}
                      </span>
                      <span className="text-xs text-steel-400">{formatDate(s.atualizado_em || s.criado_em)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {tokenModal && (
        <TokenModal
          token={tokenModal.token}
          expiraEm={tokenModal.expira_em}
          onClose={() => setTokenModal(null)}
        />
      )}
      {rejeicaoModal && (
        <RejeicaoModal
          solicitacao={rejeicaoModal}
          onConfirm={rejeitar}
          onClose={() => setRejeicaoModal(null)}
          loading={acaoLoading}
        />
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const Usuarios = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';

  const [aba, setAba] = useState('usuarios'); // 'usuarios' | 'recuperacao'

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [modalAberto, setModalAberto] = useState(null); // 'novo' | 'editar' | null
  const [usuarioEdit, setUsuarioEdit] = useState(null);
  const [form, setForm] = useState({ nome: '', username: '', senha: '', perfil: 'comprador' });
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/usuarios?limit=50');
      setUsuarios(data.items || data.data || data);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => {
    setForm({ nome: '', username: '', senha: '', perfil: 'comprador' });
    setUsuarioEdit(null);
    setErroModal('');
    setModalAberto('novo');
  };

  const abrirEditar = (u) => {
    setForm({ nome: u.nome, username: u.username, senha: '', perfil: u.perfil });
    setUsuarioEdit(u);
    setErroModal('');
    setModalAberto('editar');
  };

  const fechar = () => {
    setModalAberto(null);
    setUsuarioEdit(null);
    setSalvando(false);
    setErroModal('');
  };

  const salvar = async () => {
    setErroModal('');
    if (modalAberto === 'novo') {
      if (form.senha.length < SENHA_MIN || form.senha.length > SENHA_MAX || !SENHA_REGEX.test(form.senha)) {
        setErroModal(`Senha deve ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres e não pode conter espaços.`);
        return;
      }
    }
    setSalvando(true);
    try {
      if (modalAberto === 'novo') {
        await api.post('/usuarios', form);
      } else if (modalAberto === 'editar') {
        const payload = { nome: form.nome, username: form.username, perfil: form.perfil };
        await api.patch(`/usuarios/${usuarioEdit.id}`, payload);
      }
      await carregar();
      fechar();
    } catch (e) {
      setErroModal(e.response?.data?.message || e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (u) => {
    if (!confirm(`Desativar usuário "${u.nome}"?`)) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      await carregar();
    } catch (e) {
      alert(e.message || 'Erro ao desativar');
    }
  };

  if (!isAdmin && !['plant_manager', 'gerente_engenharia', 'eng_processos', 'eng_producao', 'gerente_operacoes'].includes(user?.perfil)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-steel-800">Usuários</h1>
          <p className="text-steel-400 text-sm">
            {isAdmin ? 'Gerencie usuários, cargos e recuperações de senha' : 'Visualização dos usuários cadastrados'}
          </p>
        </div>
        {isAdmin && aba === 'usuarios' && (
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 bg-kanban-verde hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Novo usuário
          </button>
        )}
      </div>

      {/* Abas — só admin vê a aba de recuperação */}
      {isAdmin && (
        <div className="flex gap-1 border-b border-surface-200">
          {[
            { key: 'usuarios',    label: 'Usuários' },
            { key: 'recuperacao', label: 'Recuperação de Senha' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAba(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                aba === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-steel-500 hover:text-steel-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo da aba */}
      {aba === 'recuperacao' ? (
        <RecuperacaoSenhaAdmin />
      ) : (
        <>
          {erro && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-red-700 text-sm">{erro}</div>
          )}

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-steel-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full">
                  <thead className="bg-surface-50 text-xs uppercase tracking-wide text-steel-400">
                    <tr>
                      <th className="text-left px-4 py-3">Nome</th>
                      <th className="text-left px-4 py-3">Usuário</th>
                      <th className="text-left px-4 py-3">Cargo</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {usuarios.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-steel-800">{u.nome}</td>
                        <td className="px-4 py-3 font-mono text-sm text-steel-600">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${corPorTipo[tipoPerfil(u.perfil)]}`}>
                            {tipoPerfil(u.perfil) === 'visualizador' && <Eye className="w-3 h-3" />}
                            {(tipoPerfil(u.perfil).startsWith('aprovador') || tipoPerfil(u.perfil) === 'admin') && <ShieldCheck className="w-3 h-3" />}
                            {labelPerfil(u.perfil)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => abrirEditar(u)} title="Editar" className="p-2 hover:bg-surface-100 rounded-lg text-steel-500">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {u.id !== user?.id && (
                                <button onClick={() => desativar(u)} title="Desativar" className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Criar/Editar */}
      <AnimatePresence>
        {modalAberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={fechar}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-steel-800">
                  {modalAberto === 'novo' ? 'Novo usuário' : `Editar ${usuarioEdit?.nome}`}
                </h2>
                <button onClick={fechar} className="text-steel-400 hover:text-steel-700 p-1 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {erroModal && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {erroModal}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-steel-600">Nome</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="mt-1 input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-steel-600">Usuário (login)</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    className="mt-1 input w-full font-mono"
                    pattern="^[a-zA-Z0-9._-]+$"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-steel-600">Cargo</label>
                  <select
                    value={form.perfil}
                    onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                    className="mt-1 input w-full"
                  >
                    {PERFIS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-steel-400 mt-1">
                    Tipo: <span className="font-semibold">{tipoPerfil(form.perfil)}</span>
                  </p>
                </div>
                {modalAberto === 'novo' && (
                  <div>
                    <label className="text-xs font-semibold text-steel-600">Senha inicial</label>
                    <input
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                      className="mt-1 input w-full"
                      minLength={SENHA_MIN}
                      maxLength={SENHA_MAX}
                      pattern="^\S+$"
                    />
                    <p className="text-xs text-steel-400 mt-1">
                      Mínimo {SENHA_MIN} caracteres, sem espaços. O usuário poderá alterar após o primeiro acesso.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={fechar} className="btn-secondary">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="btn-primary flex items-center gap-2"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Usuarios;
