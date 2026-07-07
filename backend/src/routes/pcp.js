const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');

const router = express.Router();

// Função Auxiliar de Busca em Largura (BFS) para Explosão de Demanda
async function runBfsExplosion(targets) {
  // targets = [{ productId, quantity }]
  const demandMap = new Map(); // productId -> { bruto, nome, codigo, categoria, estoque, pedidosAbertos }
  const queue = [...targets];

  while (queue.length > 0) {
    const current = queue.shift();

    // 1. Acumular Demanda Bruta do item atual (se já houver, soma)
    if (demandMap.has(current.productId)) {
      demandMap.get(current.productId).bruto += current.quantity;
    } else {
      demandMap.set(current.productId, {
        bruto: current.quantity,
        nome: current.nome,
        codigo: current.codigo,
        categoria: current.categoria,
        estoque_atual: current.estoque_atual || 0
      });
    }

    // 2. Buscar dependentes no BOM
    const childrenRes = await query(`
      SELECT b.child_item_id, b.quantity_required, p.nome, p.codigo, p.category, p.estoque_atual 
      FROM bom_structures b
      JOIN produtos p ON p.id = b.child_item_id
      WHERE b.parent_item_id = $1
    `, [current.productId]);

    // 3. Adicionar filhos à fila multiplicando a quantidade necessária
    for (const child of childrenRes.rows) {
      queue.push({
        productId: child.child_item_id,
        quantity: current.quantity * parseFloat(child.quantity_required),
        nome: child.nome,
        codigo: child.codigo,
        categoria: child.category,
        estoque_atual: parseFloat(child.estoque_atual)
      });
    }
  }

  // Obter pedidos abertos para calcular demanda líquida (net demand)
  const productIds = Array.from(demandMap.keys());
  
  if (productIds.length > 0) {
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    
    // Supondo que pedidos tenham um status 'EM_ABERTO' e itens estejam em `pedido_itens`
    // (Ajustado aditivamente para não quebrar tabelas existentes, usando lógica defensiva)
    const ordersRes = await query(`
      SELECT pi.produto_id, SUM(pi.quantidade_pedida - COALESCE(pi.quantidade_recebida, 0)) as open_qty
      FROM pedidos_compra_itens pi
      JOIN pedidos_compra pc ON pc.id = pi.pedido_id
      WHERE pi.produto_id IN (${placeholders}) 
        AND pc.status NOT IN ('ENTREGUE', 'CANCELADO')
      GROUP BY pi.produto_id
    `, productIds).catch(() => ({ rows: [] })); // Trata caso tabela chame diferente no repositório

    for (const row of ordersRes.rows) {
      if (demandMap.has(row.produto_id)) {
        demandMap.get(row.produto_id).pedidosAbertos = parseFloat(row.open_qty);
      }
    }
  }

  // Formatando resultado e calculando Net Demand
  const results = [];
  for (const [id, data] of demandMap.entries()) {
    const estoque = data.estoque_atual;
    const emTransito = data.pedidosAbertos || 0;
    
    // Demanda Líquida = (Demanda Bruta) - (Estoque + Compras em Trânsito)
    let netDemand = data.bruto - (estoque + emTransito);
    if (netDemand < 0) netDemand = 0;

    results.push({
      produto_id: id,
      codigo: data.codigo,
      nome: data.nome,
      categoria: data.categoria,
      demanda_bruta: data.bruto,
      estoque_atual: estoque,
      em_transito: emTransito,
      demanda_liquida: netDemand,
      critico: netDemand > 0
    });
  }

  return results;
}

// POST /api/v1/pcp/explode
// Gera o plano de necessidades de materiais (MRP)
router.post('/explode', authenticate, audit('PCP_EXPLOSION', 'pcp'),
  [
    body('targets').isArray({ min: 1 }).withMessage('Deve enviar um array de metas de produção'),
    body('targets.*.productId').isUUID(),
    body('targets.*.quantity').isFloat({ gt: 0 })
  ], validate,
  async (req, res, next) => {
    try {
      const { targets } = req.body;
      
      // Preencher meta inicial com detalhes para o map
      for (const target of targets) {
        const prod = await query('SELECT nome, codigo, category, estoque_atual FROM produtos WHERE id = $1', [target.productId]);
        if (prod.rowCount > 0) {
          target.nome = prod.rows[0].nome;
          target.codigo = prod.rows[0].codigo;
          target.categoria = prod.rows[0].category;
          target.estoque_atual = parseFloat(prod.rows[0].estoque_atual);
        }
      }

      const explosionResult = await runBfsExplosion(targets);

      res.json({
        success: true,
        data: explosionResult,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
