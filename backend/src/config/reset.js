/* eslint-disable no-console */
const { pool } = require('./database');

async function executar() {
  console.log('Resetando dados (DROP TABLE em todas as tabelas do usuario)...');
  const client = await pool.connect();
  try {
    // Lista todas as tabelas do schema public pertencentes ao usuario atual
    const { rows } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tableowner = current_user
      ORDER BY tablename
    `);

    if (rows.length === 0) {
      console.log('Nenhuma tabela para dropar (banco ja vazio)');
    } else {
      const nomes = rows.map((r) => `"${r.tablename}"`).join(', ');
      console.log(`Dropando ${rows.length} tabela(s): ${nomes}`);
      await client.query(`DROP TABLE IF EXISTS ${nomes} CASCADE`);
    }

    // Tipos enum tambem precisam sair (sao recriados pela migration).
    // Usa pg_roles (view publica) em vez de pg_authid (so superuser).
    const { rows: tipos } = await client.query(`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_roles r ON r.oid = t.typowner
      WHERE n.nspname = 'public'
        AND r.rolname = current_user
        AND t.typtype = 'e'
    `);

    let dropados = 0;
    for (const { typname } of tipos) {
      try {
        await client.query(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
        dropados += 1;
      } catch (err) {
        console.warn(`  ! ignorando tipo "${typname}": ${err.message}`);
      }
    }
    if (dropados) console.log(`Dropados ${dropados} tipo(s) enum`);

    console.log('✅ Schema resetado');
  } catch (err) {
    console.error('❌ Falha ao resetar:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

executar();
