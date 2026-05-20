import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useUiStore } from '../stores/uiStore';
import { useQueryClient } from '@tanstack/react-query';

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
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data.produto_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const onEstoqueAtualizado = (data) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data.produto_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'evolucao'] });
    };

    const onPedidoStatus = (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', data.pedido_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      pushToast({
        tipo: ['APROVADO', 'EMITIDO'].includes(data?.status_novo) ? 'success' : 'info',
        titulo: `Pedido ${data?.numero || ''}`.trim(),
        mensagem: `Status atualizado para ${(data?.status_novo || '').replace(/_/g, ' ').toLowerCase()}.`,
      });
    };

    const onAlertaNovo = () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      syncAlerts();
    };

    const onMovimentacaoMudou = (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data?.produto_id] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      pushToast({
        tipo: data?.motivo ? 'warning' : 'info',
        titulo: 'Movimentacao de estoque',
        mensagem: data?.motivo ? 'Uma movimentacao foi rejeitada.' : 'Uma movimentacao mudou de status.',
      });
    };

    syncAlerts();

    socket.on('faixa:mudou', onFaixaMudou);
    socket.on('estoque:atualizado', onEstoqueAtualizado);
    socket.on('pedido:status', onPedidoStatus);
    socket.on('alerta:novo', onAlertaNovo);
    socket.on('movimentacao:pendente', onMovimentacaoMudou);
    socket.on('movimentacao:aprovada', onMovimentacaoMudou);
    socket.on('movimentacao:rejeitada', onMovimentacaoMudou);

    return () => {
      socket.off('faixa:mudou', onFaixaMudou);
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
