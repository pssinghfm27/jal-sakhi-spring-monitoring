// SPDX-License-Identifier: MIT
// Seeds villages, springs, a demo admin, manager, and KRP, plus an optional CSV import.
//
// CSV columns expected (header row required):
//   code, name_en, name_hi, village, gp, block, district, lat, lon, altitude_m, spring_type, project_name

import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, withTx } from './pool.js';
import { logger } from '../utils/logger.js';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const header = lines.shift().split(',').map((h) => h.trim());
  return lines.map((line) => {
    // Very small CSV parser: assumes no commas inside fields. For the spring master,
    // call sites are encouraged to keep names comma-free or pre-clean.
    const cells = line.split(',').map((c) => c.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

async function ensureVillage(client, { name, gp, block, district }) {
  const { rows } = await client.query(
    `INSERT INTO villages (name, gp, block, district) VALUES ($1,$2,$3,$4)
     ON CONFLICT (name, block, district) DO UPDATE SET gp = EXCLUDED.gp
     RETURNING id`,
    [name, gp || null, block, district],
  );
  return rows[0].id;
}

async function upsertSpring(client, row, villageId) {
  await client.query(
    `INSERT INTO springs (code, name_en, name_hi, village_id, lat, lon, altitude_m, spring_type, project_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (code) DO UPDATE SET
       name_en = EXCLUDED.name_en,
       name_hi = EXCLUDED.name_hi,
       village_id = EXCLUDED.village_id,
       lat = EXCLUDED.lat,
       lon = EXCLUDED.lon,
       altitude_m = EXCLUDED.altitude_m,
       spring_type = EXCLUDED.spring_type,
       project_name = EXCLUDED.project_name`,
    [
      row.code,
      row.name_en,
      row.name_hi,
      villageId,
      parseFloat(row.lat),
      parseFloat(row.lon),
      row.altitude_m ? parseInt(row.altitude_m, 10) : null,
      row.spring_type || null,
      row.project_name || null,
    ],
  );
}

async function seedDemoUsers(client) {
  const adminHash = await bcrypt.hash('chirag@2026', 10);
  const krpHash   = await bcrypt.hash('demo1234',   10);

  await client.query(
    `INSERT INTO users (email, password_hash, name, role, approval_status)
     VALUES ('manager@chirag.org', $1, 'Demo Manager', 'manager', 'approved')
     ON CONFLICT (email) DO NOTHING`,
    [adminHash],
  );
  await client.query(
    `INSERT INTO users (email, password_hash, name, role, approval_status)
     VALUES ('admin@chirag.org', $1, 'Demo Admin', 'admin', 'approved')
     ON CONFLICT (email) DO NOTHING`,
    [adminHash],
  );
  // Demo KRP: phone +919999900001 / password 'demo1234' (already approved)
  await client.query(
    `INSERT INTO users (phone, password_hash, name, role, village_id, trained_on, approval_status)
     SELECT '+919999900001', $1, 'Demo KRP', 'krp', v.id, CURRENT_DATE, 'approved'
     FROM villages v WHERE v.name = 'Lakhmar' LIMIT 1
     ON CONFLICT (phone) DO NOTHING`,
    [krpHash],
  );
}

async function main() {
  const csvArgIdx = process.argv.indexOf('--csv');
  const csvPath = csvArgIdx >= 0 ? process.argv[csvArgIdx + 1] : null;

  await withTx(async (client) => {
    // Always insert a small demo set so the system is usable out of the box.
    const demo = [
      { name: 'Lakhmar', gp: 'Lakhmar', block: 'Dhauladevi', district: 'Almora',
        springs: [
          { code: 'CHG-LKR-001', name_en: 'Lakhmar Naula', name_hi: 'लखमार नौला',
            lat: 29.6312, lon: 79.7841, altitude_m: 1620, spring_type: 'depression', project_name: 'Lakhmar Springshed' },
          { code: 'CHG-LKR-002', name_en: 'Upper Lakhmar', name_hi: 'ऊपरी लखमार',
            lat: 29.6334, lon: 79.7867, altitude_m: 1685, spring_type: 'contact', project_name: 'Lakhmar Springshed' },
        ] },
      { name: 'Chhidiyabahali', gp: 'Bhayanpur', block: 'Bhainsiyachhana', district: 'Almora',
        springs: [
          { code: 'CHG-CBL-001', name_en: 'Chhidiya Dhara', name_hi: 'छिड़िया धारा',
            lat: 29.5512, lon: 79.7011, altitude_m: 1502, spring_type: 'fracture', project_name: 'Chhidiyabahali Intervention' },
        ] },
      { name: 'Burguna', gp: 'Burguna', block: 'Dhauladevi', district: 'Almora',
        springs: [
          { code: 'CHG-BRG-001', name_en: 'Burguna Dhauladevi Spring', name_hi: 'बुर्गुना धौलादेवी स्रोत',
            lat: 29.6201, lon: 79.7522, altitude_m: 1570, spring_type: 'depression', project_name: 'DTR Burguna' },
        ] },
    ];

    for (const v of demo) {
      const vid = await ensureVillage(client, v);
      for (const s of v.springs) await upsertSpring(client, s, vid);
    }

    if (csvPath) {
      const abs = path.resolve(csvPath);
      logger.info(`Importing springs CSV: ${abs}`);
      const text = fs.readFileSync(abs, 'utf8');
      const rows = parseCsv(text);
      for (const row of rows) {
        const vid = await ensureVillage(client, {
          name: row.village,
          gp: row.gp,
          block: row.block,
          district: row.district,
        });
        await upsertSpring(client, row, vid);
      }
      logger.info(`Imported ${rows.length} springs from CSV`);
    }

    await seedDemoUsers(client);
  });

  logger.info('Seed complete. Demo credentials:');
  logger.info('  manager  →  manager@chirag.org  /  chirag@2026');
  logger.info('  admin    →  admin@chirag.org    /  chirag@2026');
  logger.info('  krp      →  +919999900001       /  demo1234');
  await pool.end();
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
