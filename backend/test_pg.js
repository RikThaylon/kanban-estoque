const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kanban_estoque'
  });

  try {
    const res = await pool.query('SELECT 1 WHERE \'a\' = ANY($1)', [['a', 'b']]);
    console.log('Result:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
