import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Cog, Plus, X, Trash2, Edit3, Link as LinkIcon, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatNumber } from '../utils/formatters';
import { invalidateOperationalData } from '../utils/queryInvalidation';

const PERFIS_ADMIN = ['admin', 'plant_manager'];
const PERFIS_VINCULAR = ['admin', 'plant_manager', 'gerente_operacoes', 'supervisor_turno'];

const Maquinas = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = PERFIS_ADMIN.includes(user?.perfil);
  const podeVincular = PERFIS_VINCULAR.includes(user?.perfil);

  const [tab, setTab] = useState('maquinas');
  const [openMaqModal, setOpenMaqModal] = useState(null); // null, 'novo' ou objeto pra editar
  const [openDeptModal, setOpenDeptModal] = useState(null);
  const [openVincularPara, setOpenVincularPara] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { data: maquinas } = useQuery({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => (await api.get('/departamentos')).data,
  });
  const { data: usuariosDisponiveis } = useQuery({
    queryKey: ['usuarios', 'supervisores'],
    queryFn: async () => {
      try { return (await api.get('/usuarios')).data?.data || []; }
      catch { return []; }
    },
    enabled: tab === 'departamentos',
  });

  const desativarMaq = useMutation({
    mutationFn: (id) => api.delete(`/maquinas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      invalidateOperationalData(queryClient);
    },
  });
  const desativarDept = useMutation({
    mutationFn: (id) => api.delete(`/departamentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      invalidateOperationalData(queryClient);
    },
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800 tracking-tight">Máquinas e Departamentos</h1>
          <p className="text-navy-400 text-sm">Estrutura organizacional e vínculos com produtos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200 overflow-x-auto">
        <button onClick={() => setTab('maquinas')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === 'maquinas' ? 'border-navy-600 text-navy-700' : 'border-transparent text-navy-400 hover:text-navy-600'}`}>
          <Cog className="w-4 h-4" /> Máquinas {maquinas && <span className="text-xs bg-navy-100 text-navy-700 px-1.5 rounded">{maquinas.length}</span>}
        </button>
        <button onClick={() => setTab('departamentos')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === 'departamentos' ? 'border-navy-600 text-navy-700' : 'border-transparent text-navy-400 hover:text-navy-600'}`}>
          <Building2 className="w-4 h-4" /> Departamentos {departamentos && <span className="text-xs bg-navy-100 text-navy-700 px-1.5 rounded">{departamentos.length}</span>}
        </button>
      </div>

      {/* Aba: Máquinas */}
      {tab === 'maquinas' && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <p className="text-sm text-navy-500">Máquinas cadastradas. Clique em uma para ver/editar produtos vinculados.</p>
            {isAdmin && (
              <button onClick={() => setOpenMaqModal('novo')} className="btn-primary"><Plus className="w-4 h-4" /> Nova máquina</button>
            )}
          </div>
          <div className="card divide-y divide-surface-200">
            {(maquinas || []).map(m => (
              <div key={m.id}>
                <div className="p-4 flex items-center gap-3 hover:bg-surface-50 cursor-pointer" onClick={() => setExpanded(e => ({ ...e, [m.id]: !e[m.id] }))}>
                  {expanded[m.id] ? <ChevronDown className="w-4 h-4 text-navy-400" /> : <ChevronRight className="w-4 h-4 text-navy-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-navy-800 text-sm">{m.codigo}</div>
                    <div className="text-sm text-navy-700">{m.nome}</div>
                    <div className="text-xs text-navy-500 mt-0.5">
                      {m.departamento_nome ? `${m.departamento_nome}` : '— sem departamento —'}
                      {m.localizacao && ` · ${m.localizacao}`}
                      <span className="ml-2 text-navy-400">{m.total_produtos} produto(s) vinculado(s)</span>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {podeVincular && (
                      <button onClick={() => setOpenVincularPara(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Vincular produto"><LinkIcon className="w-4 h-4" /></button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => setOpenMaqModal(m)} className="p-1.5 text-navy-500 hover:bg-navy-50 rounded" title="Editar"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm('Desativar máquina?')) desativarMaq.mutate(m.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Desativar"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                {expanded[m.id] && <ProdutosVinculados maquinaId={m.id} podeVincular={podeVincular} />}
              </div>
            ))}
            {(!maquinas || maquinas.length === 0) && <div className="p-8 text-center text-navy-400">Nenhuma máquina cadastrada.</div>}
          </div>
        </div>
      )}

      {/* Aba: Departamentos */}
      {tab === 'departamentos' && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <p className="text-sm text-navy-500">Departamentos e seus supervisores de turno responsáveis.</p>
            {isAdmin && (
              <button onClick={() => setOpenDeptModal('novo')} className="btn-primary"><Plus className="w-4 h-4" /> Novo departamento</button>
            )}
          </div>
          <div className="card divide-y divide-surface-200">
            {(departamentos || []).map(d => (
              <div key={d.id} className="p-4 flex items-center gap-3 hover:bg-surface-50">
                <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center"><Building2 className="w-5 h-5 text-navy-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-navy-800 text-sm">{d.codigo}</div>
                  <div className="text-sm text-navy-700">{d.nome}</div>
                  <div className="text-xs text-navy-500 mt-0.5">
                    Supervisor: <strong>{d.supervisor_nome || '— não atribuído —'}</strong>
                    <span className="ml-2 text-navy-400">{d.total_maquinas} máquina(s)</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => setOpenDeptModal(d)} className="p-1.5 text-navy-500 hover:bg-navy-50 rounded" title="Editar"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm('Desativar departamento?')) desativarDept.mutate(d.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Desativar"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
            {(!departamentos || departamentos.length === 0) && <div className="p-8 text-center text-navy-400">Nenhum departamento cadastrado.</div>}
          </div>
        </div>
      )}

      {openMaqModal && <MaquinaModal maquina={openMaqModal === 'novo' ? null : openMaqModal} departamentos={departamentos || []} onClose={() => setOpenMaqModal(null)} />}
      {openDeptModal && <DepartamentoModal departamento={openDeptModal === 'novo' ? null : openDeptModal} usuarios={usuariosDisponiveis || []} onClose={() => setOpenDeptModal(null)} />}
      {openVincularPara && <VincularProdutoModal maquina={openVincularPara} onClose={() => setOpenVincularPara(null)} />}
    </div>
  );
};

// ── Sub-componente: lista de produtos vinculados a uma máquina ─────────────
const ProdutosVinculados = ({ maquinaId, podeVincular }) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['maquinas', maquinaId, 'detalhe'],
    queryFn: async () => (await api.get(`/maquinas/${maquinaId}`)).data,
  });

  const desvincular = useMutation({
    mutationFn: (produtoId) => api.delete(`/maquinas/${maquinaId}/produtos/${produtoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas', maquinaId, 'detalhe'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      invalidateOperationalData(queryClient);
    },
  });

  if (isLoading) return <div className="px-12 py-3 text-sm text-navy-400">Carregando...</div>;

  return (
    <div className="bg-surface-50 px-12 py-3">
      {data?.produtos?.length === 0 ? (
        <div className="text-sm text-navy-400">Nenhum produto vinculado.</div>
      ) : (
        <div className="space-y-1">
          {data?.produtos?.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2 bg-white rounded border border-surface-200 text-sm">
              <span className="font-mono font-medium text-navy-700">{p.codigo}</span>
              <span className="text-navy-600 flex-1 truncate">{p.nome}</span>
              <span className="text-xs text-navy-500">Estoque: {formatNumber(p.estoque_atual)} {p.unidade}</span>
              {p.consumo_estimado_diario > 0 && (
                <span className="text-xs text-navy-400">~{formatNumber(p.consumo_estimado_diario)}/dia</span>
              )}
              {podeVincular && (
                <button onClick={() => { if (confirm(`Desvincular ${p.codigo}?`)) desvincular.mutate(p.id); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Modal: Criar/Editar Máquina ────────────────────────────────────────────
const MaquinaModal = ({ maquina, departamentos, onClose }) => {
  const queryClient = useQueryClient();
  const isEdit = !!maquina;
  const [form, setForm] = useState({
    codigo: maquina?.codigo || '',
    nome: maquina?.nome || '',
    descricao: maquina?.descricao || '',
    departamento_id: maquina?.departamento_id || '',
    localizacao: maquina?.localizacao || '',
  });
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/maquinas/${maquina.id}`, { ...form, departamento_id: form.departamento_id || null })
      : api.post('/maquinas', { ...form, departamento_id: form.departamento_id || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['maquinas'] }); invalidateOperationalData(queryClient); onClose(); },
    onError: (e) => setErro(e.message || 'Erro'),
  });

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy-800">{isEdit ? 'Editar máquina' : 'Nova máquina'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-navy-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErro(''); salvar.mutate(); }} className="p-5 space-y-3">
          <div><label className="label">Código</label><input className="input" value={form.codigo} disabled={isEdit} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} required /></div>
          <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required /></div>
          <div><label className="label">Descrição</label><textarea className="input resize-none" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
          <div>
            <label className="label">Departamento</label>
            <select className="input" value={form.departamento_id} onChange={e => setForm(f => ({ ...f, departamento_id: e.target.value }))}>
              <option value="">— sem departamento —</option>
              {departamentos.map(d => <option key={d.id} value={d.id}>{d.codigo} — {d.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Localização</label><input className="input" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} /></div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={salvar.isPending} className="btn-primary justify-center">{salvar.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Modal: Criar/Editar Departamento ───────────────────────────────────────
const DepartamentoModal = ({ departamento, usuarios, onClose }) => {
  const queryClient = useQueryClient();
  const isEdit = !!departamento;
  const [form, setForm] = useState({
    codigo: departamento?.codigo || '',
    nome: departamento?.nome || '',
    descricao: departamento?.descricao || '',
    supervisor_id: departamento?.supervisor_id || '',
  });
  const [erro, setErro] = useState('');
  const supervisores = usuarios.filter(u => ['supervisor_turno', 'gerente_operacoes', 'admin'].includes(u.perfil));

  const salvar = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/departamentos/${departamento.id}`, { ...form, supervisor_id: form.supervisor_id || null })
      : api.post('/departamentos', { ...form, supervisor_id: form.supervisor_id || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departamentos'] }); onClose(); },
    onError: (e) => setErro(e.message || 'Erro'),
  });

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy-800">{isEdit ? 'Editar departamento' : 'Novo departamento'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-navy-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErro(''); salvar.mutate(); }} className="p-5 space-y-3">
          <div><label className="label">Código</label><input className="input" value={form.codigo} disabled={isEdit} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} required /></div>
          <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required /></div>
          <div><label className="label">Descrição</label><textarea className="input resize-none" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
          <div>
            <label className="label">Supervisor de turno</label>
            <select className="input" value={form.supervisor_id} onChange={e => setForm(f => ({ ...f, supervisor_id: e.target.value }))}>
              <option value="">— não atribuído —</option>
              {supervisores.map(u => <option key={u.id} value={u.id}>{u.nome} (@{u.username}) — {u.perfil}</option>)}
            </select>
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={salvar.isPending} className="btn-primary justify-center">{salvar.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Modal: Vincular produto a máquina ──────────────────────────────────────
const VincularProdutoModal = ({ maquina, onClose }) => {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [consumo, setConsumo] = useState('');
  const [erro, setErro] = useState('');

  const { data: produtos } = useQuery({
    queryKey: ['produtos', 'busca-vincular', busca],
    queryFn: async () => (await api.get('/produtos', { params: { busca, limit: 20 } })).data,
    enabled: busca.length >= 2,
  });

  const vincular = useMutation({
    mutationFn: () => api.post(`/maquinas/${maquina.id}/produtos`, {
      produto_id: produtoId,
      consumo_estimado_diario: parseFloat(consumo) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas', maquina.id, 'detalhe'] });
      invalidateOperationalData(queryClient, produtoId);
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro'),
  });

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-800">Vincular produto a {maquina.codigo}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-navy-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErro(''); if (!produtoId) return setErro('Selecione um produto'); vincular.mutate(); }} className="p-5 space-y-3">
          <div>
            <label className="label">Produto</label>
            <input className="input" value={busca} onChange={e => { setBusca(e.target.value); setProdutoId(''); }} placeholder="Buscar..." autoFocus />
            {!produtoId && busca.length >= 2 && produtos?.data?.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-surface-200 rounded-md bg-white shadow-sm">
                {produtos.data.map(p => (
                  <button key={p.id} type="button" onClick={() => { setProdutoId(p.id); setBusca(`${p.codigo} — ${p.nome}`); }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-50 text-sm border-b border-surface-100 last:border-0">
                    <span className="font-mono font-medium text-navy-800">{p.codigo}</span>
                    <span className="text-navy-500 ml-2">{p.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div><label className="label">Consumo estimado diário (opcional)</label><input className="input font-mono" type="number" step="0.0001" min="0" value={consumo} onChange={e => setConsumo(e.target.value)} /></div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={vincular.isPending} className="btn-primary justify-center">{vincular.isPending ? 'Vinculando…' : 'Vincular'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Maquinas;
