// SPDX-License-Identifier: MIT
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Unauthorized, Forbidden } from '../utils/errors.js';

export function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(Unauthorized('Missing bearer token'));
  try {
    req.user = jwt.verify(token, env.jwt.secret);
    return next();
  } catch {
    return next(Unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!allowed.includes(req.user.role)) return next(Forbidden('Insufficient role'));
    return next();
  };
}

// helper: tiny wrapper to make async handlers forward errors
export const asyncH = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
