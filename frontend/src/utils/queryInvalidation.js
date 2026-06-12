export const invalidateOperationalData = (queryClient, produtoId = null) => {
  queryClient.invalidateQueries({ queryKey: ['produtos'] });
  queryClient.invalidateQueries({ queryKey: ['produto'] });
  if (produtoId) queryClient.invalidateQueries({ queryKey: ['produto', produtoId] });
  queryClient.invalidateQueries({ queryKey: ['pedidos'] });
  queryClient.invalidateQueries({ queryKey: ['pedidos', 'sugestoes'] });
  queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'evolucao'] });
  queryClient.invalidateQueries({ queryKey: ['alertas'] });
  queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
};
