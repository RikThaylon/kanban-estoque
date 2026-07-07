const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { pool, query } = require('../config/database');
const { AppError, NotFoundError } = require('../utils/errors');

const router = express.Router();

// Função para gerar número sequencial da OS (Ex: OS-2023-0001)
async function generateOsNumber() {
  const result = await query(`
    SELECT COUNT(*) + 1 as next_val 
    FROM service_orders 
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
  `);
  const year = new Date().getFullYear();
  const seq = String(result.rows[0].next_val).padStart(4, '0');
  return `OS-${year}-${seq}`;
}

// GET /api/v1/service-orders
// Lista todas as ordens de serviço com filtro por status
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, machine_id, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`so.status = $${params.length}`);
    }
    if (machine_id) {
      params.push(machine_id);
      conditions.push(`so.machine_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(`
      SELECT 
        so.*,
        m.nome as machine_name,
        d.nome as department_name,
        u.nome as created_by_name,
        COUNT(som.id) as materials_count
      FROM service_orders so
      LEFT JOIN maquinas m ON m.id = so.machine_id
      LEFT JOIN departamentos d ON d.id = so.department_id
      LEFT JOIN usuarios u ON u.id = so.created_by
      LEFT JOIN service_order_materials som ON som.so_id = so.id
      ${where}
      GROUP BY so.id, m.nome, d.nome, u.nome
      ORDER BY so.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/service-orders/:id
// Detalhes completos de uma OS com seus materiais consumidos
router.get('/:id', authenticate,
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const osRes = await query(`
        SELECT so.*, m.nome as machine_name, d.nome as department_name
        FROM service_orders so
        LEFT JOIN maquinas m ON m.id = so.machine_id
        LEFT JOIN departamentos d ON d.id = so.department_id
        WHERE so.id = $1
      `, [req.params.id]);

      if (osRes.rowCount === 0) return next(new NotFoundError('OS não encontrada'));

      const materialsRes = await query(`
        SELECT som.*, p.nome as product_name, p.codigo, p.unidade
        FROM service_order_materials som
        JOIN produtos p ON p.id = som.product_id
        WHERE som.so_id = $1
        ORDER BY som.added_at ASC
      `, [req.params.id]);

      res.json({ ...osRes.rows[0], materials: materialsRes.rows });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/service-orders/:id/close
// Fecha/conclui uma OS
router.patch('/:id/close', authenticate, audit('FECHAR_OS', 'service_orders'),
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const result = await query(`
        UPDATE service_orders 
        SET status = 'COMPLETED', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status IN ('OPEN','IN_PROGRESS')
        RETURNING *
      `, [req.params.id]);

      if (result.rowCount === 0) return next(new NotFoundError('OS não encontrada ou já encerrada'));
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/service-orders
// Cria uma nova Ordem de Serviço
router.post('/', authenticate, audit('CRIAR_OS', 'service_orders'),
  [
    body('machine_id').isUUID(),
    body('department_id').isUUID(),
    body('supervisor_id').optional().isUUID(),
    body('technician_id').optional().isUUID(),
    body('notes').optional().isString()
  ], validate,
  async (req, res, next) => {
    try {
      const { machine_id, department_id, supervisor_id, technician_id, notes } = req.body;
      const number = await generateOsNumber();

      const result = await query(`
        INSERT INTO service_orders (number, machine_id, department_id, supervisor_id, technician_id, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [number, machine_id, department_id, supervisor_id, technician_id, notes, req.user.id]);

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/service-orders/:id/consume
// Consome materiais MRO na OS (Requer Transação ACID + SELECT FOR UPDATE)
router.post('/:id/consume', authenticate,
  [
    param('id').isUUID(),
    body('product_id').isUUID(),
    body('quantity').isFloat({ gt: 0 }),
    body('notes').optional().isString()
  ], validate,
  async (req, res, next) => {
    const client = await pool.connect(); // Obtém um cliente do pool para a transação

    try {
      await client.query('BEGIN'); // Inicia a Transação

      const { id } = req.params;
      const { product_id, quantity, notes } = req.body;

      // 1. Verificar se OS está aberta
      const osCheck = await client.query('SELECT status, machine_id FROM service_orders WHERE id = $1', [id]);
      if (osCheck.rowCount === 0) throw new NotFoundError('OS não encontrada');
      if (osCheck.rows[0].status !== 'OPEN' && osCheck.rows[0].status !== 'IN_PROGRESS') {
        throw new AppError('Apenas Ordens de Serviço abertas ou em progresso podem consumir materiais', 400);
      }

      const machineId = osCheck.rows[0].machine_id;

      // 2. Travar a linha do estoque com SELECT FOR UPDATE (Previne Race Conditions)
      const stockCheck = await client.query(`
        SELECT estoque_atual, category, custo_unitario 
        FROM produtos 
        WHERE id = $1 FOR UPDATE
      `, [product_id]);

      if (stockCheck.rowCount === 0) throw new NotFoundError('Produto não encontrado');

      const produto = stockCheck.rows[0];
      const qtyToConsume = parseFloat(quantity);

      // (Regra de Negócio: OS normalmente consome itens MRO, mas se a empresa permitir outro, 
      // verificamos apenas se há estoque físico, como solicitado)
      if (parseFloat(produto.estoque_atual) < qtyToConsume) {
        throw new AppError(`Estoque insuficiente. Disponível: ${produto.estoque_atual}`, 400);
      }

      const totalCost = qtyToConsume * parseFloat(produto.custo_unitario || 0);

      // 3. Registrar consumo na OS
      const matResult = await client.query(`
        INSERT INTO service_order_materials (so_id, product_id, quantity, cost, notes, added_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [id, product_id, qtyToConsume, totalCost, notes, req.user.id]);

      // 4. Deduzir o Estoque Real
      await client.query(`
        UPDATE produtos 
        SET estoque_atual = estoque_atual - $1, atualizado_em = NOW()
        WHERE id = $2
      `, [qtyToConsume, product_id]);

      // 5. Audit Log rigoroso exigido no briefing
      // (Considerando uma tabela genérica 'movimentacoes' do sistema atual)
      await client.query(`
        INSERT INTO movimentacoes 
        (produto_id, tipo, quantidade, estoque_anterior, estoque_apos, origem, destino, observacao, criado_por)
        VALUES ($1, 'SAIDA', $2, $3, $4, $5, $6, $7, $8)
      `, [
        product_id,
        qtyToConsume,
        parseFloat(produto.estoque_atual),
        parseFloat(produto.estoque_atual) - qtyToConsume,
        'SERVICE_ORDER',
        machineId, // destino é o UUID da máquina atendida
        `Consumo na OS: ${id}`,
        req.user.id
      ]);

      // 6. Atualizar status da OS para IN_PROGRESS se estiver OPEN
      if (osCheck.rows[0].status === 'OPEN') {
        await client.query(`UPDATE service_orders SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1`, [id]);
      }

      await client.query('COMMIT'); // Consolida a Transação

      res.status(201).json(matResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK'); // Desfaz toda a transação atômica em caso de erro
      next(err);
    } finally {
      client.release(); // Libera a conexão de volta para o Pool
    }
  }
);

module.exports = router;
