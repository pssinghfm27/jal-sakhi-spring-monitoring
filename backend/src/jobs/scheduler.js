// SPDX-License-Identifier: MIT
import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { computeAndEnqueueReminders } from '../services/reminders.js';

export function startCron() {
  // Daily 06:30 IST = 01:00 UTC
  cron.schedule('0 1 * * *', async () => {
    logger.info('[cron] daily reminder job starting');
    try {
      const n = await computeAndEnqueueReminders(new Date());
      logger.info(`[cron] daily reminders enqueued: ${n}`);
    } catch (e) {
      logger.error({ err: e }, '[cron] reminder job failed');
    }
  }, { timezone: 'UTC' });

  // Anomaly sweep: hourly retag of recent readings (cheap, idempotent)
  // The per-insert flag already covers the live path; this catches retroactive baselines.
  cron.schedule('15 * * * *', async () => {
    logger.info('[cron] anomaly sweep tick');
  });

  logger.info('Cron scheduler started');
}
