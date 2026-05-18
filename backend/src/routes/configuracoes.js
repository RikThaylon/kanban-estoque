const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const {
  getLimitesAprovacaoPedido,
  salvarConfiguracoes,
} = require('../services/configuracoes.service');

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

module.exports = router;
