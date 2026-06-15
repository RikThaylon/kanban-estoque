const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const {
  getLimitesAprovacaoPedido,
  getCargosFluxoCompra,
  getKanbanDefaults,
  getTurnosOperacionais,
  getPermissoesOperacionais,
  PAGINAS_SISTEMA,
  salvarConfiguracoes,
  formatarRespostaPedidos,
  montarConfiguracoesPedidos,
  montarConfiguracoesKanban,
  montarConfiguracoesTurnos,
  montarConfiguracoesPermissoes,
  PERFIS_APROVADORES_CONFIGURAVEIS,
  PERFIS_FLUXO_COMPRA_CONFIGURAVEIS,
} = require('../services/configuracoes.service');
const { PERFIS_VALIDOS } = require('../middleware/rbac');

const router = express.Router();

router.get('/pedidos', authenticate, async (req, res, next) => {
  try {
    const [limites, cargosFluxo] = await Promise.all([
      getLimitesAprovacaoPedido(),
      getCargosFluxoCompra({ incluirAdmin: false }),
    ]);
    res.json(formatarRespostaPedidos(limites, cargosFluxo));
  } catch (err) {
    next(err);
  }
});

router.patch('/pedidos',
  authenticate,
  authorize('admin'),
  audit('ATUALIZAR_CONFIGURACOES_PEDIDOS', 'configuracoes_sistema'),
  [
    body('limite_supervisor').isFloat({ min: 0 }).withMessage('Limite do supervisor deve ser >= 0'),
    body('limite_gerente').isFloat({ min: 0 }).withMessage('Limite do gerente deve ser >= 0'),
    body('solicitantes').optional().isArray().withMessage('solicitantes deve ser uma lista de cargos'),
    body('solicitantes.*').optional().isIn(PERFIS_FLUXO_COMPRA_CONFIGURAVEIS).withMessage('Cargo invalido em solicitantes'),
    body('aprovadores_nivel_1').optional().isArray().withMessage('aprovadores_nivel_1 deve ser uma lista de cargos'),
    body('aprovadores_nivel_1.*').optional().isIn(PERFIS_APROVADORES_CONFIGURAVEIS).withMessage('Cargo invalido em aprovadores_nivel_1'),
    body('aprovadores_nivel_2').optional().isArray().withMessage('aprovadores_nivel_2 deve ser uma lista de cargos'),
    body('aprovadores_nivel_2.*').optional().isIn(PERFIS_APROVADORES_CONFIGURAVEIS).withMessage('Cargo invalido em aprovadores_nivel_2'),
    body('aprovadores_nivel_3').optional().isArray().withMessage('aprovadores_nivel_3 deve ser uma lista de cargos'),
    body('aprovadores_nivel_3.*').optional().isIn(PERFIS_APROVADORES_CONFIGURAVEIS).withMessage('Cargo invalido em aprovadores_nivel_3'),
    body('compradores').optional().isArray().withMessage('compradores deve ser uma lista de cargos'),
    body('compradores.*').optional().isIn(PERFIS_FLUXO_COMPRA_CONFIGURAVEIS).withMessage('Cargo invalido em compradores'),
    body('recebedores').optional().isArray().withMessage('recebedores deve ser uma lista de cargos'),
    body('recebedores.*').optional().isIn(PERFIS_FLUXO_COMPRA_CONFIGURAVEIS).withMessage('Cargo invalido em recebedores'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { configuracoes, limites } = montarConfiguracoesPedidos(req.body);

      await salvarConfiguracoes(configuracoes, req.user.id);

      const cargosFluxo = await getCargosFluxoCompra({ incluirAdmin: false });

      res.json(formatarRespostaPedidos(limites, cargosFluxo));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/kanban', authenticate, async (req, res, next) => {
  try {
    res.json(await getKanbanDefaults());
  } catch (err) {
    next(err);
  }
});

router.patch('/kanban',
  authenticate,
  authorize('admin'),
  audit('ATUALIZAR_CONFIGURACOES_KANBAN', 'configuracoes_sistema'),
  [
    body('nivel_servico_padrao').isIn(['90', '95', '98', '99']).withMessage('Nivel de servico deve ser 90, 95, 98 ou 99'),
    body('ciclos_estimativa_inicial').isInt({ min: 3, max: 10 }).withMessage('Ciclos deve ficar entre 3 e 10'),
    body('taxa_carregamento_padrao').isFloat({ min: 0, max: 1 }).withMessage('Custo para manter deve ficar entre 0 e 1'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { configuracoes, resposta } = montarConfiguracoesKanban(req.body);
      await salvarConfiguracoes(configuracoes, req.user.id);
      res.json(resposta);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/turnos', authenticate, async (req, res, next) => {
  try {
    res.json({ turnos: await getTurnosOperacionais() });
  } catch (err) {
    next(err);
  }
});

router.patch('/turnos',
  authenticate,
  authorize('admin'),
  audit('ATUALIZAR_CONFIGURACOES_TURNOS', 'configuracoes_sistema'),
  [
    body('turnos').isArray({ min: 1, max: 12 }).withMessage('turnos deve ser uma lista de 1 a 12 itens'),
    body('turnos.*.id').trim().matches(/^[A-Za-z0-9_-]{1,20}$/).withMessage('Codigo do turno invalido'),
    body('turnos.*.nome').trim().isLength({ min: 1, max: 40 }).withMessage('Nome do turno deve ter 1-40 caracteres'),
    body('turnos.*.inicio').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Inicio deve estar em HH:mm'),
    body('turnos.*.fim').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Fim deve estar em HH:mm'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { turnos, configuracoes } = montarConfiguracoesTurnos(req.body);

      await salvarConfiguracoes(configuracoes, req.user.id);

      res.json({ turnos });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/permissoes', authenticate, async (req, res, next) => {
  try {
    const permissoes = await getPermissoesOperacionais();
    res.json({
      perfis: PERFIS_VALIDOS,
      ...permissoes,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/permissoes',
  authenticate,
  authorize('admin'),
  audit('ATUALIZAR_CONFIGURACOES_PERMISSOES', 'configuracoes_sistema'),
  [
    body('cadastrar_item').isArray().withMessage('cadastrar_item deve ser uma lista de cargos'),
    body('cadastrar_item.*').isIn(PERFIS_VALIDOS).withMessage('Cargo invalido em cadastrar_item'),
    body('editar_curva_abc').isArray().withMessage('editar_curva_abc deve ser uma lista de cargos'),
    body('editar_curva_abc.*').isIn(PERFIS_VALIDOS).withMessage('Cargo invalido em editar_curva_abc'),
    body('paginas').optional().isObject().withMessage('paginas deve ser um mapa de pagina para cargos'),
    ...PAGINAS_SISTEMA.flatMap((pagina) => [
      body(`paginas.${pagina}`).optional().isArray().withMessage(`${pagina} deve ser uma lista de cargos`),
      body(`paginas.${pagina}.*`).optional().isIn(PERFIS_VALIDOS).withMessage(`Cargo invalido em ${pagina}`),
    ]),
  ],
  validate,
  async (req, res, next) => {
    try {
      const configuracoes = montarConfiguracoesPermissoes(req.body);

      await salvarConfiguracoes(configuracoes, req.user.id);

      const permissoes = await getPermissoesOperacionais();
      res.json({
        perfis: PERFIS_VALIDOS,
        ...permissoes,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
