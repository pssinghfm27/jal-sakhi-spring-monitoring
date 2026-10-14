// SPDX-License-Identifier: MIT
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

fs.mkdirSync(env.uploads.dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploads.dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  },
});

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/3gpp']);

export const upload = multer({
  storage,
  limits: { fileSize: env.uploads.maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  },
});

export const publicUrl = (filename) => `${env.publicBaseUrl}/uploads/${filename}`;
