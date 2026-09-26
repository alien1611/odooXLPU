const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/stockyard';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB POOL] Unexpected error on idle client:', err.message);
});

/**
 * Executes a SQL query using a connection from the pool.
 * @param {string} text - SQL query text
 * @param {Array} [params] - Query parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Checks connection health to PostgreSQL.
 * @returns {Promise<{ ok: boolean, version?: string, latencyMs?: number, error?: string }>}
 */
async function testConnection() {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT version(), NOW() as server_time');
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      serverTime: res.rows[0].server_time,
      version: res.rows[0].version,
      latencyMs
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
