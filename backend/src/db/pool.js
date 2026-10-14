// SPDX-License-Identifier: MIT
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const cfg = env.db.url
  ? { connectionString: env.db.url }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    };

export const pool = new Pool({ ...cfg, max: 10, idleTimeoutMillis: 30_000 });

pool.on('error', (err) => logger.error({ err }, 'pg pool error'));

export const query = (text, params) => pool.query(text, params);

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
