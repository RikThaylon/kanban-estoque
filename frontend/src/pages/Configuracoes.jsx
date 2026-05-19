import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Save, Settings, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import { PAGINA_LABELS, PAGINAS_SISTEMA, PERFIL_LABELS } from '../utils/permissoes';

const Configuracoes = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    limite_supervisor: '',
    limite_gerente: '',
  });
  const [permissoes, setPermissoes] = useState({
    cadastrar_item: [],
    editar_curva_abc: [],
    paginas: {},
  });
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

  useEffect(() => {
    if (data) {
      setForm({
        limite_supervisor: data.limite_supervisor ?? '',
        limite_gerente: data.limite_gerente ?? '',
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

  const salvar = useMutation({
    mutationFn: () => api.patch('/configuracoes/pedidos', {
      limite_supervisor: Number(form.limite_supervisor),
      limite_gerente: Number(form.limite_gerente),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes', 'pedidos'] });
      setErro('');
      setSucesso('Configuracoes salvas.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar configuracoes');
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
      setSucesso('Permissoes salvas.');
    },
    onError: (e) => {
      setSucesso('');
      setErro(e.message || 'Erro ao salvar permissoes');
    },
  });

  const supervisor = Number(form.limite_supervisor) || 0;
  const gerente = Number(form.limite_gerente) || 0;
  const invalido = supervisor < 0 || gerente < 0 || gerente < supervisor;

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

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Configuracoes</h1>
          <p className="text-navy-400 text-sm">Regras administraveis do fluxo de compras</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-200 flex items-center gap-3 bg-surface-50">
          <div className="w-10 h-10 rounded bg-navy-100 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-navy-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-navy-800">Aprovacao de pedidos</h2>
            <p className="text-xs text-navy-500">Valores de corte para supervisor, gerente e diretoria.</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Limite do supervisor de turno</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.limite_supervisor}
                onChange={(e) => setForm((f) => ({ ...f, limite_supervisor: e.target.value }))}
                className="input font-mono"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-navy-500 mt-1">
                A partir de {formatMoney(supervisor)}, a solicitacao vai direto para gerente de operacoes.
              </p>
            </div>

            <div>
              <label className="label">Limite do gerente de operacoes</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.limite_gerente}
                onChange={(e) => setForm((f) => ({ ...f, limite_gerente: e.target.value }))}
                className="input font-mono"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-navy-500 mt-1">
                A partir de {formatMoney(gerente)}, o gerente escala para diretoria/plant manager.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Esses valores afetam os novos pedidos e as aprovacoes pendentes. Pedidos ja aprovados, emitidos ou recebidos nao sao reclassificados.
            </p>
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3">{sucesso}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="submit" disabled={salvar.isPending || isLoading || invalido} className="btn-primary justify-center">
              <Save className="w-4 h-4" />
              {salvar.isPending ? 'Salvando...' : 'Salvar configuracoes'}
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
            <h2 className="font-bold text-navy-800">Permissoes por cargo</h2>
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
            <h3 className="text-sm font-bold text-navy-800 mb-3">Acesso por pagina</h3>
            <div className="overflow-x-auto rounded-md border border-surface-200">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="bg-surface-50 text-xs uppercase text-navy-400">
                  <tr>
                    <th className="p-3 text-left">Pagina</th>
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
            <p className="text-xs text-navy-500 mt-2">Admin sempre acessa todas as paginas, mesmo quando nao aparece na matriz.</p>
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
              {salvarPermissoes.isPending ? 'Salvando...' : 'Salvar permissoes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const PermissionGroup = ({ title, value, perfis, disabled, onToggle }) => (
  <div>
    <h3 className="text-sm font-bold text-navy-800 mb-3">{title}</h3>
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

export default Configuracoes;
