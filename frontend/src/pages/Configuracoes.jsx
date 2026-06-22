import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, ClipboardList, Clock, FileCheck2, Lock, Save, Settings, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatMoney } from '../utils/formatters';
import { PAGINA_LABELS, PAGINAS_SISTEMA, PERFIL_LABELS } from '../utils/permissoes';
import { invalidateOperationalData } from '../utils/queryInvalidation';

const Configuracoes = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
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
  });
  const [permissoes, setPermissoes] = useState({
    cadastrar_item: [],
    editar_curva_abc: [],
    paginas: {},
  });
  const [turnos, setTurnos] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

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
      });
    }
  }, [kanbanData]);

  useEffect(() => {
    if (turnosData?.turnos) {
      setTurnos(turnosData.turnos);
    }
  }, [turnosData]);

  const salvar = useMutation({
    mutationFn: () => api.patch('/configuracoes/pedidos', {
      limite_supervisor: Number(form.limite_supervisor),
      limite_gerente: Number(form.limite_gerente),
      solicitantes: form.solicitantes || [],
      aprovadores_nivel_1: form.aprovadores_nivel_1 || [],
      aprovadores_nivel_2: form.aprovadores_nivel_2 || [],
      aprovadores_nivel_3: form.aprovadores_nivel_3 || [],
      compradores: form.compradores || [],
      recebedores: form.recebedores || [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'pedidos'] });
      invalidateOperationalData(queryClient);
      setErro('');
      setSucesso('Configurações salvas.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar configurações');
    },
  });

  const salvarPermissoes = useMutation({
    mutationFn: () => api.patch('/configuracoes/permissoes', {
      cadastrar_item: permissoes.cadastrar_item || [],
      editar_curva_abc: permissoes.editar_curva_abc || [],
      paginas: permissoes.paginas || {},
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'permissoes'] });
      setErro('');
      setSucesso('Permissões salvas.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar permissões');
    },
  });

  const salvarKanban = useMutation({
    mutationFn: () => api.patch('/configuracoes/kanban', {
      nivel_servico_padrao: Number(kanban.nivel_servico_padrao),
      ciclos_estimativa_inicial: Number(kanban.ciclos_estimativa_inicial),
      taxa_carregamento_padrao: Number(kanban.taxa_carregamento_padrao),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'kanban'] });
      invalidateOperationalData(queryClient);
      setErro('');
      setSucesso('Parâmetros Kanban salvos.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar parâmetros Kanban');
    },
  });

  const salvarTurnos = useMutation({
    mutationFn: () => api.patch('/configuracoes/turnos', { turnos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'turnos'] });
      setErro('');
      setSucesso('Turnos salvos.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar turnos');
    },
  });

  const supervisor = Number(form.limite_supervisor) || 0;
  const gerente = Number(form.limite_gerente) || 0;
  const invalido = supervisor < 0 || gerente < 0 || gerente < supervisor;
  const taxaCarregamento = Number(kanban.taxa_carregamento_padrao);
  const taxaCarregamentoPercentual = Number.isFinite(taxaCarregamento)
    ? (taxaCarregamento * 100).toFixed(0)
    : '0';
  const perfisAprovadores = (permissoesData?.perfis || [])
    .filter((perfil) => !['admin', 'comprador', 'facilitador', 'visualizador'].includes(perfil));
  const perfisFluxoCompra = (permissoesData?.perfis || [])
    .filter((perfil) => !['admin', 'visualizador'].includes(perfil));

  const handleSubmit = (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');
    if (invalido) {
      setErro('O limite do gerente deve ser maior ou igual ao limite do supervisor.');
      return;
    }
    salvar.mutate();
  };

  const togglePerfil = (campo, perfil) => {
    setPermissoes((prev) => {
      const atual = prev[campo] || [];
      return {
        ...prev,
        [campo]: atual.includes(perfil)
          ? atual.filter((p) => p !== perfil)
          : [...atual, perfil],
      };
    });
  };

  const toggleAprovador = (campo, perfil) => {
    setForm((prev) => {
      const atual = prev[campo] || [];
      return {
        ...prev,
        [campo]: atual.includes(perfil)
          ? atual.filter((p) => p !== perfil)
          : [...atual, perfil],
      };
    });
  };

  const togglePaginaPerfil = (pagina, perfil) => {
    setPermissoes((prev) => {
      const atual = prev.paginas?.[pagina] || [];
      return {
        ...prev,
        paginas: {
          ...(prev.paginas || {}),
          [pagina]: atual.includes(perfil)
            ? atual.filter((p) => p !== perfil)
            : [...atual, perfil],
        },
      };
    });
  };

  const updateTurno = (index, campo, valor) => {
    setTurnos((prev) => prev.map((turno, i) => (i === index ? { ...turno, [campo]: valor } : turno)));
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Configurações</h1>
          <p className="text-navy-400 text-sm">Regras administráveis do fluxo de compras</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
          <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-navy-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-navy-800">Fluxo de aprovação de compra</h2>
            <p className="text-xs text-navy-500">Somente admin altera cargos; demais perfis seguem as etapas configuradas.</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <FluxoCompraPreview form={form} tetoSupervisor={supervisor} />

          {!isAdmin && (
            <div className="bg-surface-50 border border-surface-200 rounded-md p-3 flex gap-2 text-sm text-navy-600">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Você pode consultar o fluxo, mas apenas administradores salvam alterações nos cargos.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Teto do supervisor de turno</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.limite_supervisor}
                onChange={(e) => setForm((f) => ({ ...f, limite_supervisor: e.target.value }))}
                className="input font-mono"
                disabled={isLoading || !isAdmin}
                required
              />
              <p className="text-xs text-navy-500 mt-1">
                Até {formatMoney(supervisor)}, supervisor aprova. Acima disso, ele escala para gerente de operações.
              </p>
            </div>

            <div>
              <label className="label">Limite legado de diretoria</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.limite_gerente}
                onChange={(e) => setForm((f) => ({ ...f, limite_gerente: e.target.value }))}
                className="input font-mono"
                disabled={isLoading || !isAdmin}
                required
              />
              <p className="text-xs text-navy-500 mt-1">
                Mantido por compatibilidade. No fluxo redesenhado, o gerente conclui a aprovação.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Esses valores afetam os novos pedidos e as aprovações pendentes. Pedidos já aprovados, emitidos ou recebidos não são reclassificados.
            </p>
          </div>

          <div className="rounded-md border border-surface-200 bg-white p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-navy-800">Cargos do fluxo</h3>
              <p className="text-xs text-navy-500 mt-1">
                Configure quem solicita, aprova, registra a OC externa e confirma a chegada com NF.
              </p>
            </div>

            <div className="space-y-4">
              <PermissionGroup
                title="1. Solicitação de compra"
                description="Quem pode abrir pedidos para reposição."
                value={form.solicitantes}
                perfis={perfisFluxoCompra}
                disabled={isLoading || carregandoPermissoes || !isAdmin}
                onToggle={(perfil) => toggleAprovador('solicitantes', perfil)}
              />
              <PermissionGroup
                title="2. Aprovação do supervisor"
                description="Aprova quando o valor não excede o teto; se exceder, escala para gerente."
                value={form.aprovadores_nivel_1}
                perfis={perfisAprovadores}
                disabled={isLoading || carregandoPermissoes || !isAdmin}
                onToggle={(perfil) => toggleAprovador('aprovadores_nivel_1', perfil)}
              />
              <PermissionGroup
                title="3. Aprovação do gerente de operações"
                description="Recebe somente os pedidos escalados acima do teto."
                value={form.aprovadores_nivel_2}
                perfis={perfisAprovadores}
                disabled={isLoading || carregandoPermissoes || !isAdmin}
                onToggle={(perfil) => toggleAprovador('aprovadores_nivel_2', perfil)}
              />
              <PermissionGroup
                title="4. Registro da OC externa"
                description="Quem registra fornecedor final e número da ordem de compra."
                value={form.compradores}
                perfis={perfisFluxoCompra}
                disabled={isLoading || carregandoPermissoes || !isAdmin}
                onToggle={(perfil) => toggleAprovador('compradores', perfil)}
              />
              <PermissionGroup
                title="5. NF e conclusão"
                description="Quem registra a NF quando o pedido chega."
                value={form.recebedores}
                perfis={perfisFluxoCompra}
                disabled={isLoading || carregandoPermissoes || !isAdmin}
                onToggle={(perfil) => toggleAprovador('recebedores', perfil)}
              />
            </div>

            <p className="text-xs text-navy-500">Admin sempre executa qualquer etapa por regra do sistema, mesmo sem aparecer nas listas.</p>
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3">{sucesso}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="submit" disabled={salvar.isPending || isLoading || invalido || !isAdmin} className="btn-primary justify-center">
              <Save className="w-4 h-4" />
              {salvar.isPending ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </form>

      <form
        onSubmit={(event) => { event.preventDefault(); setErro(''); setSucesso(''); salvarKanban.mutate(); }}
        className="card p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
          <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-navy-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-navy-800">Kanban padrão</h2>
            <p className="text-xs text-navy-500">Valores usados no cadastro de novos produtos.</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Nível de serviço padrão</label>
              <select
                className="input font-mono"
                value={kanban.nivel_servico_padrao}
                onChange={(e) => setKanban((k) => ({ ...k, nivel_servico_padrao: e.target.value }))}
                disabled={carregandoKanban}
              >
                {[90, 95, 98, 99].map((v) => <option key={v} value={v}>{v}%</option>)}
              </select>
              <p className="text-xs text-navy-500 mt-1">Novo item nasce com este percentual. Padrão: 95%.</p>
            </div>
            <div>
              <label className="label">Custo para manter estoque</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={kanban.taxa_carregamento_padrao}
                onChange={(e) => setKanban((k) => ({ ...k, taxa_carregamento_padrao: e.target.value }))}
                className="input font-mono"
                disabled={carregandoKanban}
              />
              <p className="text-xs text-navy-500 mt-1">{taxaCarregamentoPercentual}% ao ano. Use 0.20 para 20%.</p>
            </div>
            <div>
              <label className="label">Ciclos para estimativa inicial</label>
              <input
                type="number"
                min="3"
                max="10"
                step="1"
                value={kanban.ciclos_estimativa_inicial}
                onChange={(e) => setKanban((k) => ({ ...k, ciclos_estimativa_inicial: e.target.value }))}
                className="input font-mono"
                disabled={carregandoKanban}
              />
              <p className="text-xs text-navy-500 mt-1">Use 10 para dar base suficiente a Holt e regressão sem inventar histórico longo.</p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="submit" disabled={salvarKanban.isPending || carregandoKanban} className="btn-primary justify-center">
              <Save className="w-4 h-4" />
              {salvarKanban.isPending ? 'Salvando...' : 'Salvar Kanban'}
            </button>
          </div>
        </div>
      </form>

      <form
        onSubmit={(event) => { event.preventDefault(); setErro(''); setSucesso(''); salvarTurnos.mutate(); }}
        className="card p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
          <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-navy-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-navy-800">Turnos operacionais</h2>
            <p className="text-xs text-navy-500">Usados nas entradas e saídas de estoque.</p>
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
                  className="input font-bold"
                  disabled={carregandoTurnos}
                  required
                />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className="label">Início</label>
                    <input
                      type="time"
                      value={turno.inicio}
                      onChange={(e) => updateTurno(index, 'inicio', e.target.value)}
                      className="input font-mono"
                      disabled={carregandoTurnos}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Fim</label>
                    <input
                      type="time"
                      value={turno.fim}
                      onChange={(e) => updateTurno(index, 'fim', e.target.value)}
                      className="input font-mono"
                      disabled={carregandoTurnos}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="submit" disabled={salvarTurnos.isPending || carregandoTurnos} className="btn-primary justify-center">
              <Save className="w-4 h-4" />
              {salvarTurnos.isPending ? 'Salvando...' : 'Salvar turnos'}
            </button>
          </div>
        </div>
      </form>

      <form
        onSubmit={(event) => { event.preventDefault(); setErro(''); setSucesso(''); salvarPermissoes.mutate(); }}
        className="card p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
          <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-navy-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-navy-800">Permissões por cargo</h2>
            <p className="text-xs text-navy-500">Admin sempre tem acesso total; marque os demais cargos autorizados.</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <PermissionGroup
            title="Cadastrar item"
            value={permissoes.cadastrar_item}
            perfis={permissoesData?.perfis || []}
            disabled={carregandoPermissoes}
            onToggle={(perfil) => togglePerfil('cadastrar_item', perfil)}
          />

          <div>
            <h3 className="text-sm font-bold text-navy-800 mb-3">Acesso por página</h3>
            <div className="overflow-x-auto rounded-md border border-surface-200">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="bg-surface-50 text-xs uppercase text-navy-400">
                  <tr>
                    <th className="p-3 text-left">Página</th>
                    {(permissoesData?.perfis || []).filter((perfil) => perfil !== 'admin').map((perfil) => (
                      <th key={perfil} className="p-3 text-center font-bold">{PERFIL_LABELS[perfil] || perfil}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 bg-white">
                  {PAGINAS_SISTEMA.map((pagina) => (
                    <tr key={pagina}>
                      <td className="p-3 font-semibold text-navy-700">{PAGINA_LABELS[pagina] || pagina}</td>
                      {(permissoesData?.perfis || []).filter((perfil) => perfil !== 'admin').map((perfil) => (
                        <td key={`${pagina}-${perfil}`} className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={(permissoes.paginas?.[pagina] || []).includes(perfil)}
                            disabled={carregandoPermissoes}
                            onChange={() => togglePaginaPerfil(pagina, perfil)}
                            className="h-4 w-4 rounded border-surface-300 text-navy-700 focus:ring-navy-500"
                            aria-label={`${PAGINA_LABELS[pagina] || pagina} para ${PERFIL_LABELS[perfil] || perfil}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-navy-500 mt-2">Admin sempre acessa todas as páginas, mesmo quando não aparece na matriz.</p>
          </div>
          <PermissionGroup
            title="Editar curva ABC"
            value={permissoes.editar_curva_abc}
            perfis={permissoesData?.perfis || []}
            disabled={carregandoPermissoes}
            onToggle={(perfil) => togglePerfil('editar_curva_abc', perfil)}
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="submit" disabled={salvarPermissoes.isPending || carregandoPermissoes} className="btn-primary justify-center">
              <Save className="w-4 h-4" />
              {salvarPermissoes.isPending ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      </form>

      {isAdmin && <GerenciarCategorias />}
    </div>
  );
};

const formatPerfis = (perfis = []) => {
  if (!perfis.length) return 'Admin';
  return perfis.map((perfil) => PERFIL_LABELS[perfil] || perfil).join(', ');
};

const FluxoCompraPreview = ({ form, tetoSupervisor }) => {
  const steps = [
    {
      icon: ClipboardList,
      title: 'Solicitação',
      status: 'Novo pedido',
      owner: formatPerfis(form.solicitantes),
      note: 'Abre a necessidade de compra.',
    },
    {
      icon: ShieldCheck,
      title: 'Supervisor',
      status: `Teto ${formatMoney(tetoSupervisor)}`,
      owner: formatPerfis(form.aprovadores_nivel_1),
      note: 'Aprova ou escala para gerente.',
    },
    {
      icon: ShieldCheck,
      title: 'Gerente op.',
      status: 'Se exceder teto',
      owner: formatPerfis(form.aprovadores_nivel_2),
      note: 'Aprova pedido escalado.',
    },
    {
      icon: ShoppingCart,
      title: 'Comprador',
      status: 'OC externa',
      owner: formatPerfis(form.compradores),
      note: 'Registra o número da OC.',
    },
    {
      icon: Truck,
      title: 'Aguardando chegada',
      status: 'Em aberto',
      owner: formatPerfis(form.compradores),
      note: 'Pedido comprado, aguardando entrega.',
    },
    {
      icon: FileCheck2,
      title: 'Concluído',
      status: 'NF registrada',
      owner: formatPerfis(form.recebedores),
      note: 'Comprador ou facilitador informa a NF.',
    },
  ];

  return (
    <div className="rounded-md border border-surface-200 bg-white p-3">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {steps.map((step, index) => (
          <div key={step.title} className="relative rounded-md border border-surface-200 bg-surface-50 p-3 min-h-[150px]">
            <div className="flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded bg-white border border-surface-200 flex items-center justify-center">
                <step.icon className="w-4 h-4 text-navy-700" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{step.status}</span>
            </div>
            <h3 className="mt-3 text-sm font-black text-navy-800">{step.title}</h3>
            <p className="mt-1 text-xs text-navy-500">{step.note}</p>
            <p className="mt-3 text-xs font-semibold text-navy-700 line-clamp-2">{step.owner}</p>
            {index < steps.length - 1 && (
              <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-surface-200 items-center justify-center">
                <ArrowRight className="w-4 h-4 text-navy-300" />
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
    <h3 className="text-sm font-bold text-navy-800 mb-3">{title}</h3>
    {description && <p className="text-xs text-navy-500 -mt-2 mb-3">{description}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {perfis.filter((perfil) => perfil !== 'admin').map((perfil) => (
        <label key={perfil} className="flex items-center gap-2 rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={value.includes(perfil)}
            disabled={disabled}
            onChange={() => onToggle(perfil)}
            className="h-4 w-4 rounded border-surface-300 text-navy-700 focus:ring-navy-500"
          />
          <span>{PERFIL_LABELS[perfil] || perfil}</span>
        </label>
      ))}
    </div>
  </div>
);

const GerenciarCategorias = () => {
  const queryClient = useQueryClient();
  const [novaCategoria, setNovaCategoria] = useState({ nome: '', descricao: '', cor_hex: 'CBD5E1' });
  const [erro, setErro] = useState('');

  const { data: categorias, isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias')).data,
  });

  const criarCategoria = useMutation({
    mutationFn: (cat) => api.post('/categorias', cat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setNovaCategoria({ nome: '', descricao: '', cor_hex: 'CBD5E1' });
      setErro('');
    },
    onError: (e) => setErro(e.message || 'Erro ao criar categoria'),
  });

  const excluirCategoria = useMutation({
    mutationFn: (id) => api.delete(`/categorias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setErro('');
    },
    onError: (e) => setErro(e.message || 'Erro ao excluir categoria. Ela pode ter produtos vinculados.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!novaCategoria.nome.trim()) return;
    criarCategoria.mutate({
      ...novaCategoria,
      cor_hex: novaCategoria.cor_hex.replace('#', ''),
    });
  };

  return (
    <div className="card p-0 overflow-hidden mt-6">
      <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
        <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-navy-700" />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-navy-800">Categorias de Produtos</h2>
          <p className="text-xs text-navy-500">Adicione e remova categorias (ex: elétrico, hidráulico, mecânico).</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="label">Nome da categoria</label>
            <input
              type="text"
              value={novaCategoria.nome}
              onChange={(e) => setNovaCategoria({ ...novaCategoria, nome: e.target.value })}
              className="input"
              placeholder="Ex: Mecânico"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="label">Cor (Hex)</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={`#${novaCategoria.cor_hex.replace('#', '')}`}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, cor_hex: e.target.value.replace('#', '').toUpperCase() })}
                className="h-9 w-12 p-0 border-0 rounded cursor-pointer"
              />
              <input
                type="text"
                value={novaCategoria.cor_hex}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, cor_hex: e.target.value.replace('#', '').toUpperCase() })}
                className="input font-mono uppercase"
                placeholder="CBD5E1"
                maxLength={6}
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <button type="submit" disabled={criarCategoria.isPending || !novaCategoria.nome} className="btn-primary w-full justify-center min-h-9">
              <Save className="w-4 h-4" />
              {criarCategoria.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>

        <div className="mt-6 border border-surface-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-xs uppercase text-navy-400 border-b border-surface-200">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Cor</th>
                <th className="p-3 w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr><td colSpan="3" className="p-4 text-center text-navy-400">Carregando...</td></tr>
              ) : categorias?.length === 0 ? (
                <tr><td colSpan="3" className="p-4 text-center text-navy-400">Nenhuma categoria cadastrada.</td></tr>
              ) : (
                categorias?.map((cat) => (
                  <tr key={cat.id}>
                    <td className="p-3 font-semibold text-navy-700">{cat.nome}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-mono text-xs text-navy-500">
                        <div className="w-4 h-4 rounded-full border border-surface-200" style={{ backgroundColor: `#${cat.cor_hex}` }} />
                        #{cat.cor_hex}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => excluirCategoria.mutate(cat.id)}
                        disabled={excluirCategoria.isPending}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Excluir"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export { Configuracoes as default, GerenciarCategorias };
