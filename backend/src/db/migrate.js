// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './pool.js';
import { logger } from '../utils/logger.js';

const DIR = path.resolve('./migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function applied() {
  const { rows } = await pool.query('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(rows.map((r) => r.id));
}

async function up() {
  await ensureTable();
  const done = await applied();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const id = parseInt(file.split('_')[0], 10);
    if (done.has(id)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    logger.info(`Applying migration ${file}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (id, filename) VALUES ($1, $2)', [id, file]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
  logger.info('Migrations complete');
  await pool.end();
}

async function down() {
  logger.warn('`down` is intentionally a no-op. Roll back via explicit reverse migrations.');
  await pool.end();
}

const cmd = process.argv[2] || 'up';
(cmd === 'down' ? down() : up()).catch((e) => {
  logger.error(e);
  process.exit(1);
});
