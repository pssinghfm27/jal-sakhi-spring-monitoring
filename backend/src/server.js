// SPDX-License-Identifier: MIT
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import krpRoutes from './routes/krp.js';
import springRoutes from './routes/springs.js';
import readingRoutes from './routes/readings.js';
import dashboardRoutes from './routes/dashboard.js';
import reminderRoutes from './routes/reminders.js';

import { startCron } from './jobs/scheduler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('tiny', { stream: { write: (m) => logger.info(m.trim()) } }));

// Static uploads (photos, voice notes)
app.use('/uploads', express.static(path.resolve(env.uploads.dir), { maxAge: '30d' }));

// API rate limit (per-IP) — auth endpoints get a tighter limiter inside their router
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Swagger UI
const openapiPath = path.resolve('./openapi.yaml');
if (fs.existsSync(openapiPath)) {
  const spec = yaml.load(openapiPath);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}

app.use('/auth', authRoutes);
app.use('/krp', krpRoutes);
app.use('/springs', springRoutes);
app.use('/readings', readingRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/reminders', reminderRoutes);

app.use((req, _res, next) => next({ status: 404, code: 'NOT_FOUND', message: `No route ${req.method} ${req.path}` }));
app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info(`Jal Sakhi API listening on :${env.port} (${env.nodeEnv})`);
  if (env.nodeEnv !== 'test') startCron();
});

const shutdown = (sig) => {
  logger.info(`Received ${sig}, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
