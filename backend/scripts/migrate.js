const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/stockyard';

const pool = new Pool({
  connectionString,
  // Optional SSL configuration if specified
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();
  console.log('[MIGRATION] Connected to PostgreSQL database.');

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already applied migrations
    const { rows: appliedRows } = await client.query('SELECT version FROM schema_migrations ORDER BY id ASC');
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    // 3. Scan migrations directory
    const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    let appliedCount = 0;

    for (const file of files) {
      if (!appliedVersions.has(file)) {
        console.log(`[MIGRATION] Applying: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`[MIGRATION] Successfully applied: ${file}`);
          appliedCount++;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[MIGRATION] Failed to apply ${file}:`, err.message);
          throw err;
        }
      } else {
        console.log(`[MIGRATION] Already applied: ${file}`);
      }
    }

    if (appliedCount === 0) {
      console.log('[MIGRATION] Database is up to date. No pending migrations.');
    } else {
      console.log(`[MIGRATION] Done. Applied ${appliedCount} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('[MIGRATION] Fatal migration error:', err.message);
  process.exit(1);
});
