// SPDX-License-Identifier: MIT
import { HttpError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // HttpError or any plain object that quacks like one ({status, code, message}).
  // The 404 catch-all uses a plain literal — honour it instead of returning 500.
  if (err instanceof HttpError ||
      (err && typeof err.status === 'number' && err.status >= 400 && err.status < 600)) {
    return res
      .status(err.status)
      .json({ error: { code: err.code || 'ERROR', message: err.message, details: err.details } });
  }
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors },
    });
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
