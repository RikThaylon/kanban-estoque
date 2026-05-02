import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useUiStore } from '../stores/uiStore';
import { useQueryClient } from '@tanstack/react-query';

export const useSocket = () => {
  const queryClient = useQueryClient();
  const incrementAlerts = useUiStore(state => state.incrementAlerts);

  useEffect(() => {
    const socket = getSocket();

    const onFaixaMudou = (data) => {
      console.log('🔄 Faixa mudou:', data);
      // Invalida cache do produto específico e da lista
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data.produto_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const onEstoqueAtualizado = (data) => {
      console.log('📦 Estoque atualizado:', data);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produto', data.produto_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'evolucao'] });
    };

    const onPedidoStatus = (data) => {
      console.log('🛒 Pedido atualizado:', data);
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', data.pedido_id] });
    };

    const onAlertaNovo = (data) => {
      console.log('⚠️ Novo alerta:', data);
      incrementAlerts();
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
    };

    // Registrar listeners globais
    socket.on('faixa:mudou', onFaixaMudou);
    socket.on('estoque:atualizado', onEstoqueAtualizado);
    socket.on('pedido:status', onPedidoStatus);
    socket.on('alerta:novo', onAlertaNovo);

    return () => {
      socket.off('faixa:mudou', onFaixaMudou);
      socket.off('estoque:atualizado', onEstoqueAtualizado);
      socket.off('pedido:status', onPedidoStatus);
      socket.off('alerta:novo', onAlertaNovo);
    };
  }, [queryClient, incrementAlerts]);

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
