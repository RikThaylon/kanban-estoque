const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { AppError } = require('../utils/errors');
const { coordenadasValidas, verificarLocalizacaoPermitida } = require('../services/geo.service');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

// ─── GET /api/v1/seguranca/geo-mfa ───────────────────────────────────────────
router.get('/geo-mfa', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM geo_mfa_config ORDER BY configurado_em DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ ativo: false, latitude: null, longitude: null, raio_metros: 1000 });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ─── POST /api/v1/seguranca/geo-mfa ──────────────────────────────────────────
router.post('/geo-mfa', authenticate, authorize('admin'),
  audit('CONFIGURAR_GEO_MFA', 'geo_mfa_config'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude inválida (-90 a 90)'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude inválida (-180 a 180)'),
    body('raio_metros').isInt({ min: 100, max: 50000 }).withMessage('Raio deve estar entre 100m e 50km'),
    body('descricao').optional().trim().isLength({ max: 200 }),
    body('ativo').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { latitude, longitude, raio_metros, descricao, ativo } = req.body;

      if (!coordenadasValidas(parseFloat(latitude), parseFloat(longitude))) {
        throw new AppError('Coordenadas geográficas inválidas', 400, 'VALIDATION_ERROR');
      }

      // Atualizar configuração existente ou inserir nova
      const existing = await query('SELECT id FROM geo_mfa_config LIMIT 1');
      let result;

      if (existing.rows.length > 0) {
        result = await query(`
          UPDATE geo_mfa_config
          SET latitude = $1, longitude = $2, raio_metros = $3, descricao = $4,
              ativo = COALESCE($5, ativo), configurado_por = $6, atualizado_em = NOW()
          RETURNING *
        `, [latitude, longitude, raio_metros, descricao || null, ativo, req.user.id]);
      } else {
        result = await query(`
          INSERT INTO geo_mfa_config (latitude, longitude, raio_metros, descricao, ativo, configurado_por)
          VALUES ($1, $2, $3, $4, COALESCE($5, false), $6) RETURNING *
        `, [latitude, longitude, raio_metros, descricao || null, ativo, req.user.id]);
      }

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/seguranca/geo-mfa/toggle ──────────────────────────────────
router.patch('/geo-mfa/toggle', authenticate, authorize('admin'),
  audit('TOGGLE_GEO_MFA', 'geo_mfa_config'),
  [body('ativo').isBoolean().withMessage('ativo deve ser boolean')],
  validate,
  async (req, res, next) => {
    try {
      const { ativo } = req.body;

      // Verificar se há configuração antes de ativar
      if (ativo) {
        const config = await query(
          'SELECT latitude, longitude, raio_metros FROM geo_mfa_config WHERE latitude IS NOT NULL LIMIT 1'
        );
        if (config.rows.length === 0) {
          throw new AppError(
            'Configure a localização antes de ativar o MFA Geográfico',
            400, 'VALIDATION_ERROR'
          );
        }
      }

      const result = await query(
        'UPDATE geo_mfa_config SET ativo = $1, atualizado_em = NOW(), configurado_por = $2 RETURNING *',
        [ativo, req.user.id]
      );

      res.json({
        message: ativo ? 'MFA Geográfico ativado com sucesso' : 'MFA Geográfico desativado',
        config: result.rows[0],
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/seguranca/geo-mfa/verificar ────────────────────────────────
// Usado no fluxo de login para validar localização do usuário
// Chamado APÓS autenticação com credenciais bem-sucedida
router.post('/geo-mfa/verificar', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    // Buscar configuração ativa
    const configResult = await query(
      'SELECT * FROM geo_mfa_config WHERE ativo = true LIMIT 1'
    );

    // MFA desabilitado — permitir sempre
    if (configResult.rows.length === 0) {
      await registrarTentativa({
        usuario_id: req.user.id,
        username: req.user.username,
        ip: req.ip,
        latitude: latitude || null,
        longitude: longitude || null,
        distancia_metros: null,
        raio_configurado: null,
        status: 'MFA_DESABILITADO',
      });
      return res.json({ permitido: true, motivo: 'MFA_DESABILITADO' });
    }

    const config = configResult.rows[0];

    // Sem localização fornecida
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      await registrarTentativa({
        usuario_id: req.user.id,
        username: req.user.username,
        ip: req.ip,
        latitude: null,
        longitude: null,
        distancia_metros: null,
        raio_configurado: config.raio_metros,
        status: 'SEM_LOCALIZACAO',
      });
      return res.status(403).json({
        permitido: false,
        motivo: 'SEM_LOCALIZACAO',
        message: 'Localização não fornecida. O MFA Geográfico está ativo e exige acesso à sua localização.',
      });
    }

    // Verificar se está dentro do raio
    const verificacao = verificarLocalizacaoPermitida({
      userLat: parseFloat(latitude),
      userLon: parseFloat(longitude),
      configLat: parseFloat(config.latitude),
      configLon: parseFloat(config.longitude),
      raioMetros: config.raio_metros,
    });

    const status = verificacao.permitido ? 'PERMITIDO' : 'BLOQUEADO';

    await registrarTentativa({
      usuario_id: req.user.id,
      username: req.user.username,
      ip: req.ip,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      distancia_metros: verificacao.distanciaMetros,
      raio_configurado: config.raio_metros,
      status,
    });

    if (!verificacao.permitido) {
      return res.status(403).json({
        permitido: false,
        motivo: 'FORA_DO_RAIO',
        distanciaMetros: verificacao.distanciaMetros,
        raioPermitidoMetros: config.raio_metros,
        message: `Acesso negado. Você está a ${verificacao.distanciaMetros}m da localização autorizada (raio: ${config.raio_metros}m).`,
      });
    }

    res.json({
      permitido: true,
      distanciaMetros: verificacao.distanciaMetros,
      raioPermitidoMetros: config.raio_metros,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/seguranca/geo-mfa/tentativas ────────────────────────────────
router.get('/geo-mfa/tentativas', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { status, usuario_id } = req.query;

    const where = [];
    const params = [];
    let idx = 1;

    if (status) { where.push(`t.status = $${idx++}`); params.push(status); }
    if (usuario_id) { where.push(`t.usuario_id = $${idx++}`); params.push(usuario_id); }

    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM geo_mfa_tentativas t ${whereStr}`, params),
      query(
        `SELECT t.*, u.nome AS usuario_nome
         FROM geo_mfa_tentativas t
         LEFT JOIN usuarios u ON u.id = t.usuario_id
         ${whereStr}
         ORDER BY t.criado_em DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const total = parseInt(countRes.rows[0].count);
    res.json(paginatedResponse(dataRes.rows, total, page, limit));
  } catch (err) { next(err); }
});

// ─── Helper: Registrar tentativa ─────────────────────────────────────────────
async function registrarTentativa({ usuario_id, username, ip, latitude, longitude, distancia_metros, raio_configurado, status }) {
  try {
    await query(`
      INSERT INTO geo_mfa_tentativas
        (usuario_id, username, ip, latitude, longitude, distancia_metros, raio_configurado, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [usuario_id, username, ip, latitude, longitude, distancia_metros, raio_configurado, status]);
  } catch (err) {
    // Non-critical — never fail the request due to audit failure
  }
}

module.exports = router;
