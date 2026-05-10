/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function executar() {
  const arquivos = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.toLowerCase().includes('seed'))
    .sort();

  if (arquivos.length === 0) {
    console.log('Nenhuma migration de schema encontrada em', MIGRATIONS_DIR);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.query('SELECT filename FROM schema_migrations');
    const aplicadas = new Set(result.rows.map((r) => r.filename));

    const pendentes = arquivos.filter((f) => !aplicadas.has(f));

    if (pendentes.length === 0) {
      console.log('Nenhuma migration nova para aplicar.');
      return;
    }

    console.log(`Aplicando ${pendentes.length} migration(s) de schema...`);

    for (const arquivo of pendentes) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf8');
      console.log(`  → ${arquivo}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('✅ Migrations aplicadas com sucesso');
  } catch (err) {
    console.error('❌ Falha ao aplicar migration:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

executar();
