// SPDX-License-Identifier: MIT
// Excel parser service — parses uploaded .xlsx spring data files
import { read, utils, write } from 'xlsx';

// Expected columns (case-insensitive matching)
const REQUIRED_COLS = ['code', 'name_en', 'village', 'block', 'district'];
const OPTIONAL_COLS = ['name_hi', 'gp', 'lat', 'lon', 'altitude_m', 'spring_type', 'project_name'];
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

/**
 * Parse an Excel buffer into structured spring rows.
 * Returns { rows: ParsedSpring[], errors: { row: number, message: string }[] }
 */
export function parseSpringExcel(buffer) {
  const wb = read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets');

  const raw = utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!raw.length) throw new Error('Sheet is empty');

  // Normalise headers — lowercase + trim + replace spaces/special chars with underscore
  const headerMap = {};
  const firstRow = raw[0];
  for (const key of Object.keys(firstRow)) {
    const norm = key.toLowerCase().trim().replace(/[\s\-\.]+/g, '_');
    headerMap[key] = norm;
  }

  // Map raw rows to normalised keys
  const normalised = raw.map((r) => {
    const out = {};
    for (const [orig, norm] of Object.entries(headerMap)) {
      out[norm] = typeof r[orig] === 'string' ? r[orig].trim() : r[orig];
    }
    return out;
  });

  // Check required columns exist
  const normKeys = Object.values(headerMap);
  const missing = REQUIRED_COLS.filter((c) => !normKeys.includes(c));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Found: ${normKeys.join(', ')}`);
  }

  const rows = [];
  const errors = [];

  for (let i = 0; i < normalised.length; i++) {
    const r = normalised[i];
    const rowNum = i + 2; // Excel row (1-indexed header + data)

    // Validate required fields
    const rowErrors = [];
    if (!r.code) rowErrors.push('code is empty');
    if (!r.name_en) rowErrors.push('name_en is empty');
    if (!r.village) rowErrors.push('village is empty');
    if (!r.block) rowErrors.push('block is empty');
    if (!r.district) rowErrors.push('district is empty');

    // Validate lat/lon if present
    if (r.lat !== '' && r.lat !== undefined) {
      const lat = Number(r.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) rowErrors.push(`invalid lat: ${r.lat}`);
      else r.lat = lat;
    } else { r.lat = null; }

    if (r.lon !== '' && r.lon !== undefined) {
      const lon = Number(r.lon);
      if (isNaN(lon) || lon < -180 || lon > 180) rowErrors.push(`invalid lon: ${r.lon}`);
      else r.lon = lon;
    } else { r.lon = null; }

    if (r.altitude_m !== '' && r.altitude_m !== undefined) {
      const alt = Number(r.altitude_m);
      if (isNaN(alt)) rowErrors.push(`invalid altitude_m: ${r.altitude_m}`);
      else r.altitude_m = alt;
    } else { r.altitude_m = null; }

    // Validate spring_type if present
    const validTypes = ['depression', 'contact', 'fracture', 'artesian', 'seepage', ''];
    if (r.spring_type && !validTypes.includes(r.spring_type.toLowerCase())) {
      rowErrors.push(`invalid spring_type: ${r.spring_type} (expected: depression/contact/fracture/artesian/seepage)`);
    } else if (r.spring_type) {
      r.spring_type = r.spring_type.toLowerCase();
    }

    if (rowErrors.length) {
      errors.push({ row: rowNum, message: rowErrors.join('; ') });
    } else {
      rows.push({
        code: String(r.code),
        name_en: String(r.name_en),
        name_hi: r.name_hi ? String(r.name_hi) : null,
        village: String(r.village),
        gp: r.gp ? String(r.gp) : null,
        block: String(r.block),
        district: String(r.district),
        lat: r.lat,
        lon: r.lon,
        altitude_m: r.altitude_m,
        spring_type: r.spring_type || null,
        project_name: r.project_name ? String(r.project_name) : null,
      });
    }
  }

  return { rows, errors, totalParsed: normalised.length };
}

/**
 * Generate a blank Excel template buffer for spring upload.
 */
export function generateTemplate() {
  const wb = utils.book_new();
  const header = ['code', 'name_en', 'name_hi', 'village', 'gp', 'block', 'district', 'lat', 'lon', 'altitude_m', 'spring_type', 'project_name'];
  const example = ['CHG-VIL-001', 'Village Spring', 'गाँव स्रोत', 'Lakhmar', 'Lakhmar', 'Dhauladevi', 'Almora', '29.6312', '79.7841', '1620', 'depression', 'CHIRAG Springshed'];
  const ws = utils.aoa_to_sheet([header, example]);

  // Set column widths
  ws['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 15) }));

  utils.book_append_sheet(wb, ws, 'Springs');
  return { buffer: write(wb, { type: 'buffer', bookType: 'xlsx' }), filename: 'jalsakhi-spring-template.xlsx' };
}


