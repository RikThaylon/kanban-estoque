const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const {
  getLimitesAprovacaoPedido,
  getPermissoesOperacionais,
  PAGINAS_SISTEMA,
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
