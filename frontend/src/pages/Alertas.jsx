import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, Check, CheckCheck, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';

const SEVERIDADE_CONF = {
  CRITICO: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Crítico' },
  AVISO: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Aviso' },
  INFO: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', label: 'Info' },
};

const Alertas = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alertas'],
    queryFn: async () => (await api.get('/alertas', { params: { limit: 100 } })).data,
    refetchInterval: 30000,
  });

  const lerUm = useMutation({
    mutationFn: (id) => api.patch(`/alertas/${id}/ler`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas'] }),
  });

  const lerTodos = useMutation({
    mutationFn: () => api.post('/alertas/ler-todos'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas'] }),
  });

  const alertas = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Alertas
            {total > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-sm font-bold rounded-full">{total}</span>
            )}
          </h1>
          <p className="text-navy-400 text-sm mt-1">Notificações de risco de ruptura, mudanças de faixa e eventos do sistema</p>
        </div>
        {alertas.length > 0 && (
          <button
            onClick={() => lerTodos.mutate()}
            disabled={lerTodos.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" /> Marcar todos como lidos
          </button>
        )}
      </div>

      {isLoading && <div className="text-center text-navy-400 py-12">Carregando…</div>}

      {!isLoading && alertas.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-navy-800 mb-2">Tudo em ordem</h3>
          <p className="text-navy-500">Nenhum alerta pendente. Bom trabalho.</p>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="space-y-3">
          {alertas.map(a => {
            const conf = SEVERIDADE_CONF[a.severidade] || SEVERIDADE_CONF.INFO;
            const Icon = conf.icon;
            return (
              <div
                key={a.id}
                className={`card border-l-4 ${conf.border} p-4 flex items-start gap-4 hover:shadow-md transition-shadow`}
              >
                <div className={`w-10 h-10 rounded-full ${conf.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${conf.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conf.bg} ${conf.text}`}>
                      {conf.label}
                    </span>
                    <span className="text-xs text-navy-400">{a.tipo}</span>
                    <span className="text-xs text-navy-400">·</span>
                    <span className="text-xs text-navy-500">{formatDateTime(a.criado_em)}</span>
                  </div>
                  <h3 className="font-semibold text-navy-800 mb-1">{a.titulo}</h3>
                  {a.mensagem && <p className="text-sm text-navy-600">{a.mensagem}</p>}
                  {a.produto_id && (
                    <Link
                      to={`/produtos/${a.produto_id}`}
                      className="inline-block mt-2 text-sm text-navy-600 hover:text-navy-800 font-medium"
                    >
                      Ver produto: {a.produto_codigo} →
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => lerUm.mutate(a.id)}
                  disabled={lerUm.isPending}
                  className="text-navy-400 hover:text-green-600 hover:bg-green-50 p-2 rounded-md transition-colors shrink-0"
                  title="Marcar como lido"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Alertas;
