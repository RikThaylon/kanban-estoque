const { dispatchRecalculoKanban } = require('../../src/services/recalculo.dispatcher');

describe('dispatchRecalculoKanban', () => {
  it('nao quebra a resposta HTTP quando o recalc debounced retorna undefined', () => {
    const logger = { error: jest.fn() };
    const scheduler = jest.fn(() => undefined);

    expect(() => dispatchRecalculoKanban(scheduler, 'produto-1', null, logger)).not.toThrow();
    expect(scheduler).toHaveBeenCalledWith('produto-1', null);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('registra erro se o recalc sincrono falhar', () => {
    const logger = { error: jest.fn() };
    const scheduler = jest.fn(() => {
      throw new Error('falha sync');
    });

    dispatchRecalculoKanban(scheduler, 'produto-1', null, logger);

    expect(logger.error).toHaveBeenCalledWith(
      'Erro ao agendar recalculo Kanban',
      expect.objectContaining({ produtoId: 'produto-1', error: 'falha sync' })
    );
  });

  it('registra erro se o recalc async rejeitar', async () => {
    const logger = { error: jest.fn() };
    const scheduler = jest.fn(() => Promise.reject(new Error('falha async')));

    dispatchRecalculoKanban(scheduler, 'produto-1', null, logger);
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'Erro ao recalcular Kanban',
      expect.objectContaining({ produtoId: 'produto-1', error: 'falha async' })
    );
  });
});
