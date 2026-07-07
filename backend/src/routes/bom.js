const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { AppError } = require('../utils/errors');

const router = express.Router();

// GET /api/v1/bom/:productId
// Retorna toda a árvore do BOM para um produto específico usando CTE Recursivo
router.get('/:productId', authenticate,
  [param('productId').isUUID()], validate,
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const result = await query(`
        WITH RECURSIVE bom_tree AS (
          -- Nível Base
          SELECT 
            b.id, b.parent_item_id, b.child_item_id, b.quantity_required, b.lead_time_days,
            1 AS level,
            p.nome AS child_name, p.codigo AS child_code, p.unidade, p.category, p.estoque_atual,
            ARRAY[b.parent_item_id] AS path
          FROM bom_structures b
          JOIN produtos p ON p.id = b.child_item_id
          WHERE b.parent_item_id = $1

          UNION ALL

          -- Níveis Recursivos
          SELECT 
            b.id, b.parent_item_id, b.child_item_id, b.quantity_required, b.lead_time_days,
            t.level + 1,
            p.nome, p.codigo, p.unidade, p.category, p.estoque_atual,
            t.path || b.parent_item_id
          FROM bom_structures b
          JOIN bom_tree t ON b.parent_item_id = t.child_item_id
          JOIN produtos p ON p.id = b.child_item_id
          -- Prevenção de loop infinito no CTE limitando profundidade ou ciclo
          WHERE NOT (b.child_item_id = ANY(t.path))
        )
        SELECT * FROM bom_tree ORDER BY level, child_name;
      `, [productId]);

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/bom
// Adiciona um nó na árvore do BOM
router.post('/', authenticate, audit('CRIAR_BOM', 'bom_structures'),
  [
    body('parent_item_id').isUUID(),
    body('child_item_id').isUUID(),
    body('quantity_required').isFloat({ gt: 0 }),
    body('lead_time_days').optional().isInt({ min: 0 }),
    body('notes').optional().isString()
  ], validate,
  async (req, res, next) => {
    try {
      const { parent_item_id, child_item_id, quantity_required, lead_time_days, notes } = req.body;

      if (parent_item_id === child_item_id) {
        throw new AppError('Um item não pode ser pai de si mesmo', 400);
      }

      // Prevenção de Referência Circular via CTE
      const cycleCheck = await query(`
        WITH RECURSIVE check_tree AS (
          SELECT child_item_id, parent_item_id
          FROM bom_structures
          WHERE parent_item_id = $1
          
          UNION ALL
          
          SELECT b.child_item_id, b.parent_item_id
          FROM bom_structures b
          JOIN check_tree c ON b.parent_item_id = c.child_item_id
        )
        SELECT 1 FROM check_tree WHERE child_item_id = $2 LIMIT 1;
      `, [child_item_id, parent_item_id]);

      if (cycleCheck.rowCount > 0) {
        throw new AppError('Referência circular detectada. O item pai já é dependente do item filho em algum nível.', 400);
      }

      const result = await query(`
        INSERT INTO bom_structures (parent_item_id, child_item_id, quantity_required, lead_time_days, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [parent_item_id, child_item_id, quantity_required, lead_time_days || 0, notes, req.user.id]);

      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        next(new AppError('Essa dependência já existe para este item.', 400));
      } else {
        next(err);
      }
    }
  }
);

// DELETE /api/v1/bom/:id
// Remove uma dependência do BOM
router.delete('/:id', authenticate, audit('REMOVER_BOM', 'bom_structures'),
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await query('DELETE FROM bom_structures WHERE id = $1 RETURNING id', [id]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Dependência não encontrada');
      }

      res.json({ message: 'Dependência removida com sucesso' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
