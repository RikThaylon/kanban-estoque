import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Edit2, Trash2, KeyRound, X, Save, Loader2, ShieldCheck, Eye } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

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
  executor: 'bg-blue-100 text-blue-700',
};

const labelPerfil = (v) => PERFIS.find((p) => p.value === v)?.label || v;
const tipoPerfil = (v) => PERFIS.find((p) => p.value === v)?.tipo || 'executor';
const SENHA_MIN = 8;
const SENHA_MAX = 100;
const SENHA_REGEX = /^\S+$/;

const Usuarios = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [modalAberto, setModalAberto] = useState(null); // 'novo' | 'editar' | 'senha' | null
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

  const abrirSenha = (u) => {
    setForm({ nome: u.nome, username: u.username, senha: '', perfil: u.perfil });
    setUsuarioEdit(u);
    setErroModal('');
    setModalAberto('senha');
  };

  const fechar = () => {
    setModalAberto(null);
    setUsuarioEdit(null);
    setSalvando(false);
    setErroModal('');
  };

  const salvar = async () => {
    setErroModal('');
    if ((modalAberto === 'novo' || modalAberto === 'senha')) {
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
      } else if (modalAberto === 'senha') {
        await api.post(`/usuarios/${usuarioEdit.id}/reset-senha`, { nova_senha: form.senha });
      }
      await carregar();
      fechar();
    } catch (e) {
      alert(e.message || 'Erro ao salvar');
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
    return (
      <div className="bg-white rounded-lg p-8 text-center text-navy-400">
        Acesso restrito.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Usuários</h1>
          <p className="text-navy-400 text-sm">
            {isAdmin ? 'Gerencie usuários e cargos do sistema' : 'Visualização dos usuários cadastrados'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 bg-kanban-verde hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Novo usuário
          </button>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-red-700 text-sm">{erro}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-navy-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full">
            <thead className="bg-surface-50 text-xs uppercase tracking-wide text-navy-400">
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
                  <td className="px-4 py-3 font-medium text-navy-800">{u.nome}</td>
                  <td className="px-4 py-3 font-mono text-sm text-navy-600">{u.username}</td>
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
                        <button onClick={() => abrirEditar(u)} title="Editar" className="p-2 hover:bg-surface-100 rounded-lg text-navy-500">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => abrirSenha(u)} title="Resetar senha" className="p-2 hover:bg-surface-100 rounded-lg text-navy-500">
                          <KeyRound className="w-4 h-4" />
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
                <h2 className="text-lg font-bold text-navy-800">
                  {modalAberto === 'novo' && 'Novo usuário'}
                  {modalAberto === 'editar' && `Editar ${usuarioEdit?.nome}`}
                  {modalAberto === 'senha' && `Resetar senha — ${usuarioEdit?.nome}`}
                </h2>
                <button onClick={fechar} className="text-navy-400 hover:text-navy-700 p-1 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {erroModal && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {erroModal}
                  </div>
                )}
                {modalAberto !== 'senha' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-navy-600">Nome</label>
                      <input
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-navy-600">Usuário (login)</label>
                      <input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-200 font-mono focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde"
                        pattern="^[a-zA-Z0-9._-]+$"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-navy-600">Cargo</label>
                      <select
                        value={form.perfil}
                        onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde"
                      >
                        {PERFIS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-navy-400 mt-1">
                        Tipo: <span className="font-semibold">{tipoPerfil(form.perfil)}</span>
                      </p>
                    </div>
                  </>
                )}
                {(modalAberto === 'novo' || modalAberto === 'senha') && (
                  <div>
                    <label className="text-xs font-semibold text-navy-600">
                      {modalAberto === 'senha' ? 'Nova senha' : 'Senha'}
                    </label>
                    <input
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde"
                      minLength={SENHA_MIN}
                      maxLength={SENHA_MAX}
                      pattern="^\S+$"
                    />
                    <p className="text-xs text-navy-400 mt-1">Mínimo {SENHA_MIN} caracteres, sem espaços.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={fechar} className="px-4 py-2 text-navy-600 hover:bg-surface-100 rounded-lg font-semibold">
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg font-semibold disabled:opacity-60"
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
