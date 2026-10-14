// SPDX-License-Identifier: MIT
// Lazy-loaded — imported only when the user clicks "Export PDF" on Spring detail.
// jsPDF + jspdf-autotable add ~250 KB to that lazy chunk.

import type { SpringTrends } from '../api/types';
import { PARAM_LABEL, classify, STATUS_COLOR } from './bis';
import { fmtDate, fmtNum } from './format';

export async function exportSpringPdf(data: SpringTrends): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 36;
  const s = data.spring;

  // Header band
  doc.setFillColor(46, 125, 50); doc.rect(0, 0, W, 60, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text('CHIRAG · Spring Report', margin, 36);
  doc.setFontSize(10); doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, W - margin, 36, { align: 'right' });

  // Title block
  doc.setTextColor(27, 27, 27); doc.setFontSize(18); doc.text(s.name_en, margin, 92);
  doc.setFontSize(11); doc.setTextColor(107, 114, 128);
  doc.text(`${s.village} · ${s.block} · ${s.district}`, margin, 110);
  doc.text(`GPS ${fmtNum(s.lat, 5)}, ${fmtNum(s.lon, 5)}${s.altitude_m ? ` · ${s.altitude_m} m` : ''}`, margin, 124);
  doc.text(`Code ${s.code ?? '—'}  ·  Type ${s.spring_type ?? '—'}  ·  Project ${s.project_name ?? '—'}`, margin, 138);

  // Health score
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(1);
  doc.rect(W - margin - 160, 80, 160, 70);
  doc.setTextColor(107, 114, 128); doc.setFontSize(10);
  doc.text('Health score', W - margin - 152, 96);
  doc.setTextColor(27, 27, 27); doc.setFontSize(28);
  doc.text(String(data.health.total), W - margin - 152, 130);
  doc.setFontSize(9); doc.setTextColor(107, 114, 128);
  doc.text(`Disc ${data.health.components.discharge_stability} · BIS ${data.health.components.bis_compliance} · Reg ${data.health.components.sampling_regularity}`,
    W - margin - 152, 144);

  // Latest discharge table
  const latestDischarge = data.discharge.slice(-12).reverse();
  autoTable(doc, {
    startY: 170,
    head: [['Date', 'Discharge (L/min)', 'Method', 'Weather', 'Anomaly']],
    body: latestDischarge.map((d) => [
      fmtDate(d.recorded_at), fmtNum(d.discharge_lpm, 1), d.method, d.weather, d.anomaly ? 'YES' : '',
    ]),
    headStyles: { fillColor: [2, 119, 189], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });

  // Latest quality table
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const params = ['ph','tds','turbidity','hardness','alkalinity','chloride','iron','fecal_coliform'] as const;
  const head = ['Date', ...params.map((p) => PARAM_LABEL[p])];
  const body = data.quality.slice(-12).reverse().map((q) => {
    const row: (string | number)[] = [fmtDate(q.recorded_at)];
    params.forEach((p) => {
      const v = (q as unknown as Record<string, unknown>)[p] as number | null;
      const cls = classify(p, v);
      row.push(v === null ? '—' : (cls === 'green' ? `${v}` : cls === 'amber' ? `${v} *` : `${v} **`));
    });
    return row;
  });
  autoTable(doc, {
    startY: lastY + 16,
    head: [head],
    body,
    headStyles: { fillColor: [2, 119, 189], textColor: 255 },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  // Footer legend
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(8); doc.setTextColor(107, 114, 128);
  doc.text(`Legend: * = borderline (permissible) · ** = unsafe (outside permissible).  Reference: BIS 10500:2012.`,
    margin, y2 + 16);

  // Latest BIS status badge
  const latestQ = data.quality[data.quality.length - 1];
  if (latestQ) {
    let worst: 'green'|'amber'|'red'|'unknown' = 'green';
    params.forEach((p) => {
      const cls = classify(p, (latestQ as unknown as Record<string, unknown>)[p] as number | null);
      const order = { green: 0, amber: 1, red: 2, unknown: -1 };
      if (order[cls] > order[worst]) worst = cls;
    });
    const c = STATUS_COLOR[worst];
    const rgb = hexToRgb(c);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(W - margin - 90, y2 + 8, 90, 18, 4, 4, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10);
    doc.text(`Latest: ${worst.toUpperCase()}`, W - margin - 80, y2 + 21);
  }

  doc.save(`${s.code ?? s.name_en.replace(/\s+/g, '_')}_report.pdf`);
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{1,2}/g)!;
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}
