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
  return \`OS-\${year}-\${seq}\`;
}

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
        throw new AppError(\`Estoque insuficiente. Disponível: \${produto.estoque_atual}\`, 400);
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
        \`Consumo na OS: \${id}\`,
        req.user.id
      ]);

      // 6. Atualizar status da OS para IN_PROGRESS se estiver OPEN
      if (osCheck.rows[0].status === 'OPEN') {
        await client.query(\`UPDATE service_orders SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1\`, [id]);
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
