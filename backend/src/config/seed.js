/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function executar() {
  const arquivos = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f.toLowerCase().includes('seed'))
    .sort();

  if (arquivos.length === 0) {
    console.log('Nenhum arquivo de seed encontrado em', MIGRATIONS_DIR);
    return;
  }

  console.log(`Aplicando ${arquivos.length} seed(s)...`);

  const client = await pool.connect();
  try {
    for (const arquivo of arquivos) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf8');
      console.log(`  → ${arquivo}`);
      await client.query(sql);
    }
    console.log('✅ Seed aplicado com sucesso');
  } catch (err) {
    console.error('❌ Falha ao aplicar seed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

executar();
