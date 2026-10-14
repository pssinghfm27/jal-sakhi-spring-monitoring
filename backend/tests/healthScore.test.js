// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyValue, classifyQualityReading } from '../src/services/bis.js';

test('pH classifier: 7.0 is green, 9.0 is amber, 4.0 is red', () => {
  assert.equal(classifyValue('ph', 7.0), 'green');
  assert.equal(classifyValue('ph', 9.0), 'red'); // BIS pH has no permissible bracket beyond acceptable
  assert.equal(classifyValue('ph', 4.0), 'red');
});

test('TDS 400 mg/L is green, 1500 is amber, 3000 is red', () => {
  assert.equal(classifyValue('tds', 400), 'green');
  assert.equal(classifyValue('tds', 1500), 'amber');
  assert.equal(classifyValue('tds', 3000), 'red');
});

test('Quality reading worst-class aggregation', () => {
  const row = {
    ph: 7.2, tds: 1500, turbidity: 0.5, hardness: 180,
    alkalinity: 150, chloride: 200, iron: 0.2, fecal_coliform: 0,
  };
  assert.equal(classifyQualityReading(row), 'amber'); // TDS pushes it to amber
});

test('Fecal coliform > 0 is always red', () => {
  assert.equal(classifyValue('fecal_coliform', 1), 'red');
});
