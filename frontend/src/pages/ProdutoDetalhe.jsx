import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, AlertTriangle, Clock3, Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import KanbanBar from '../components/kanban/KanbanBar';
import KanbanSawtoothChart from '../components/kanban/KanbanSawtoothChart';
import FaixaBadge from '../components/kanban/FaixaBadge';
import FormulaCard from '../components/kanban/FormulaCard';
import ConsumptionChart from '../components/charts/ConsumptionChart';
import { formatMoney, formatNumber } from '../utils/formatters';
import { invalidateOperationalData } from '../utils/queryInvalidation';

// ─── ErrorBoundary para proteger tabs de crash ────────────────────────────
class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[TabErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-10 text-center gap-3">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="font-bold text-steel-700">Erro ao carregar esta seção</p>
          <p className="text-sm text-steel-400 max-w-md">
            {this.state.error?.message || 'Ocorreu um erro inesperado. Recarregue a página ou entre em contato com o suporte.'}
          </p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-secondary text-sm mt-2">Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helpers seguros para evitar crash em valores nulos
const safe = (v, decimals = 4) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(decimals);
};

const ProdutoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
  const [activeTab, setActiveTab] = useState('kanban');
  const [chartZoom, setChartZoom] = useState('todos');
  const [abcDraft, setAbcDraft] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [fornecedorForm, setFornecedorForm] = useState({
    fornecedor_id: '',
    prioridade: '',
    preco_acordado: '',
    lead_time_nominal_dias: '',
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias')).data,
  });

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: async () => {
      const res = await api.get(`/produtos/${id}`);
      return res.data;
    },
  });

  const { data: rastreamento, isLoading: loadingRastreamento } = useQuery({
    queryKey: ['produto', id, 'rastreamento'],
    queryFn: async () => {
      const res = await api.get(`/produtos/${id}/rastreamento-calculo`);
      return res.data;
    },
    enabled: !!produto && activeTab === 'rastreamento',
    retry: false,
  });

  const { data: permissoes } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });

  const salvarAbc = useMutation({
    mutationFn: (classificacao_abc) => api.patch(`/produtos/${id}/classificacao-abc`, { classificacao_abc }),
    onSuccess: () => invalidateOperationalData(queryClient, id),
  });

  // Dados dos fornecedores vinculados ao produto
  const { data: fornecedoresVinculados } = useQuery({
    queryKey: ['produto', id, 'fornecedores'],
    queryFn: async () => {
      try {
        const res = await api.get(`/produtos/${id}/fornecedores`);
        return res.data;
      } catch { return produto?.fornecedores || []; }
    },
    enabled: !!produto && activeTab === 'fornecedores',
  });

  const { data: fornecedoresCatalogo } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const res = await api.get('/fornecedores');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    enabled: !!produto && activeTab === 'fornecedores',
  });

  const fornecedoresDisponiveis = useMemo(() => {
    const vinculados = new Set((fornecedoresVinculados || []).map((f) => f.fornecedor_id));
    return (fornecedoresCatalogo || []).filter((f) => !vinculados.has(f.id));
  }, [fornecedoresCatalogo, fornecedoresVinculados]);

  const adicionarFornecedor = useMutation({
    mutationFn: () => api.post(`/produtos/${id}/fornecedores`, {
      fornecedor_id: fornecedorForm.fornecedor_id,
      prioridade: fornecedorForm.prioridade ? Number(fornecedorForm.prioridade) : ((fornecedoresVinculados?.length || 0) + 1),
      preco_acordado: fornecedorForm.preco_acordado ? Number(fornecedorForm.preco_acordado) : undefined,
      lead_time_nominal_dias: fornecedorForm.lead_time_nominal_dias ? Number(fornecedorForm.lead_time_nominal_dias) : undefined,
    }),
    onSuccess: () => {
      setFornecedorForm({ fornecedor_id: '', prioridade: '', preco_acordado: '', lead_time_nominal_dias: '' });
      invalidateOperationalData(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['produto', id, 'fornecedores'] });
    },
  });

  const removerFornecedor = useMutation({
    mutationFn: (fornecedorId) => api.delete(`/produtos/${id}/fornecedores/${fornecedorId}`),
    onSuccess: () => {
      invalidateOperationalData(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['produto', id, 'fornecedores'] });
    },
  });

  // Historico para o gráfico linear interativo.
  const historicoSerrote = useMemo(() => {
    if (!produto?.ultimas_movimentacoes?.length) return [];
    const movs = [...(produto.ultimas_movimentacoes || [])].reverse();
    return movs.map(m => ({
      data: m.criado_em,
      estoque: parseFloat(m.estoque_depois),
      evento: `${m.tipo} - ${formatNumber(m.quantidade)} ${produto.unidade}`,
    }));
  }, [produto]);

  const historicoGrafico = useMemo(() => {
    if (chartZoom === 'todos') return historicoSerrote;
    const now = Date.now();
    const days = chartZoom === 'dia' ? 1 : 7;
    return historicoSerrote.filter((p) => now - new Date(p.data).getTime() <= days * 86400000);
  }, [chartZoom, historicoSerrote]);

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando detalhes do produto...</div>;
  if (!produto) return <div className="p-8 text-center text-red-500">Produto não encontrado.</div>;

  const cmd = parseFloat(produto.demanda_diaria_media) || 0;
  const lt = parseFloat(produto.lead_time_previsto_dias) || 0;
  const es = parseFloat(produto.estoque_seguranca) || 0;
  const pr = parseFloat(produto.ponto_reposicao) || 0;
  const emax = parseFloat(produto.estoque_maximo) || 0;
  const estoqueAtual = parseFloat(produto.estoque_atual) || 0;
  const diasEstoqueRestante = cmd > 0 ? Math.round((estoqueAtual / cmd) * 10) / 10 : null;
  const diasAteReposicao = cmd > 0 && pr > 0 ? Math.max(0, Math.round(((estoqueAtual - pr) / cmd) * 10) / 10) : null;
  const emaxDias = cmd > 0 && emax > 0 ? Math.round((emax / cmd) * 10) / 10 : null;
  const tempoTone = diasEstoqueRestante === null
    ? 'border-surface-200 bg-surface-50 text-steel-700'
    : estoqueAtual <= es
      ? 'border-red-200 bg-red-50 text-red-800'
      : estoqueAtual <= pr
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  const podeEditarAbc = user?.perfil === 'admin' || (permissoes?.editar_curva_abc || ['eng_producao']).includes(user?.perfil);
  const abcValue = abcDraft || produto.classificacao_abc || '';

  const temDadosKanban = emax > 0 && pr > 0;

  const TABS = [
    { key: 'kanban', label: 'Kanban' },
    { key: 'grafico', label: 'Gráfico linear' },
    { key: 'rastreamento', label: 'Rastreamento Matemático' },
    { key: 'movimentacoes', label: 'Movimentações' },
    { key: 'fornecedores', label: 'Fornecedores' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 mb-2">
        <Link to="/produtos" className="p-2 rounded-lg hover:bg-surface-200 text-steel-500 transition-colors self-start">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-steel-800 break-words">{produto.nome}</h1>
            <FaixaBadge faixa={produto.faixa_atual} />
          </div>
          <p className="text-steel-400 text-sm font-mono mt-1">CÓD: {produto.codigo} | CAT: {produto.categoria_nome}</p>
        </div>
        <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
          {isAdmin && (
            <button className="btn-secondary justify-center border-accent text-accent hover:bg-red-50" onClick={() => setEditModalOpen(true)}>
              Editar Produto
            </button>
          )}
          <button className="btn-secondary justify-center" onClick={() => navigate(`/movimentacoes?produto_id=${id}`)}>Lançar movimentação</button>
          <button className="btn-primary justify-center" onClick={() => navigate(`/pedidos?produto_id=${id}`)}>Emitir Pedido</button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
          <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
            <p className="text-sm text-steel-500 font-medium mb-1">Estoque Atual</p>
            <div className="text-3xl font-bold text-steel-800">{formatNumber(produto.estoque_atual)} <span className="text-base font-normal text-steel-400">{produto.unidade}</span></div>
          </div>
          <div className={`p-4 rounded-lg border ${tempoTone}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-bold">Tempo restante</p>
              <Clock3 className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-black leading-none">
              {diasEstoqueRestante !== null ? formatNumber(diasEstoqueRestante) : '--'}
              <span className="text-sm font-bold ml-1">dias</span>
            </div>
            <p className="text-xs mt-2 opacity-80">
              {diasAteReposicao !== null
                ? (diasAteReposicao > 0 ? `${formatNumber(diasAteReposicao)} dias até o PR` : 'No ponto de reposição ou abaixo')
                : 'Informe CMD para calcular'}
            </p>
          </div>
          <div>
            <p className="text-sm text-steel-500 font-medium mb-1">Preço de Compra</p>
            <div className="text-xl font-bold text-steel-700">{formatMoney(produto.custo_unitario)}</div>
          </div>
          <div>
            <p className="text-sm text-steel-500 font-medium mb-1">Classificação ABC</p>
            {podeEditarAbc ? (
              <div className="flex items-center gap-2">
                <select
                  className="input max-w-[120px]"
                  value={abcValue}
                  onChange={(e) => setAbcDraft(e.target.value)}
                >
                  <option value="">-</option>
                  <option value="A">Curva A</option>
                  <option value="B">Curva B</option>
                  <option value="C">Curva C</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary px-3"
                  disabled={!abcValue || abcValue === produto.classificacao_abc || salvarAbc.isPending}
                  onClick={() => salvarAbc.mutate(abcValue)}
                  title="Salvar curva ABC"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-xl font-bold text-steel-700">Curva {produto.classificacao_abc || '-'}</div>
            )}
          </div>
          <div>
            <p className="text-sm text-steel-500 font-medium mb-1">Localização</p>
            <div className="text-xl font-bold text-steel-700">{produto.localizacao || 'Não definida'}</div>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-bold text-steel-800 mb-4 uppercase tracking-wider">Régua Kanban</h3>
          <KanbanBar
            estoqueAtual={parseFloat(produto.estoque_atual)}
            es={es} pr={pr} emax={emax}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-navy-700 text-steel-800'
                  : 'border-transparent text-steel-400 hover:text-steel-600 hover:border-surface-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <TabErrorBoundary key={activeTab}>
        <div className="pt-2">

          {/* ── Aba Kanban ── */}
          {activeTab === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormulaCard
                title="Estoque de Segurança (ES)"
                value={formatNumber(produto.estoque_seguranca)}
                formula="Z x raiz(LT x sigma_d^2 + d^2 x sigma_LT^2)"
                tooltip={`Z(${produto.nivel_servico}%) = ${safe(produto.fator_z, 2)}, sigma demanda = ${safe(produto.sigma_demanda_diaria, 2)}, sigma LT = ${safe(produto.sigma_lead_time, 2)}`}
              />
              <FormulaCard
                title="Ponto de Reposição (PR)"
                value={formatNumber(produto.ponto_reposicao)}
                formula="(CMD × LT) + ES"
                tooltip={`Consumo diário = ${safe(produto.demanda_diaria_media, 2)}, Lead time = ${safe(produto.lead_time_previsto_dias, 1)} dias`}
              />
              <FormulaCard
                title="Lote Econômico (EOQ)"
                value={formatNumber(produto.eoq)}
                formula="√((2 × D × Cp) / H)"
                tooltip={`Cp = ${formatMoney(produto.custo_pedido)}, H (custo manter) = ${(parseFloat(produto.taxa_carregamento || 0) * 100).toFixed(0)}%`}
              />
              <FormulaCard
                title="Estoque Máximo (Emax)"
                value={formatNumber(produto.estoque_maximo)}
                formula="ES + EOQ"
                tooltip={emaxDias !== null
                  ? `Equivale a aproximadamente ${emaxDias} dias no CMD atual. Dias = Emax / CMD.`
                  : 'Dias de cobertura aparecem quando houver CMD calculado ou informado.'}
              />
            </div>
          )}

          {/* Grafico linear interativo */}
          {activeTab === 'grafico' && (
            <div className="space-y-4">
              {temDadosKanban ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-steel-800">Ciclo de reposição Kanban</h3>
                      <p className="text-sm text-steel-400 mt-0.5">
                        {historicoSerrote.length > 0
                          ? 'Historico real por data e hora + ciclos estimados com tooltip por ponto'
                          : 'Ciclos estimados com base nos parametros calculados'}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-xs text-steel-400">
                      <div>CMD: <strong>{safe(produto.demanda_diaria_media, 2)}/dia</strong></div>
                      <div>LT: <strong>{safe(produto.lead_time_previsto_dias, 0)} dias</strong></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['todos', 'Todo histórico'],
                      ['7d', 'Ultimos 7 dias'],
                      ['dia', 'Zoom do dia'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setChartZoom(value)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                          chartZoom === value
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-surface-200 text-steel-600 hover:bg-surface-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <KanbanSawtoothChart
                    cmd={cmd} leadTime={lt} es={es} pr={pr} emax={emax}
                    ciclos={6}
                    historico={historicoGrafico}
                    height={280}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
                  <div className="text-4xl">📊</div>
                  <p className="font-bold text-steel-700">Parâmetros Kanban ainda não calculados</p>
                  <p className="text-sm text-steel-400 max-w-md">
                    O gráfico de ciclos será exibido após o sistema calcular ES, PR e EOQ a partir das movimentações e pedidos deste produto.
                    Registre pelo menos algumas semanas de movimentação para o modelo estatístico entrar em ação.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Rastreamento Matemático ── */}
          {activeTab === 'rastreamento' && (
            <div className="space-y-6">
              {loadingRastreamento && (
                <div className="p-8 text-center text-steel-400 animate-pulse">Carregando dados de rastreamento...</div>
              )}
              {!loadingRastreamento && !rastreamento && (
                <div className="flex flex-col items-center justify-center p-10 text-center gap-3">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <p className="font-bold text-steel-700">Dados insuficientes para rastreamento</p>
                  <p className="text-sm text-steel-400 max-w-md">
                    O rastreamento matemático requer pelo menos 4 semanas de movimentações e 2 pedidos recebidos.
                    Registre movimentações de saída regularmente para o modelo Holt-Winters e a Regressão Linear entrarem em ação.
                  </p>
                </div>
              )}
              {!loadingRastreamento && rastreamento && (
                <div className="card p-5 bg-surface-50 border-dashed">
                  <h3 className="font-bold text-steel-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-steel-400" />
                    Auditoria de Cálculos Preditivos
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-bold text-steel-600 mb-2 border-b border-surface-200 pb-2">
                        Suavização Exponencial Dupla de Holt (Demanda)
                      </h4>
                      <ul className="text-sm text-steel-700 space-y-2 font-mono bg-white p-4 rounded border border-surface-200">
                        <li>α (Nível) = {safe(rastreamento?.holt_outputs?.alpha)}</li>
                        <li>β (Tendência) = {safe(rastreamento?.holt_outputs?.beta)}</li>
                        <li>Previsão Semana (F_t+1) = {safe(rastreamento?.holt_outputs?.forecast)}</li>
                        <li>Desvio Padrão (σ_res) = {safe(rastreamento?.holt_outputs?.sigma)}</li>
                        <li className="pt-2 mt-2 border-t border-surface-100 font-bold text-steel-800">
                          Demanda Diária Média = {safe(rastreamento?.holt_outputs?.forecast ? rastreamento.holt_outputs.forecast / 7 : null)}
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-steel-600 mb-2 border-b border-surface-200 pb-2">
                        Regressão Linear (Lead Time)
                      </h4>
                      <ul className="text-sm text-steel-700 space-y-2 font-mono bg-white p-4 rounded border border-surface-200">
                        <li>Intercepto (a) = {safe(rastreamento?.regressao_outputs?.intercepto)}</li>
                        <li>Inclinação (b) = {safe(rastreamento?.regressao_outputs?.inclinacao)}</li>
                        <li>R² = {safe(rastreamento?.regressao_outputs?.r2)}</li>
                        <li>Desvio Padrão (σ_LT) = {safe(rastreamento?.regressao_outputs?.sigma)}</li>
                        <li className="pt-2 mt-2 border-t border-surface-100 font-bold text-steel-800">
                          LT Previsto = {safe(rastreamento?.regressao_outputs?.previsao)} dias
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Movimentações ── */}
          {activeTab === 'movimentacoes' && (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-left">
                <thead className="bg-surface-50 border-b border-surface-200">
                  <tr className="text-xs font-bold text-steel-500 uppercase tracking-wider">
                    <th className="p-4">Data</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-right">Qtd</th>
                    <th className="p-4 text-right">Estoque Após</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {produto.ultimas_movimentacoes?.length > 0 ? (
                    produto.ultimas_movimentacoes.map(m => (
                      <tr key={m.id} className="hover:bg-surface-50">
                        <td className="p-4 text-sm text-steel-600">
                          {new Date(m.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          {m.turno && <div className="text-xs text-steel-400">{m.turno.replace('TURNO_', 'Turno ')}</div>}
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            ['ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCAO'].includes(m.tipo)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-bold text-steel-700 text-right">{formatNumber(m.quantidade)}</td>
                        <td className="p-4 text-sm text-steel-600 text-right">{formatNumber(m.estoque_depois)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" className="p-8 text-center text-steel-400">Nenhuma movimentação registrada.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── Aba Fornecedores ── */}
          {activeTab === 'fornecedores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-steel-800">Fornecedores vinculados</h3>
              </div>
              <form
                onSubmit={(event) => { event.preventDefault(); if (fornecedorForm.fornecedor_id) adicionarFornecedor.mutate(); }}
                className="card p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="label">Adicionar fornecedor</label>
                  <select
                    className="input"
                    value={fornecedorForm.fornecedor_id}
                    onChange={(e) => setFornecedorForm((f) => ({ ...f, fornecedor_id: e.target.value }))}
                  >
                    <option value="">Selecionar</option>
                    {fornecedoresDisponiveis.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Prioridade</label>
                  <input
                    className="input font-mono"
                    type="number"
                    min="1"
                    placeholder={`${(fornecedoresVinculados?.length || 0) + 1}`}
                    value={fornecedorForm.prioridade}
                    onChange={(e) => setFornecedorForm((f) => ({ ...f, prioridade: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Preco</label>
                  <input
                    className="input font-mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={fornecedorForm.preco_acordado}
                    onChange={(e) => setFornecedorForm((f) => ({ ...f, preco_acordado: e.target.value }))}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={!fornecedorForm.fornecedor_id || adicionarFornecedor.isPending}
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Lead time (dias)</label>
                  <input
                    className="input font-mono"
                    type="number"
                    min="0"
                    step="1"
                    value={fornecedorForm.lead_time_nominal_dias}
                    onChange={(e) => setFornecedorForm((f) => ({ ...f, lead_time_nominal_dias: e.target.value }))}
                  />
                </div>
                <p className="sm:col-span-3 text-xs text-steel-500">
                  Prioridade 1 é o fornecedor principal; 2, 3, 4... são secundários usados como alternativas de compra.
                </p>
              </form>
              {!fornecedoresVinculados || fornecedoresVinculados.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center gap-3 card">
                  <div className="text-4xl">🏭</div>
                  <p className="font-bold text-steel-700">Nenhum fornecedor vinculado</p>
                  <p className="text-sm text-steel-400 max-w-sm">
                    Vincule um fornecedor para que o sistema possa gerar pedidos automaticamente quando o estoque atingir o Ponto de Reposição.
                  </p>
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-left">
                    <thead className="bg-surface-50 border-b border-surface-200">
                      <tr className="text-xs font-bold text-steel-500 uppercase tracking-wider">
                        <th className="p-4">Fornecedor</th>
                        <th className="p-4">Prioridade</th>
                        <th className="p-4 text-right">Preço acordado</th>
                        <th className="p-4 text-right">Lead time</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {(Array.isArray(fornecedoresVinculados) ? fornecedoresVinculados : []).map((fv, i) => {
                        const fvId = fv.fornecedor_id || fv.id;
                        return (
                          <tr key={i} className="hover:bg-surface-50">
                            <td className="p-4">
                              <div className="font-bold text-steel-800">{fv.fornecedor_nome || fv.nome}</div>
                              {fv.cnpj && <div className="text-xs text-steel-400">{fv.cnpj}</div>}
                            </td>
                            <td className="p-4">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${fv.prioridade === 1 ? 'bg-red-100 text-red-800' : 'bg-surface-100 text-steel-500'}`}>
                                {fv.prioridade === 1 ? '★ Principal' : `#${fv.prioridade}`}
                              </span>
                            </td>
                            <td className="p-4 text-right font-medium text-steel-700">
                              {fv.preco_acordado ? formatMoney(fv.preco_acordado) : '—'}
                            </td>
                            <td className="p-4 text-right text-steel-600">
                              {fv.lead_time_nominal_dias ? `${fv.lead_time_nominal_dias} dias` : '—'}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${fv.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {fv.ativo !== false ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFornecedorForm({
                                      fornecedor_id: fvId,
                                      prioridade: fv.prioridade || '',
                                      preco_acordado: fv.preco_acordado || '',
                                      lead_time_nominal_dias: fv.lead_time_nominal_dias || '',
                                    });
                                  }}
                                  className="p-1.5 text-steel-400 hover:text-accent hover:bg-red-50 rounded transition-colors"
                                  title="Editar parâmetros deste fornecedor"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Desvincular o fornecedor "${fv.fornecedor_nome || fv.nome}" deste produto?`)) {
                                      removerFornecedor.mutate(fvId);
                                    }
                                  }}
                                  disabled={removerFornecedor.isPending}
                                  className="p-1.5 text-steel-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remover / Desvincular fornecedor"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </TabErrorBoundary>

      {editModalOpen && (
        <AdminProdutoEditModal
          produto={produto}
          categorias={categorias}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Modal Exclusivo Admin: Editar Produto Completo ───────────────────────────
const AdminProdutoEditModal = ({ produto, categorias, onClose }) => {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    codigo: produto.codigo || '',
    sku: produto.sku || '',
    nome: produto.nome || '',
    descricao: produto.descricao || '',
    categoria_id: produto.categoria_id || '',
    unidade: produto.unidade || 'UN',
    custo_unitario: produto.custo_unitario != null ? produto.custo_unitario : '',
    custo_pedido: produto.custo_pedido != null ? produto.custo_pedido : '',
    taxa_carregamento: produto.taxa_carregamento != null ? produto.taxa_carregamento : '',
    nivel_servico: produto.nivel_servico || '95',
    localizacao: produto.localizacao || '',
    estoque_atual: produto.estoque_atual != null ? produto.estoque_atual : '',
    estoque_minimo: produto.estoque_minimo != null ? produto.estoque_minimo : '',
    estoque_maximo: produto.estoque_maximo != null ? produto.estoque_maximo : '',
    ponto_reposicao_manual: produto.ponto_reposicao_manual != null ? produto.ponto_reposicao_manual : '',
    lead_time_padrao_dias: produto.lead_time_padrao_dias != null ? produto.lead_time_padrao_dias : '',
    observacoes: produto.observacoes || '',
    ativo: produto.ativo !== false,
  });

  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const salvar = useMutation({
    mutationFn: async (dados) => {
      return (await api.patch(`/produtos/${produto.id}`, dados)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produto', produto.id] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      invalidateOperationalData(queryClient, produto.id);
      onClose();
    },
    onError: (e) => setErro(e.response?.data?.message || e.message || 'Erro ao salvar alterações'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');

    const payload = {
      ...form,
      custo_unitario: form.custo_unitario === '' ? null : parseFloat(form.custo_unitario),
      custo_pedido: form.custo_pedido === '' ? null : parseFloat(form.custo_pedido),
      taxa_carregamento: form.taxa_carregamento === '' ? null : parseFloat(form.taxa_carregamento),
      nivel_servico: parseInt(form.nivel_servico),
      estoque_atual: form.estoque_atual === '' ? null : parseFloat(form.estoque_atual),
      estoque_minimo: form.estoque_minimo === '' ? null : parseFloat(form.estoque_minimo),
      estoque_maximo: form.estoque_maximo === '' ? null : parseFloat(form.estoque_maximo),
      ponto_reposicao_manual: form.ponto_reposicao_manual === '' ? null : parseFloat(form.ponto_reposicao_manual),
      lead_time_padrao_dias: form.lead_time_padrao_dias === '' ? null : parseInt(form.lead_time_padrao_dias),
    };

    salvar.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay-enter">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col modal-spring-enter">
        <div className="p-5 border-b border-surface-200 flex justify-between items-center bg-surface-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-steel-800">Administração: Editar Produto</h2>
            <p className="text-xs text-steel-400 mt-0.5">Painel exclusivo para alteração manual de parâmetros operacionais e de estoque</p>
          </div>
          <button onClick={onClose} className="p-2 text-steel-400 hover:text-steel-600 hover:bg-surface-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{erro}
            </div>
          )}
          <form id="prod-admin-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Seção 1: Identificação */}
            <div>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1 border-b border-red-100">1. Identificação Geral</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Código *</label>
                  <input className="input font-mono w-full" value={form.codigo} onChange={e => f('codigo', e.target.value.toUpperCase())} required />
                </div>
                <div>
                  <label className="label">SKU</label>
                  <input className="input font-mono w-full" value={form.sku} onChange={e => f('sku', e.target.value)} />
                </div>
                <div>
                  <label className="label">Nome *</label>
                  <input className="input w-full" value={form.nome} onChange={e => f('nome', e.target.value)} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Categoria *</label>
                  <select className="input w-full" value={form.categoria_id} onChange={e => f('categoria_id', e.target.value)} required>
                    <option value="">Selecione uma categoria...</option>
                    {categorias?.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Unidade</label>
                  <select className="input w-full" value={form.unidade} onChange={e => f('unidade', e.target.value)}>
                    {['UN', 'MT', 'KG', 'LT', 'PC', 'CX', 'PA'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="label">Descrição</label>
                  <textarea className="input w-full resize-none" rows={2} value={form.descricao} onChange={e => f('descricao', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Seção 2: Estoques */}
            <div>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1 border-b border-red-100">2. Níveis de Estoque (Ajuste Manual)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="label">Estoque Atual</label>
                  <input type="number" step="0.0001" className="input font-mono w-full" value={form.estoque_atual} onChange={e => f('estoque_atual', e.target.value)} />
                </div>
                <div>
                  <label className="label">Estoque Mínimo</label>
                  <input type="number" step="0.0001" className="input font-mono w-full" value={form.estoque_minimo} onChange={e => f('estoque_minimo', e.target.value)} />
                </div>
                <div>
                  <label className="label">Estoque Máximo</label>
                  <input type="number" step="0.0001" className="input font-mono w-full" value={form.estoque_maximo} onChange={e => f('estoque_maximo', e.target.value)} />
                </div>
                <div>
                  <label className="label">PR Manual (Substitui Estatística)</label>
                  <input type="number" step="0.0001" className="input font-mono w-full" value={form.ponto_reposicao_manual} onChange={e => f('ponto_reposicao_manual', e.target.value)} placeholder="Automático se vazio" />
                </div>
              </div>
            </div>

            {/* Seção 3: Parâmetros Kanban */}
            <div>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1 border-b border-red-100">3. Parâmetros de Custos e Lead Time</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="label">Preço de compra (R$)</label>
                  <input type="number" step="0.01" className="input font-mono w-full" value={form.custo_unitario} onChange={e => f('custo_unitario', e.target.value)} />
                </div>
                <div>
                  <label className="label">Custo do Pedido (R$)</label>
                  <input type="number" step="0.01" className="input font-mono w-full" value={form.custo_pedido} onChange={e => f('custo_pedido', e.target.value)} />
                </div>
                <div>
                  <label className="label">Taxa de Carregamento</label>
                  <input type="number" step="0.01" min="0" max="1" className="input font-mono w-full" value={form.taxa_carregamento} onChange={e => f('taxa_carregamento', e.target.value)} />
                </div>
                <div>
                  <label className="label">Lead time padrão (dias)</label>
                  <input type="number" className="input font-mono w-full" value={form.lead_time_padrao_dias} onChange={e => f('lead_time_padrao_dias', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Nível de serviço desejado</label>
                  <select className="input w-full" value={form.nivel_servico} onChange={e => f('nivel_servico', e.target.value)}>
                    <option value="90">90% — Básico</option>
                    <option value="95">95% — Padrão industrial</option>
                    <option value="98">98% — Alta disponibilidade</option>
                    <option value="99">99% — Missão crítica</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Localização no estoque</label>
                  <input className="input w-full" value={form.localizacao} onChange={e => f('localizacao', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Seção 4: Outros */}
            <div>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1 border-b border-red-100">4. Status e Notas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 mt-6">
                  <input
                    type="checkbox"
                    id="chk-ativo"
                    checked={form.ativo}
                    onChange={e => f('ativo', e.target.checked)}
                    className="w-4 h-4 text-accent border-surface-300 rounded focus:ring-accent"
                  />
                  <label htmlFor="chk-ativo" className="text-sm font-semibold text-steel-700 cursor-pointer">Produto Ativo</label>
                </div>
                <div className="sm:col-span-3">
                  <label className="label">Observações Internas</label>
                  <textarea className="input w-full" rows={3} value={form.observacoes} onChange={e => f('observacoes', e.target.value)} placeholder="Notas internas..." />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-surface-200 flex justify-end gap-3 bg-surface-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="prod-admin-form" disabled={salvar.isPending} className="btn-primary">
            {salvar.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProdutoDetalhe;
