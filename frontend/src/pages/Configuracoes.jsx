import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, ClipboardList, Clock, FileCheck2, Lock, Save, Settings, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatMoney } from '../utils/formatters';
import { PAGINA_LABELS, PAGINAS_SISTEMA, PERFIL_LABELS } from '../utils/permissoes';
import { invalidateOperationalData } from '../utils/queryInvalidation';

/* ─── Toast notification ─────────────────────────────────── */
const useToast = () => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    setToast({ message, type, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, showToast };
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div
      key={toast.id}
      style={{ animation: 'slideInToast 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${isSuccess ? 'bg-emerald-600' : 'bg-red-600'}`}
    >
      {isSuccess ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
      {toast.message}
    </div>
  );
};

/* ─── Confirmation popup for text/number fields ──────────── */
const ConfirmPopup = ({ visible, message, onConfirm, onCancel, loading }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}>
      <div
        style={{ animation: 'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center shrink-0">
            <Save className="w-5 h-5 text-steel-700" />
          </div>
          <div>
            <h3 className="font-bold text-steel-800 text-base">Salvar alteração?</h3>
            <p className="text-sm text-steel-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-secondary text-sm py-1.5 px-4">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn-primary text-sm py-1.5 px-4">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main page ───────────────────────────────────────────── */
const Configuracoes = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
  const { toast, showToast } = useToast();

  const [form, setForm] = useState({
    limite_supervisor: '',
    limite_gerente: '',
    solicitantes: [],
    aprovadores_nivel_1: [],
    aprovadores_nivel_2: [],
    aprovadores_nivel_3: [],
    compradores: [],
    recebedores: [],
  });
  const [kanban, setKanban] = useState({
    nivel_servico_padrao: 95,
    ciclos_estimativa_inicial: 10,
    taxa_carregamento_padrao: 0.2,
    percentual_pr_como_es_provisorio: 50,
  });
  const [permissoes, setPermissoes] = useState({
    cadastrar_item: [],
    editar_curva_abc: [],
    editar_fornecedor_produto: [],
    definir_meta_gastos: [],
    paginas: {},
  });
  const [turnos, setTurnos] = useState([]);

  // Confirm popup state
  const [popup, setPopup] = useState({ visible: false, message: '', onConfirm: null });

  const showPopup = (message, onConfirm) => setPopup({ visible: true, message, onConfirm });
  const hidePopup = () => setPopup({ visible: false, message: '', onConfirm: null });

  /* ── Queries ── */
  const { data, isLoading } = useQuery({
    queryKey: ['configuracoes', 'pedidos'],
    queryFn: async () => (await api.get('/configuracoes/pedidos')).data,
  });
  const { data: permissoesData, isLoading: carregandoPermissoes } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });
  const { data: kanbanData, isLoading: carregandoKanban } = useQuery({
    queryKey: ['configuracoes', 'kanban'],
    queryFn: async () => (await api.get('/configuracoes/kanban')).data,
  });
  const { data: turnosData, isLoading: carregandoTurnos } = useQuery({
    queryKey: ['configuracoes', 'turnos'],
    queryFn: async () => (await api.get('/configuracoes/turnos')).data,
  });

  /* ── Populate states ── */
  useEffect(() => {
    if (data) {
      setForm({
        limite_supervisor: data.limite_supervisor ?? '',
        limite_gerente: data.limite_gerente ?? '',
        solicitantes: data.solicitantes || [],
        aprovadores_nivel_1: data.aprovadores_nivel_1 || [],
        aprovadores_nivel_2: data.aprovadores_nivel_2 || [],
        aprovadores_nivel_3: data.aprovadores_nivel_3 || [],
        compradores: data.compradores || [],
        recebedores: data.recebedores || [],
      });
    }
  }, [data]);

  useEffect(() => {
    if (permissoesData) {
      setPermissoes({
        cadastrar_item: permissoesData.cadastrar_item || [],
        editar_curva_abc: permissoesData.editar_curva_abc || [],
        editar_fornecedor_produto: permissoesData.editar_fornecedor_produto || [],
        definir_meta_gastos: permissoesData.definir_meta_gastos || [],
        paginas: permissoesData.paginas || {},
      });
    }
  }, [permissoesData]);

  useEffect(() => {
    if (kanbanData) {
      setKanban({
        nivel_servico_padrao: kanbanData.nivel_servico_padrao ?? 95,
        ciclos_estimativa_inicial: kanbanData.ciclos_estimativa_inicial ?? 10,
        taxa_carregamento_padrao: kanbanData.taxa_carregamento_padrao ?? 0.2,
        percentual_pr_como_es_provisorio: kanbanData.percentual_pr_como_es_provisorio ?? 50,
      });
    }
  }, [kanbanData]);

  useEffect(() => {
    if (turnosData?.turnos) setTurnos(turnosData.turnos);
  }, [turnosData]);

  /* ── Mutations ── */
  const salvar = useMutation({
    mutationFn: (formData) => api.patch('/configuracoes/pedidos', {
      limite_supervisor: Number(formData.limite_supervisor),
      limite_gerente: Number(formData.limite_gerente),
      solicitantes: formData.solicitantes || [],
      aprovadores_nivel_1: formData.aprovadores_nivel_1 || [],
      aprovadores_nivel_2: formData.aprovadores_nivel_2 || [],
      aprovadores_nivel_3: formData.aprovadores_nivel_3 || [],
      compradores: formData.compradores || [],
      recebedores: formData.recebedores || [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'pedidos'] });
      invalidateOperationalData(queryClient);
      hidePopup();
      showToast('Configurações de fluxo salvas!');
    },
    onError: (e) => { hidePopup(); showToast(e.message || 'Erro ao salvar', 'error'); },
  });

  const salvarPermissoes = useMutation({
    mutationFn: (permData) => api.patch('/configuracoes/permissoes', {
      cadastrar_item: permData.cadastrar_item || [],
      editar_curva_abc: permData.editar_curva_abc || [],
      editar_fornecedor_produto: permData.editar_fornecedor_produto || [],
      definir_meta_gastos: permData.definir_meta_gastos || [],
      paginas: permData.paginas || {},
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'permissoes'] });
      showToast('Permissão atualizada!');
    },
    onError: (e) => showToast(e.message || 'Erro ao salvar permissão', 'error'),
  });

  const salvarKanban = useMutation({
    mutationFn: (kanbanData) => api.patch('/configuracoes/kanban', {
      nivel_servico_padrao: Number(kanbanData.nivel_servico_padrao),
      ciclos_estimativa_inicial: Number(kanbanData.ciclos_estimativa_inicial),
      taxa_carregamento_padrao: Number(kanbanData.taxa_carregamento_padrao),
      percentual_pr_como_es_provisorio: Number(kanbanData.percentual_pr_como_es_provisorio),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'kanban'] });
      invalidateOperationalData(queryClient);
      hidePopup();
      showToast('Parâmetros Kanban salvos!');
    },
    onError: (e) => { hidePopup(); showToast(e.message || 'Erro ao salvar Kanban', 'error'); },
  });

  const salvarTurnos = useMutation({
    mutationFn: (turnosData) => api.patch('/configuracoes/turnos', { turnos: turnosData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'turnos'] });
      hidePopup();
      showToast('Turnos salvos!');
    },
    onError: (e) => { hidePopup(); showToast(e.message || 'Erro ao salvar turnos', 'error'); },
  });

  /* ── Derived ── */
  const supervisor = Number(form.limite_supervisor) || 0;
  const gerente = Number(form.limite_gerente) || 0;
  const invalido = supervisor < 0 || gerente < 0 || gerente < supervisor;
  const taxaCarregamento = Number(kanban.taxa_carregamento_padrao);
  const taxaCarregamentoPercentual = Number.isFinite(taxaCarregamento) ? (taxaCarregamento * 100).toFixed(0) : '0';
  const perfisAprovadores = (permissoesData?.perfis || []).filter((p) => !['admin', 'comprador', 'facilitador', 'visualizador'].includes(p));
  const perfisFluxoCompra = (permissoesData?.perfis || []).filter((p) => !['admin', 'visualizador'].includes(p));

  /* ── Auto-save handlers ── */
  // Checkbox: save immediately
  const toggleAprovador = (campo, perfil) => {
    setForm((prev) => {
      const atual = prev[campo] || [];
      const next = {
        ...prev,
        [campo]: atual.includes(perfil) ? atual.filter((p) => p !== perfil) : [...atual, perfil],
      };
      salvar.mutate(next);
      return next;
    });
  };

  const togglePerfil = (campo, perfil) => {
    setPermissoes((prev) => {
      const atual = prev[campo] || [];
      const next = {
        ...prev,
        [campo]: atual.includes(perfil) ? atual.filter((p) => p !== perfil) : [...atual, perfil],
      };
      salvarPermissoes.mutate(next);
      return next;
    });
  };

  const togglePaginaPerfil = (pagina, perfil) => {
    setPermissoes((prev) => {
      const paginaAtual = prev.paginas?.[pagina] || [];
      const next = {
        ...prev,
        paginas: {
          ...(prev.paginas || {}),
          [pagina]: paginaAtual.includes(perfil) ? paginaAtual.filter((p) => p !== perfil) : [...paginaAtual, perfil],
        },
      };
      salvarPermissoes.mutate(next);
      return next;
    });
  };

  // Text/number: show popup on blur
  const handleLimiteBlur = () => {
    if (!isAdmin || invalido) return;
    showPopup(
      `Teto supervisor → ${formatMoney(supervisor)} | Limite gerente → ${formatMoney(gerente)}`,
      () => salvar.mutate(form)
    );
  };

  const handleKanbanBlur = () => {
    showPopup(
      `Nível de serviço: ${kanban.nivel_servico_padrao}% | Custo: ${kanban.taxa_carregamento_padrao} | Ciclos: ${kanban.ciclos_estimativa_inicial}`,
      () => salvarKanban.mutate(kanban)
    );
  };

  const handleTurnoBlur = () => {
    showPopup(
      'Salvar os horários dos turnos operacionais?',
      () => salvarTurnos.mutate(turnos)
    );
  };

  const updateTurno = (index, campo, valor) => {
    setTurnos((prev) => prev.map((turno, i) => (i === index ? { ...turno, [campo]: valor } : turno)));
  };

  return (
    <>
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <Toast toast={toast} />

      <ConfirmPopup
        visible={popup.visible}
        message={popup.message}
        loading={salvar.isPending || salvarKanban.isPending || salvarTurnos.isPending}
        onConfirm={() => popup.onConfirm?.()}
        onCancel={hidePopup}
      />

      <div className="space-y-6 pb-12 animate-fade-in">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-steel-800">Configurações</h1>
          <p className="text-steel-400 text-sm">Regras administrativas do fluxo</p>
        </div>

        {/* ── Fluxo de aprovação ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
            <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-steel-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-steel-800">Fluxo de aprovação de compra</h2>
              <p className="text-xs text-steel-500">Somente admin altera cargos; demais perfis seguem as etapas configuradas.</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <FluxoCompraPreview form={form} tetoSupervisor={supervisor} />

            {!isAdmin && (
              <div className="bg-surface-50 border border-surface-200 rounded-md p-3 flex gap-2 text-sm text-steel-600">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Você pode consultar o fluxo, mas apenas administradores salvam alterações nos cargos.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Teto do supervisor de turno</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.limite_supervisor}
                  onChange={(e) => setForm((f) => ({ ...f, limite_supervisor: e.target.value }))}
                  onBlur={handleLimiteBlur}
                  className="input font-mono"
                  disabled={isLoading || !isAdmin}
                />
                <p className="text-xs text-steel-500 mt-1">
                  Até {formatMoney(supervisor)}, supervisor aprova. Acima disso, escala para gerente de operações.
                </p>
              </div>
              <div>
                <label className="label">Limite legado de diretoria</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.limite_gerente}
                  onChange={(e) => setForm((f) => ({ ...f, limite_gerente: e.target.value }))}
                  onBlur={handleLimiteBlur}
                  className="input font-mono"
                  disabled={isLoading || !isAdmin}
                />
                <p className="text-xs text-steel-500 mt-1">Mantido por compatibilidade. No fluxo redesenhado, o gerente conclui a aprovação.</p>
              </div>
            </div>

            {invalido && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>O limite do gerente deve ser maior ou igual ao limite do supervisor.</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Esses valores afetam os novos pedidos e aprovações pendentes. Pedidos já aprovados não são reclassificados.</p>
            </div>

            <div className="rounded-md border border-surface-200 bg-white p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-steel-800">Cargos do fluxo</h3>
                <p className="text-xs text-steel-500 mt-1">Clique em um cargo para salvar automaticamente.</p>
              </div>
              <div className="space-y-4">
                <PermissionGroup title="1. Solicitação de compra" description="Quem pode abrir pedidos para reposição." value={form.solicitantes} perfis={perfisFluxoCompra} disabled={isLoading || carregandoPermissoes || !isAdmin} onToggle={(p) => toggleAprovador('solicitantes', p)} />
                <PermissionGroup title="2. Aprovação do supervisor" description="Aprova quando o valor não excede o teto; se exceder, escala para gerente." value={form.aprovadores_nivel_1} perfis={perfisAprovadores} disabled={isLoading || carregandoPermissoes || !isAdmin} onToggle={(p) => toggleAprovador('aprovadores_nivel_1', p)} />
                <PermissionGroup title="3. Aprovação do gerente de operações" description="Recebe somente os pedidos escalados acima do teto." value={form.aprovadores_nivel_2} perfis={perfisAprovadores} disabled={isLoading || carregandoPermissoes || !isAdmin} onToggle={(p) => toggleAprovador('aprovadores_nivel_2', p)} />
                <PermissionGroup title="4. Registro da OC externa" description="Quem registra fornecedor final e número da ordem de compra." value={form.compradores} perfis={perfisFluxoCompra} disabled={isLoading || carregandoPermissoes || !isAdmin} onToggle={(p) => toggleAprovador('compradores', p)} />
                <PermissionGroup title="5. NF e conclusão" description="Quem registra a NF quando o pedido chega." value={form.recebedores} perfis={perfisFluxoCompra} disabled={isLoading || carregandoPermissoes || !isAdmin} onToggle={(p) => toggleAprovador('recebedores', p)} />
              </div>
              <p className="text-xs text-steel-500">Admin sempre executa qualquer etapa por regra do sistema, mesmo sem aparecer nas listas.</p>
            </div>
          </div>
        </div>

        {/* ── Kanban padrão ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
            <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-steel-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-steel-800">Kanban padrão</h2>
              <p className="text-xs text-steel-500">Valores usados no cadastro de novos produtos.</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="label">Nível de serviço padrão</label>
                <select
                  className="input font-mono"
                  value={kanban.nivel_servico_padrao}
                  onChange={(e) => setKanban((k) => ({ ...k, nivel_servico_padrao: e.target.value }))}
                  onBlur={handleKanbanBlur}
                  disabled={carregandoKanban}
                >
                  {[90, 95, 98, 99].map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
                <p className="text-xs text-steel-500 mt-1">Novo item nasce com este percentual. Padrão: 95%.</p>
              </div>
              <div>
                <label className="label">Custo para manter estoque</label>
                <input
                  type="number" min="0" max="1" step="0.01"
                  value={kanban.taxa_carregamento_padrao}
                  onChange={(e) => setKanban((k) => ({ ...k, taxa_carregamento_padrao: e.target.value }))}
                  onBlur={handleKanbanBlur}
                  className="input font-mono"
                  disabled={carregandoKanban}
                />
                <p className="text-xs text-steel-500 mt-1">{taxaCarregamentoPercentual}% ao ano. Use 0.20 para 20%.</p>
              </div>
              <div>
                <label className="label">Ciclos para estimativa inicial</label>
                <input
                  type="number" min="3" max="10" step="1"
                  value={kanban.ciclos_estimativa_inicial}
                  onChange={(e) => setKanban((k) => ({ ...k, ciclos_estimativa_inicial: e.target.value }))}
                  onBlur={handleKanbanBlur}
                  className="input font-mono"
                  disabled={carregandoKanban}
                />
                <p className="text-xs text-steel-500 mt-1">Use 10 para dar base suficiente a Holt e regressão sem inventar histórico longo.</p>
              </div>
              <div>
                <label className="label">% do PR como ES provisório</label>
                <input
                  type="number" min="0" max="100" step="5"
                  value={kanban.percentual_pr_como_es_provisorio}
                  onChange={(e) => setKanban((k) => ({ ...k, percentual_pr_como_es_provisorio: e.target.value }))}
                  onBlur={handleKanbanBlur}
                  className="input font-mono"
                  disabled={carregandoKanban}
                />
                <p className="text-xs text-steel-500 mt-1">
                  Enquanto o produto não completar os ciclos mínimos para IA/estatística, usa <strong>{kanban.percentual_pr_como_es_provisorio}%</strong> do PR como ES de segurança provisório.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Turnos operacionais ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
            <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-steel-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-steel-800">Turnos operacionais</h2>
              <p className="text-xs text-steel-500">Usados nas entradas e saídas de estoque.</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {turnos.map((turno, index) => (
                <div key={turno.id || index} className="rounded-md border border-surface-200 bg-white p-3">
                  <label className="label">Turno</label>
                  <input
                    value={turno.nome}
                    onChange={(e) => updateTurno(index, 'nome', e.target.value)}
                    onBlur={handleTurnoBlur}
                    className="input font-bold"
                    disabled={carregandoTurnos}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className="label">Início</label>
                      <input type="time" value={turno.inicio} onChange={(e) => updateTurno(index, 'inicio', e.target.value)} onBlur={handleTurnoBlur} className="input font-mono" disabled={carregandoTurnos} />
                    </div>
                    <div>
                      <label className="label">Fim</label>
                      <input type="time" value={turno.fim} onChange={(e) => updateTurno(index, 'fim', e.target.value)} onBlur={handleTurnoBlur} className="input font-mono" disabled={carregandoTurnos} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Permissões por cargo ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
            <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-steel-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-steel-800">Permissões por cargo</h2>
              <p className="text-xs text-steel-500">Admin sempre tem acesso total; marque os demais cargos autorizados.</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-5">
            <PermissionGroup title="Cadastrar item" value={permissoes.cadastrar_item} perfis={permissoesData?.perfis || []} disabled={carregandoPermissoes} onToggle={(p) => togglePerfil('cadastrar_item', p)} />

            <PermissionGroup
              title="Editar fornecedores vinculados ao produto"
              description="Quem pode vincular, editar e desvincular fornecedores de um produto específico."
              value={permissoes.editar_fornecedor_produto}
              perfis={permissoesData?.perfis || []}
              disabled={carregandoPermissoes}
              onToggle={(p) => togglePerfil('editar_fornecedor_produto', p)}
            />

            <PermissionGroup
              title="Definir metas de gastos"
              description="Quem pode configurar metas mensais de gastos na aba de Relatórios."
              value={permissoes.definir_meta_gastos}
              perfis={permissoesData?.perfis || []}
              disabled={carregandoPermissoes}
              onToggle={(p) => togglePerfil('definir_meta_gastos', p)}
            />

            <div>
              <h3 className="text-sm font-bold text-steel-800 mb-3">Acesso por página</h3>
              <div className="overflow-x-auto rounded-md border border-surface-200">
                <table className="min-w-[920px] w-full text-sm">
                  <thead className="bg-surface-50 text-xs uppercase text-steel-400">
                    <tr>
                      <th className="p-3 text-left">Página</th>
                      {(permissoesData?.perfis || []).filter((p) => p !== 'admin').map((perfil) => (
                        <th key={perfil} className="p-3 text-center font-bold">{PERFIL_LABELS[perfil] || perfil}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 bg-white">
                    {PAGINAS_SISTEMA.map((pagina) => (
                      <tr key={pagina}>
                        <td className="p-3 font-semibold text-steel-700">{PAGINA_LABELS[pagina] || pagina}</td>
                        {(permissoesData?.perfis || []).filter((p) => p !== 'admin').map((perfil) => (
                          <td key={`${pagina}-${perfil}`} className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={(permissoes.paginas?.[pagina] || []).includes(perfil)}
                              disabled={carregandoPermissoes}
                              onChange={() => togglePaginaPerfil(pagina, perfil)}
                              className="h-4 w-4 rounded border-surface-300 text-steel-700 focus:ring-navy-500"
                              aria-label={`${PAGINA_LABELS[pagina] || pagina} para ${PERFIL_LABELS[perfil] || perfil}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-steel-500 mt-2">Admin sempre acessa todas as páginas, mesmo quando não aparece na matriz.</p>
            </div>

            <PermissionGroup title="Editar curva ABC" value={permissoes.editar_curva_abc} perfis={permissoesData?.perfis || []} disabled={carregandoPermissoes} onToggle={(p) => togglePerfil('editar_curva_abc', p)} />
          </div>
        </div>
      </div>
    </>
  );
};

const formatPerfis = (perfis = []) => {
  if (!perfis.length) return 'Admin';
  return perfis.map((perfil) => PERFIL_LABELS[perfil] || perfil).join(', ');
};

const FluxoCompraPreview = ({ form, tetoSupervisor }) => {
  const steps = [
    { icon: ClipboardList, title: 'Solicitação', status: 'Novo pedido', owner: formatPerfis(form.solicitantes), note: 'Abre a necessidade de compra.' },
    { icon: ShieldCheck, title: 'Supervisor', status: `Teto ${formatMoney(tetoSupervisor)}`, owner: formatPerfis(form.aprovadores_nivel_1), note: 'Aprova ou escala para gerente.' },
    { icon: ShieldCheck, title: 'Gerente op.', status: 'Se exceder teto', owner: formatPerfis(form.aprovadores_nivel_2), note: 'Aprova pedido escalado.' },
    { icon: ShoppingCart, title: 'Comprador', status: 'OC externa', owner: formatPerfis(form.compradores), note: 'Registra o número da OC.' },
    { icon: Truck, title: 'Aguardando chegada', status: 'Em aberto', owner: formatPerfis(form.compradores), note: 'Pedido comprado, aguardando entrega.' },
    { icon: FileCheck2, title: 'Concluído', status: 'NF registrada', owner: formatPerfis(form.recebedores), note: 'Comprador ou facilitador informa a NF.' },
  ];

  return (
    <div className="rounded-md border border-surface-200 bg-white p-3">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {steps.map((step, index) => (
          <div key={step.title} className="relative rounded-md border border-surface-200 bg-surface-50 p-3 min-h-[150px]">
            <div className="flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded bg-white border border-surface-200 flex items-center justify-center">
                <step.icon className="w-4 h-4 text-steel-700" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-steel-400">{step.status}</span>
            </div>
            <h3 className="mt-3 text-sm font-black text-steel-800">{step.title}</h3>
            <p className="mt-1 text-xs text-steel-500">{step.note}</p>
            <p className="mt-3 text-xs font-semibold text-steel-700 line-clamp-2">{step.owner}</p>
            {index < steps.length - 1 && (
              <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-surface-200 items-center justify-center">
                <ArrowRight className="w-4 h-4 text-steel-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const PermissionGroup = ({ title, description, value, perfis, disabled, onToggle }) => (
  <div>
    <h3 className="text-sm font-bold text-steel-800 mb-3">{title}</h3>
    {description && <p className="text-xs text-steel-500 -mt-2 mb-3">{description}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {perfis.filter((perfil) => perfil !== 'admin').map((perfil) => (
        <label key={perfil} className="flex items-center gap-2 rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-steel-700 cursor-pointer hover:bg-surface-50 transition-colors">
          <input
            type="checkbox"
            checked={value.includes(perfil)}
            disabled={disabled}
            onChange={() => onToggle(perfil)}
            className="h-4 w-4 rounded border-surface-300 text-steel-700 focus:ring-navy-500"
          />
          <span>{PERFIL_LABELS[perfil] || perfil}</span>
        </label>
      ))}
    </div>
  </div>
);

export default Configuracoes;
