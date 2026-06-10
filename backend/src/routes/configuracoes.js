const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const {
  getLimitesAprovacaoPedido,
  getKanbanDefaults,
  getTurnosOperacionais,
  getPermissoesOperacionais,
  PAGINAS_SISTEMA,
  normalizarTurnos,
  salvarConfiguracoes,
  serializePerfis,
} = require('../services/configuracoes.service');
const { PERFIS_VALIDOS } = require('../middleware/rbac');

const router = express.Router();

router.get('/pedidos', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const limites = await getLimitesAprovacaoPedido();
    res.json({
      limite_supervisor: limites.supervisor,
      limite_gerente: limites.gerente,
    });
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
  ],
  validate,
  async (req, res, next) => {
    try {
      const limiteSupervisor = Number(req.body.limite_supervisor);
      const limiteGerente = Number(req.body.limite_gerente);

      if (limiteGerente < limiteSupervisor) {
        throw new AppError('Limite do gerente deve ser maior ou igual ao limite do supervisor', 400, 'LIMITE_INVALIDO');
      }

      await salvarConfiguracoes({
        'pedidos.limite_supervisor': limiteSupervisor,
        'pedidos.limite_gerente': limiteGerente,
      }, req.user.id);

      res.json({
        limite_supervisor: limiteSupervisor,
        limite_gerente: limiteGerente,
      });
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
      const nivelServicoPadrao = Number(req.body.nivel_servico_padrao);
      const ciclosEstimativaInicial = Number(req.body.ciclos_estimativa_inicial);
      const taxaCarregamentoPadrao = Number(req.body.taxa_carregamento_padrao);

      await salvarConfiguracoes({
        'kanban.nivel_servico_padrao': nivelServicoPadrao,
        'kanban.ciclos_estimativa_inicial': ciclosEstimativaInicial,
        'kanban.taxa_carregamento_padrao': taxaCarregamentoPadrao,
      }, req.user.id);

      res.json({
        nivel_servico_padrao: nivelServicoPadrao,
        ciclos_estimativa_inicial: ciclosEstimativaInicial,
        taxa_carregamento_padrao: taxaCarregamentoPadrao,
      });
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
      const turnos = normalizarTurnos(req.body.turnos);
      const ids = new Set(turnos.map((turno) => turno.id));
      if (ids.size !== turnos.length) {
        throw new AppError('Cada turno precisa ter um codigo unico', 400, 'TURNO_DUPLICADO');
      }

      await salvarConfiguracoes({
        'turnos.lista': JSON.stringify(turnos),
      }, req.user.id);

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
      const configuracoes = {
        'permissoes.cadastrar_item': serializePerfis(req.body.cadastrar_item),
        'permissoes.editar_curva_abc': serializePerfis(req.body.editar_curva_abc),
      };

      for (const pagina of PAGINAS_SISTEMA) {
        if (req.body.paginas?.[pagina]) {
          configuracoes[`permissoes.paginas.${pagina}`] = serializePerfis(req.body.paginas[pagina]);
        }
      }

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
