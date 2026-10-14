// SPDX-License-Identifier: MIT
import 'dotenv/config';

const required = (name, value) => {
  if (!value || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8080',

  jwt: {
    secret: required('JWT_SECRET', process.env.JWT_SECRET),
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  db: {
    url: process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'chirag',
    password: process.env.PGPASSWORD || 'chirag',
    database: process.env.PGDATABASE || 'jalsakhi',
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || '8', 10),
  },
};
