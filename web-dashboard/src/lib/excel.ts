// SPDX-License-Identifier: MIT
// Lazy-loaded raw-data export. exceljs adds ~600 KB to its chunk.

import type { SpringTrends } from '../api/types';
import { fmtDateTime } from './format';

export async function exportSpringExcel(data: SpringTrends): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CHIRAG Jal Sakhi';
  wb.created = new Date();

  const sp = wb.addWorksheet('Spring');
  sp.columns = [
    { header: 'Field', key: 'k', width: 22 },
    { header: 'Value', key: 'v', width: 40 },
  ];
  Object.entries(data.spring).forEach(([k, v]) => sp.addRow({ k, v }));

  const d = wb.addWorksheet('Discharge');
  d.columns = [
    { header: 'recorded_at', key: 'recorded_at', width: 24 },
    { header: 'discharge_lpm', key: 'discharge_lpm', width: 16 },
    { header: 'method', key: 'method', width: 14 },
    { header: 'weather', key: 'weather', width: 14 },
    { header: 'anomaly', key: 'anomaly', width: 10 },
  ];
  data.discharge.forEach((r) => d.addRow({ ...r, recorded_at: fmtDateTime(r.recorded_at) }));

  const q = wb.addWorksheet('Quality');
  q.columns = [
    { header: 'recorded_at', key: 'recorded_at', width: 24 },
    { header: 'pH', key: 'ph', width: 8 },
    { header: 'TDS', key: 'tds', width: 8 },
    { header: 'Turbidity', key: 'turbidity', width: 12 },
    { header: 'Hardness', key: 'hardness', width: 10 },
    { header: 'Alkalinity', key: 'alkalinity', width: 12 },
    { header: 'Chloride', key: 'chloride', width: 10 },
    { header: 'Iron', key: 'iron', width: 8 },
    { header: 'Fecal Coliform', key: 'fecal_coliform', width: 14 },
    { header: 'anomaly', key: 'anomaly', width: 10 },
  ];
  data.quality.forEach((r) => q.addRow({ ...r, recorded_at: fmtDateTime(r.recorded_at) }));

  [sp, d, q].forEach((ws) => {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.spring.code ?? data.spring.name_en.replace(/\s+/g, '_')}_data.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
