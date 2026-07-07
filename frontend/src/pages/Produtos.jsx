import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Download, X, Edit3, Trash2, HelpCircle } from 'lucide-react';
import api from '../services/api';
import FaixaBadge from '../components/kanban/FaixaBadge';
import KanbanSawtoothChart from '../components/kanban/KanbanSawtoothChart';
import { useAuthStore } from '../stores/authStore';
import { formatMoney, formatNumber } from '../utils/formatters';
import { invalidateOperationalData } from '../utils/queryInvalidation';

const PERFIS_GESTAO = ['admin', 'gerente_operacoes', 'supervisor_turno'];

// ─── Tooltip helper ────────────────────────────────────────────────────────
const Tooltip = ({ text }) => (
  <span className="relative group ml-1 cursor-help inline-flex">
    <HelpCircle className="w-3.5 h-3.5 text-steel-300 hover:text-steel-500 transition-colors" />
    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-navy-800 text-white text-xs rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
      {text}
    </span>
  </span>
);

const Label = ({ children, tooltip }) => (
  <label className="label flex items-center gap-0.5">
    {children}
    {tooltip && <Tooltip text={tooltip} />}
  </label>
);

const Produtos = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const podeGerir = PERFIS_GESTAO.includes(user?.perfil);
  const isAdmin = user?.perfil === 'admin';
  const { data: permissoes } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
  });
  const podeCadastrar = isAdmin || (permissoes?.cadastrar_item || ['comprador']).includes(user?.perfil);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [faixaFiltro, setFaixaFiltro] = useState('');
  const [openModal, setOpenModal] = useState(null); // null | { tipo, produto? }

  const desativar = useMutation({
    mutationFn: (id) => api.delete(`/produtos/${id}`),
    onSuccess: () => invalidateOperationalData(queryClient),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['produtos', page, busca, faixaFiltro],
    queryFn: async () => {
      const res = await api.get('/produtos', {
        params: { page, limit: 10, busca, faixa: faixaFiltro }
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const exportCSV = () => {
    if (!data?.data) return;
    const header = 'Codigo,Nome,Estoque,Faixa,PR,Custo\n';
    const csv = data.data.map(p =>
      `${p.codigo},"${p.nome}",${p.estoque_atual},${p.faixa_atual || 'SEM_DADOS'},${p.ponto_reposicao || 0},${p.custo_unitario}`
    ).join('\n');

    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produtos_kanban.csv';
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-steel-800 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-steel-400 text-sm mt-1">Gerencie os itens do estoque e acompanhe as faixas Kanban</p>
        </div>
        {podeCadastrar && (
          <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
            <button onClick={() => setOpenModal({ tipo: 'novo' })} className="btn-secondary w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" /> Cadastrar produto
            </button>
            <button onClick={() => setOpenModal({ tipo: 'insercao' })} className="btn-primary w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" /> Inserir item existente
            </button>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-steel-300" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              className="input-field pl-10"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-steel-400" />
            <select
              className="input-field w-full sm:w-44"
              value={faixaFiltro}
              onChange={e => { setFaixaFiltro(e.target.value); setPage(1); }}
            >
              <option value="">Todas as Faixas</option>
              <option value="VERMELHO">Vermelho (Crítico)</option>
              <option value="AMARELO">Amarelo (Atenção)</option>
              <option value="VERDE">Verde (Normal)</option>
              <option value="SEM_DADOS">Sem Dados</option>
            </select>
          </div>

          <button onClick={exportCSV} className="btn-secondary whitespace-nowrap justify-center w-full sm:w-auto">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        <div className="grid gap-3 md:hidden">
          {isLoading ? (
            <div className="p-6 text-center text-steel-400 bg-surface-50 rounded-lg">Carregando...</div>
          ) : data?.data?.length === 0 ? (
            <div className="p-6 text-center text-steel-400 bg-surface-50 rounded-lg">Nenhum produto encontrado.</div>
          ) : (
            data?.data.map((produto) => (
              <article key={produto.id} className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-steel-400">{produto.codigo}</p>
                    <h2 className="font-bold text-steel-800 break-words">{produto.nome}</h2>
                    <p className="text-xs text-steel-400 mt-0.5">{produto.categoria_nome}</p>
                  </div>
                  <FaixaBadge faixa={produto.faixa_atual} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-xs text-steel-400">Estoque</p>
                    <p className="font-bold text-steel-700">{formatNumber(produto.estoque_atual)} {produto.unidade}</p>
                  </div>
                  <div>
                    <p className="text-xs text-steel-400">PR</p>
                    <p className="font-bold text-steel-700">{formatNumber(produto.ponto_reposicao) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-steel-400">Custo un.</p>
                    <p className="font-bold text-steel-700">{formatMoney(produto.custo_unitario)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 mt-4">
                  <Link to={`/produtos/${produto.id}`} className="btn-secondary justify-center">
                    Detalhes
                  </Link>
                  {podeGerir && (
                    <button onClick={() => setOpenModal({ tipo: 'editar', produto })} className="btn-secondary justify-center">
                      <Edit3 className="w-4 h-4" /> Editar
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { if (confirm(`Desativar ${produto.codigo}?`)) desativar.mutate(produto.id); }} className="btn-danger justify-center">
                      <Trash2 className="w-4 h-4" /> Desativar
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        {/* Tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-200 text-xs font-bold text-steel-400 uppercase tracking-wider">
                <th className="p-4">Código</th>
                <th className="p-4">Produto</th>
                <th className="p-4 text-right">Estoque</th>
                <th className="p-4 text-center">Faixa Kanban</th>
                <th className="p-4 text-right">PR</th>
                <th className="p-4 text-right">Custo Un.</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-steel-400">Carregando...</td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-steel-400">Nenhum produto encontrado.</td>
                </tr>
              ) : (
                data?.data.map((produto) => {
                  let rowColor = '';
                  if (produto.faixa_atual === 'VERMELHO') rowColor = 'bg-red-50/30';
                  else if (produto.faixa_atual === 'AMARELO') rowColor = 'bg-amber-50/30';

                  return (
                    <tr key={produto.id} className={`hover:bg-surface-50 transition-colors ${rowColor}`}>
                      <td className="p-4 font-mono text-sm text-steel-700">{produto.codigo}</td>
                      <td className="p-4">
                        <div className="font-bold text-steel-800">{produto.nome}</div>
                        <div className="text-xs text-steel-400">{produto.categoria_nome}</div>
                      </td>
                      <td className="p-4 text-right font-bold text-steel-700">
                        {formatNumber(produto.estoque_atual)} {produto.unidade}
                      </td>
                      <td className="p-4 text-center">
                        <FaixaBadge faixa={produto.faixa_atual} />
                      </td>
                      <td className="p-4 text-right text-steel-600 font-medium">
                        {formatNumber(produto.ponto_reposicao) || '-'}
                      </td>
                      <td className="p-4 text-right text-steel-600">
                        {formatMoney(produto.custo_unitario)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/produtos/${produto.id}`} className="text-steel-500 hover:text-steel-800 font-medium text-sm px-2">
                            Detalhes
                          </Link>
                          {podeGerir && (
                            <button onClick={() => setOpenModal({ tipo: 'editar', produto })} className="p-1.5 text-steel-500 hover:bg-navy-50 rounded" title="Editar"><Edit3 className="w-4 h-4" /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { if (confirm(`Desativar ${produto.codigo}?`)) desativar.mutate(produto.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Desativar"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-4">
            <span className="text-sm text-steel-500">
              Página <span className="font-bold">{data.page}</span> de <span className="font-bold">{data.totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <button className="btn-secondary" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {openModal && <ProdutoModal produto={openModal.produto || null} modo={openModal.tipo} onClose={() => setOpenModal(null)} />}
    </div>
  );
};

// ─── Modal: Criar/Editar Produto ───────────────────────────────────────────
const ProdutoModal = ({ produto, modo = 'novo', onClose }) => {
  const queryClient = useQueryClient();
  const isEdit = !!produto;
  const isInsercao = modo === 'insercao';

  const [form, setForm] = useState({
    codigo: produto?.codigo || '',
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    unidade: produto?.unidade || 'UN',
    custo_unitario: produto?.custo_unitario || '',
    custo_pedido: produto?.custo_pedido || 100,
    taxa_carregamento: produto?.taxa_carregamento || 0.20,
    nivel_servico: produto?.nivel_servico || 95,
    localizacao: produto?.localizacao || '',
    category: produto?.category || 'product_direct',
    // Parâmetros iniciais Kanban (só no cadastro)
    cmd_inicial: '',
    lead_time_inicial: '',
    estoque_inicial: '',
    turno_inicial: '',
    documento_inicial: '',
    // Fornecedor principal (só no cadastro)
    fornecedor_id: '',
    preco_acordado_fornecedor: '',
    lead_time_fornecedor: '',
  });
  const { data: turnosData, isLoading: carregandoTurnos } = useQuery({
    queryKey: ['configuracoes', 'turnos'],
    queryFn: async () => (await api.get('/configuracoes/turnos')).data,
  });
  const turnos = turnosData?.turnos || [];

  const [erro, setErro] = useState('');

  const { data: kanbanDefaults } = useQuery({
    queryKey: ['configuracoes', 'kanban'],
    queryFn: async () => (await api.get('/configuracoes/kanban')).data,
    enabled: !isEdit,
  });

  useEffect(() => {
    if (!isEdit && kanbanDefaults) {
      setForm((prev) => ({
        ...prev,
        nivel_servico: kanbanDefaults.nivel_servico_padrao ?? prev.nivel_servico,
        taxa_carregamento: kanbanDefaults.taxa_carregamento_padrao ?? prev.taxa_carregamento,
      }));
    }
  }, [isEdit, kanbanDefaults]);

  // Cálculo automático dos parâmetros Kanban para o gráfico
  const kanbanPreview = useMemo(() => {
    const cmd = parseFloat(form.cmd_inicial) || 0;
    const lt = parseFloat(form.lead_time_inicial) || 0;
    const z = { 90: 1.2816, 95: 1.6449, 98: 1.8808, 99: 2.3263 }[parseInt(form.nivel_servico)] || 1.6449;
    const tc = parseFloat(form.taxa_carregamento) || 0.2;
    const cp = parseFloat(form.custo_pedido) || 100;
    const cu = parseFloat(form.custo_unitario) || 0;

    if (cmd <= 0 || lt <= 0 || cu <= 0) return null;

    const demandaAnual = cmd * 365;
    const H = tc * cu;
    const eoq = H > 0 ? Math.sqrt((2 * demandaAnual * cp) / H) : 0;
    const es = z * (cmd * 0.3) * Math.sqrt(lt); // σd ≈ 30% da média
    const pr = (cmd * lt) + es;
    const emax = es + eoq;

    return { cmd, lt, es, pr, emax, eoq };
  }, [form.cmd_inicial, form.lead_time_inicial, form.nivel_servico, form.taxa_carregamento, form.custo_pedido, form.custo_unitario]);

  // Lista de fornecedores
  const { data: fornecedoresData } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      try { return (await api.get('/fornecedores')).data; } catch { return null; }
    },
    enabled: !isEdit,
  });
  const fornecedoresLista = useMemo(() => {
    if (Array.isArray(fornecedoresData)) return fornecedoresData;
    if (fornecedoresData?.data) return fornecedoresData.data;
    return [];
  }, [fornecedoresData]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome, descricao: form.descricao, unidade: form.unidade,
        custo_unitario: parseFloat(form.custo_unitario),
        custo_pedido: parseFloat(form.custo_pedido),
        taxa_carregamento: parseFloat(form.taxa_carregamento),
        localizacao: form.localizacao,
        category: form.category,
      };
      if (isEdit) payload.nivel_servico = parseInt(form.nivel_servico);
      if (isEdit) {
        return api.patch(`/produtos/${produto.id}`, payload);
      } else {
        const res = await api.post('/produtos', {
          ...payload,
          codigo: form.codigo,
          cmd_inicial: form.cmd_inicial,
          lead_time_inicial: form.lead_time_inicial,
        });
        const novoProdutoId = res.data?.id || res.data?.data?.id;

        if (novoProdutoId && isInsercao && parseFloat(form.estoque_inicial) > 0) {
          await api.post('/movimentacoes', {
            produto_id: novoProdutoId,
            tipo: 'ENTRADA',
            quantidade: parseFloat(form.estoque_inicial),
            turno: form.turno_inicial,
            numero_documento: form.documento_inicial || undefined,
            referencia: 'Entrada inicial',
            observacao: 'Estoque inicial informado na inserção do item existente',
          });
        }

        // Vincular fornecedor principal, se informado
        if (novoProdutoId && form.fornecedor_id) {
          await api.post(`/produtos/${novoProdutoId}/fornecedores`, {
            fornecedor_id: form.fornecedor_id,
            prioridade: 1,
            preco_acordado: form.preco_acordado_fornecedor ? parseFloat(form.preco_acordado_fornecedor) : undefined,
            lead_time_nominal_dias: form.lead_time_fornecedor ? parseInt(form.lead_time_fornecedor) : undefined,
          });
        }

        return res;
      }
    },
    onSuccess: () => { invalidateOperationalData(queryClient); onClose(); },
    onError: (e) => setErro(e.message || 'Erro ao salvar'),
  });

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-steel-800">
            {isEdit ? `Editar produto ${produto.codigo}` : (isInsercao ? 'Inserir item existente' : 'Cadastrar produto')}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-steel-400" /></button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          setErro('');
          if (isInsercao && (!form.estoque_inicial || parseFloat(form.estoque_inicial) <= 0)) {
            setErro('Informe o estoque atual do item existente.');
            return;
          }
          if (isInsercao && !form.turno_inicial) {
            setErro('Selecione o turno da entrada inicial.');
            return;
          }
          salvar.mutate();
        }} className="p-5 space-y-5">

          {/* ── Seção: Identificação ── */}
          <div>
            <h3 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Label>Código</Label>
                <input className="input font-mono" value={form.codigo} disabled={isEdit}
                  onChange={e => f('codigo', e.target.value.toUpperCase())} required />
              </div>
              <div className="sm:col-span-2">
                <Label>Nome do produto</Label>
                <input className="input" value={form.nome} onChange={e => f('nome', e.target.value)} required />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Descrição</Label>
                <textarea className="input resize-none" rows={2} value={form.descricao} onChange={e => f('descricao', e.target.value)} />
              </div>
              <div>
                <Label>Categoria de Estoque</Label>
                <select className="input" value={form.category} disabled={isEdit} onChange={e => f('category', e.target.value)}>
                  <option value="product_direct">Produto / Matéria-prima (BOM)</option>
                  <option value="machine_mro">Peça de Manutenção (OS/MRO)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Seção: Dados de Custo ── */}
          <div>
            <h3 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3">Dados de Custo e Armazenagem</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Unidade</Label>
                <select className="input" value={form.unidade} onChange={e => f('unidade', e.target.value)}>
                  {['UN', 'MT', 'KG', 'LT', 'PC', 'CX', 'PA'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <Label tooltip="Quanto você paga ao fornecedor por cada unidade deste item">
                  Preço de compra (R$)
                </Label>
                <input className="input font-mono" type="number" step="0.01" min="0"
                  value={form.custo_unitario} onChange={e => f('custo_unitario', e.target.value)} required />
              </div>
              <div>
                <Label tooltip="Taxa anual usada no lote economico. Use 0.20 para 20% ao ano.">
                  Custo para manter
                </Label>
                <input className="input font-mono" type="number" step="0.01" min="0" max="1"
                  value={form.taxa_carregamento} onChange={e => f('taxa_carregamento', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label tooltip="Probabilidade de nunca faltar este produto. 95% é o padrão da indústria. Quanto maior, mais estoque de segurança será mantido.">
                  Nível de serviço desejado
                </Label>
                <select className="input" value={form.nivel_servico} onChange={e => f('nivel_servico', e.target.value)} disabled={!isEdit}>
                  {[
                    [90, '90% — Básico'],
                    [95, '95% — Padrão industrial'],
                    [98, '98% — Alta disponibilidade'],
                    [99, '99% — Missão crítica'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <Label>Localização no estoque</Label>
                <input className="input" value={form.localizacao} onChange={e => f('localizacao', e.target.value)} placeholder="Ex: Prateleira A3" />
              </div>
            </div>
          </div>

          {!isEdit && isInsercao && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Entrada inicial do item existente</h3>
              <p className="text-xs text-steel-500 mb-3">
                Use quando o material já existe fisicamente no estoque e está sendo trazido para o sistema.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Estoque atual</Label>
                  <input
                    className="input font-mono"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.estoque_inicial}
                    onChange={e => f('estoque_inicial', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Turno da inserção</Label>
                  <select
                    className="input"
                    value={form.turno_inicial}
                    onChange={e => f('turno_inicial', e.target.value)}
                    disabled={carregandoTurnos}
                    required
                  >
                    <option value="">Selecionar</option>
                    {turnos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.inicio}-{t.fim})</option>)}
                  </select>
                </div>
                <div>
                  <Label>Documento</Label>
                  <input
                    className="input"
                    value={form.documento_inicial}
                    onChange={e => f('documento_inicial', e.target.value)}
                    placeholder="Inventario, planilha..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Seção: Parâmetros Kanban Iniciais (só no cadastro) ── */}
          {!isEdit && (
            <div>
              <h3 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-1">Parâmetros Kanban Iniciais</h3>
              <p className="text-xs text-steel-400 mb-3">
                Estes valores são o ponto de partida. O sistema ajustará automaticamente conforme o uso real for registrado.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label tooltip="Quantas unidades deste item são consumidas por dia em média? Ex: se saem 30 por semana, coloque 30÷7 ≈ 4.3">
                    Consumo médio diário (CMD)
                  </Label>
                  <input className="input font-mono" type="number" step="0.01" min="0" placeholder="Ex: 5.0"
                    value={form.cmd_inicial} onChange={e => f('cmd_inicial', e.target.value)} />
                </div>
                <div>
                  <Label tooltip="Quantos dias o fornecedor leva para entregar após o pedido ser emitido? Inclua o tempo de trânsito.">
                    Lead time de entrega (dias)
                  </Label>
                  <input className="input font-mono" type="number" step="1" min="0" placeholder="Ex: 15"
                    value={form.lead_time_inicial} onChange={e => f('lead_time_inicial', e.target.value)} />
                </div>
              </div>

              {/* Prévia calculada */}
              {kanbanPreview && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="text-[10px] font-bold text-red-600 uppercase">ES — Seg.</div>
                    <div className="text-lg font-bold text-red-700">{kanbanPreview.es.toFixed(1)}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <div className="text-[10px] font-bold text-amber-600 uppercase">PR — Reposição</div>
                    <div className="text-lg font-bold text-amber-700">{kanbanPreview.pr.toFixed(1)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                    <div className="text-[10px] font-bold text-green-600 uppercase">EM — Máximo</div>
                    <div className="text-lg font-bold text-green-700">{kanbanPreview.emax.toFixed(1)}</div>
                  </div>
                </div>
              )}

              {/* Grafico linear interativo */}
              <div className="mt-4">
                <p className="text-xs font-bold text-steel-500 mb-2">Visualização do ciclo Kanban estimado ({kanbanDefaults?.ciclos_estimativa_inicial || 10} ciclos)</p>
                <KanbanSawtoothChart
                  cmd={kanbanPreview?.cmd || 0}
                  leadTime={kanbanPreview?.lt || 0}
                  es={kanbanPreview?.es || 0}
                  pr={kanbanPreview?.pr || 0}
                  emax={kanbanPreview?.emax || 0}
                  ciclos={kanbanDefaults?.ciclos_estimativa_inicial || 10}
                  height={200}
                />
              </div>
            </div>
          )}

          {/* ── Seção: Fornecedor Principal (só no cadastro) ── */}
          {!isEdit && (
            <div>
              <h3 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-1">Fornecedor Principal <span className="normal-case font-normal text-steel-300">(opcional)</span></h3>
              <p className="text-xs text-steel-400 mb-3">
                Vincular um fornecedor aqui permite que o sistema gere pedidos automaticamente. Você pode adicionar mais fornecedores depois em "Detalhes do produto".
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  {fornecedoresLista.length > 0 ? (
                    <>
                      <Label>Fornecedor</Label>
                      <select className="input" value={form.fornecedor_id} onChange={e => f('fornecedor_id', e.target.value)}>
                        <option value="">Selecionar (opcional)</option>
                        {fornecedoresLista.map(forn => (
                          <option key={forn.id} value={forn.id}>{forn.nome}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div className="text-xs text-steel-400 italic p-3 bg-surface-50 rounded-lg border border-dashed border-surface-300">
                      Nenhum fornecedor cadastrado ainda. Cadastre em <strong>Fornecedores</strong> e volte aqui.
                    </div>
                  )}
                </div>
                {form.fornecedor_id && (
                  <>
                    <div>
                      <Label tooltip="Preço negociado com este fornecedor. Pode ser diferente do preço de compra geral.">
                        Preço acordado (R$)
                      </Label>
                      <input className="input font-mono" type="number" step="0.01" min="0" placeholder="Ex: 12.50"
                        value={form.preco_acordado_fornecedor} onChange={e => f('preco_acordado_fornecedor', e.target.value)} />
                    </div>
                    <div>
                      <Label tooltip="Lead time específico deste fornecedor para este produto.">
                        Lead time deste forn. (dias)
                      </Label>
                      <input className="input font-mono" type="number" step="1" min="0" placeholder="Ex: 10"
                        value={form.lead_time_fornecedor} onChange={e => f('lead_time_fornecedor', e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}

          {!isEdit && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md p-3">
              Após criar, o produto entra com faixa <strong>SEM_DADOS</strong> (se CMD e Lead Time não forem informados) ou terá seus parâmetros calculados imediatamente. Conforme movimentações e pedidos forem registrados, o modelo estatístico (Holt-Winters + Regressão) refinará automaticamente os valores.
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={salvar.isPending} className="btn-primary justify-center">
              {salvar.isPending ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar produto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Produtos;
