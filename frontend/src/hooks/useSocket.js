import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useUiStore } from '../stores/uiStore';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOperationalData } from '../utils/queryInvalidation';

export const useSocket = () => {
  const queryClient = useQueryClient();
  const incrementAlerts = useUiStore(state => state.incrementAlerts);
  const setAlertsUnread = useUiStore(state => state.setAlertsUnread);
  const pushToast = useUiStore(state => state.pushToast);

  useEffect(() => {
    const socket = getSocket();

    const syncAlerts = async () => {
      try {
        const { default: api } = await import('../services/api');
        const res = await api.get('/alertas', { params: { lido: false, limit: 1 } });
        const total = res.data?.total;
        if (Number.isFinite(total)) setAlertsUnread(total);
      } catch {
        incrementAlerts();
      }
    };

    const onFaixaMudou = (data) => {
      invalidateOperationalData(queryClient, data?.produto_id);
    };

    const onEstoqueAtualizado = (data) => {
      invalidateOperationalData(queryClient, data?.produto_id);
    };

    const onKanbanRecalculado = (data) => {
      invalidateOperationalData(queryClient, data?.produto_id);
    };

    const onPedidoStatus = (data) => {
      invalidateOperationalData(queryClient, data?.produto_id);
      queryClient.invalidateQueries({ queryKey: ['pedido', data?.pedido_id] });
      const mensagens = {
        AGUARDANDO_APROVACAO: 'Nova solicitação aguardando aprovação interna N1.',
        AGUARDANDO_GERENTE: 'Solicitação aguardando aprovação interna N2.',
        AGUARDANDO_DIRETORIA: 'Solicitação aguardando aprovação interna N3.',
        APROVADO: 'Pedido aprovado internamente. Comprador deve registrar a OC externa.',
        AGUARDANDO_CHEGADA: 'OC externa registrada. Pedido aguardando chegada.',
        EMITIDO: 'OC externa registrada. Pedido aguardando chegada.',
        CONCLUIDO: 'Pedido concluído com NF e estoque atualizado.',
        RECEBIDO: 'Pedido concluído com NF e estoque atualizado.',
        REJEITADO: 'Pedido rejeitado pelo aprovador.',
        CANCELADO: 'Pedido cancelado.',
      };
      pushToast({
        tipo: ['APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'CONCLUIDO', 'RECEBIDO'].includes(data?.status_novo) ? 'success' : data?.status_novo === 'REJEITADO' ? 'warning' : 'info',
        titulo: `Pedido ${data?.numero || ''}`.trim(),
        mensagem: mensagens[data?.status_novo] || `Status atualizado para ${(data?.status_novo || '').replace(/_/g, ' ').toLowerCase()}.`,
      });
    };

    const onAlertaNovo = () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      syncAlerts();
    };

    const onMovimentacaoMudou = (data) => {
      invalidateOperationalData(queryClient, data?.produto_id);
      pushToast({
        tipo: data?.motivo ? 'warning' : 'info',
        titulo: 'Movimentação de estoque',
        mensagem: data?.motivo ? 'Uma movimentação foi rejeitada.' : 'Uma movimentação mudou de status.',
      });
    };

    syncAlerts();

    socket.on('faixa:mudou', onFaixaMudou);
    socket.on('kanban:recalculado', onKanbanRecalculado);
    socket.on('estoque:atualizado', onEstoqueAtualizado);
    socket.on('pedido:status', onPedidoStatus);
    socket.on('alerta:novo', onAlertaNovo);
    socket.on('movimentacao:pendente', onMovimentacaoMudou);
    socket.on('movimentacao:aprovada', onMovimentacaoMudou);
    socket.on('movimentacao:rejeitada', onMovimentacaoMudou);

    return () => {
      socket.off('faixa:mudou', onFaixaMudou);
      socket.off('kanban:recalculado', onKanbanRecalculado);
      socket.off('estoque:atualizado', onEstoqueAtualizado);
      socket.off('pedido:status', onPedidoStatus);
      socket.off('alerta:novo', onAlertaNovo);
      socket.off('movimentacao:pendente', onMovimentacaoMudou);
      socket.off('movimentacao:aprovada', onMovimentacaoMudou);
      socket.off('movimentacao:rejeitada', onMovimentacaoMudou);
    };
  }, [queryClient, incrementAlerts, setAlertsUnread, pushToast]);

  const subscribeToProduct = (produtoId) => {
    const socket = getSocket();
    socket.emit('subscribe:produto', { produto_id: produtoId });
  };

  const unsubscribeFromProduct = (produtoId) => {
    const socket = getSocket();
    socket.emit('unsubscribe:produto', { produto_id: produtoId });
  };

  return { subscribeToProduct, unsubscribeFromProduct };
};
