import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Clock, PackageCheck, Search, Send, Truck, XCircle } from 'lucide-react';
import api from '../services/api';
import { formatDate } from '../utils/formatters';
import { PEDIDO_STATUS_STEPS, STATUS_STYLES, statusLabel } from '../utils/pedidosStatus';

const etapaIcones = {
  solicitacao: PackageCheck,
  aprovacao: CheckCircle,
  compra: Send,
  chegada: Truck,
  conclusao: CheckCircle,
};

const AcompanharPedido = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [codigo, setCodigo] = useState(searchParams.get('numero') || '');
  const buscaInicial = useRef(false);

  const buscarPedido = useMutation({
    mutationFn: async (numero) => (await api.get(`/pedidos/numero/${encodeURIComponent(numero)}`)).data,
  });

  useEffect(() => {
    const numero = searchParams.get('numero')?.trim();
    if (!numero || buscaInicial.current) return;
    buscaInicial.current = true;
    setCodigo(numero.toUpperCase());
    buscarPedido.mutate(numero);
  }, []);

  const pedido = buscarPedido.data;
  const statusAtual = pedido?.status;
  const statusInterrompido = ['CANCELADO', 'REJEITADO'].includes(statusAtual);

  const handleSubmit = (e) => {
    e.preventDefault();
    const numero = codigo.trim();
    if (!numero) return;
    setSearchParams({ numero });
    buscarPedido.reset();
    buscarPedido.mutate(numero);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/pedidos" className="inline-flex items-center gap-2 text-sm font-bold text-navy-500 hover:text-accent">
            <ArrowLeft className="w-4 h-4" /> Voltar para pedidos
          </Link>
          <h1 className="mt-3 text-xl sm:text-2xl font-bold text-navy-800">Acompanhar Pedido</h1>
          <p className="text-sm text-navy-400">Consulte o andamento pelo codigo do pedido de compra.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 sm:p-5">
        <label className="block text-sm font-bold text-navy-700 mb-2">Codigo do pedido</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex.: PC-202606-0010"
              className="input w-full pl-9 font-mono"
              autoFocus
            />
          </div>
          <button type="submit" disabled={buscarPedido.isPending || !codigo.trim()} className="btn-primary justify-center sm:min-w-[150px]">
            {buscarPedido.isPending ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {buscarPedido.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <strong>Pedido nao encontrado.</strong>
            <p className="mt-1">{buscarPedido.error?.message || 'Confira o codigo e tente novamente.'}</p>
          </div>
        </div>
      )}

      {!pedido && !buscarPedido.isError && (
        <div className="rounded-md border border-dashed border-surface-300 bg-white/70 p-8 text-center text-navy-400">
          Digite o codigo do pedido para consultar o status.
        </div>
      )}

      {pedido && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="card p-0 overflow-hidden">
            <div className="border-b border-surface-200 bg-surface-50 p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase font-bold text-navy-400">Pedido localizado</p>
                <h2 className="font-mono text-xl font-bold text-navy-800">{pedido.numero}</h2>
              </div>
              <span className={`inline-flex w-fit rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_STYLES[statusAtual] || 'bg-surface-100 text-navy-600'}`}>
                {statusLabel(statusAtual)}
              </span>
            </div>

            {statusInterrompido && (
              <div className="m-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex gap-3">
                <XCircle className="w-5 h-5 shrink-0" />
                <div>
                  <strong>Fluxo interrompido.</strong>
                  {pedido.motivo_rejeicao && <p className="mt-1">Motivo: {pedido.motivo_rejeicao}</p>}
                </div>
              </div>
            )}

            <div className="p-5">
              <div className="space-y-4">
                {PEDIDO_STATUS_STEPS.map((etapa, index) => (
                  <FluxoEtapa
                    key={etapa.key}
                    etapa={etapa}
                    index={index}
                    status={statusAtual}
                    interrompido={statusInterrompido}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="card p-5 h-fit">
            <h3 className="text-base font-bold text-navy-800 mb-4">Resumo do pedido</h3>
            <div className="space-y-2 text-sm">
              <ResumoLinha label="Produto" value={`${pedido.produto_codigo || '-'} - ${pedido.produto_nome || '-'}`} />
              <ResumoLinha label="Quantidade" value={pedido.quantidade_pedida} />
              <ResumoLinha label="Fornecedor" value={pedido.fornecedor_nome || '-'} />
              <ResumoLinha label="Maquina" value={pedido.maquina_codigo ? `${pedido.maquina_codigo} - ${pedido.maquina_nome || ''}` : '-'} />
              <ResumoLinha label="Departamento" value={pedido.departamento_nome || '-'} />
              <ResumoLinha label="Supervisor" value={pedido.aprovador_n1_nome || '-'} />
              <ResumoLinha label="Criado por" value={pedido.criado_por_nome || '-'} />
              <ResumoLinha label="Criado em" value={formatDate(pedido.criado_em)} />
              <ResumoLinha label="Previsao" value={pedido.data_prevista ? formatDate(pedido.data_prevista) : '-'} />
              <ResumoLinha label="OC externa" value={pedido.numero_oc_externa || '-'} mono />
              <ResumoLinha label="Recebido" value={pedido.quantidade_recebida || 0} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const FluxoEtapa = ({ etapa, index, status, interrompido }) => {
  const Icon = etapaIcones[etapa.key] || Clock;
  const ativo = etapa.activeStatuses?.includes(status);
  const concluido = !interrompido && etapa.statuses.includes(status) && !ativo;
  const futuro = !concluido && !ativo;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={[
          'h-9 w-9 rounded-md flex items-center justify-center border text-sm font-bold',
          concluido ? 'bg-green-600 border-green-600 text-white' : '',
          ativo ? 'bg-accent border-accent text-white' : '',
          futuro ? 'bg-white border-surface-300 text-navy-400' : '',
        ].filter(Boolean).join(' ')}>
          {concluido ? <CheckCircle className="w-5 h-5" /> : ativo ? <Icon className="w-5 h-5" /> : index + 1}
        </div>
        {index < PEDIDO_STATUS_STEPS.length - 1 && <div className="mt-2 h-10 w-px bg-surface-200" />}
      </div>
      <div className="min-w-0 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`font-bold ${futuro ? 'text-navy-400' : 'text-navy-800'}`}>{etapa.title}</h3>
          {ativo && <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">Atual</span>}
          {concluido && <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">Ok</span>}
        </div>
        <p className={`text-sm ${futuro ? 'text-navy-300' : 'text-navy-500'}`}>{etapa.description}</p>
      </div>
    </div>
  );
};

const ResumoLinha = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4 border-b border-surface-100 py-2 last:border-0">
    <span className="text-navy-400">{label}</span>
    <span className={`text-right text-navy-700 break-words ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
  </div>
);

export default AcompanharPedido;
