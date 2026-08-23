// Tests for server/lib/advancedStats.js's overrideDwsWithBdl -- pure DWS/WS/WS_PER48 recompute,
// no network. Covers the 2026-08-22 user decision to make BDL's def_ws authoritative over the
// homegrown Win Shares formula's own DWS.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const { overrideDwsWithBdl } = require('../server/lib/advancedStats');

// Real numbers from the discrepancy this override resolves (A'ja Wilson, 2025 season, live spike
// 2026-08-22): homegrown OWS/DWS/WS/WS_PER48 vs. BDL's def_ws (season total, per_mode='totals').
const HOMEGROWN_WS_VALS = [4.3, 1.71, 6.01, 0.232]; // [ows, dws, ws, wsPer48] -- ws/wsPer48 illustrative
const TOTAL_MIN = 40 * 31.2; // gp * mp, matches the live spike's 40 games at 31.2 mpg

test('overrideDwsWithBdl: swaps DWS and recomputes WS = OWS + BDL DWS', () => {
  const result = overrideDwsWithBdl(HOMEGROWN_WS_VALS, { bdlDefWs: 6.01 }, TOTAL_MIN);
  assert.strictEqual(result[0], 4.3, 'OWS is untouched');
  assert.strictEqual(result[1], 6.01, 'DWS is now BDL\'s number, not the homegrown 1.71');
  assert.strictEqual(result[2], 4.3 + 6.01, 'WS recomputed from the NEW DWS, not the old one');
});

test('overrideDwsWithBdl: WS_PER48 is recomputed from the new WS, not left as the old value', () => {
  const result = overrideDwsWithBdl(HOMEGROWN_WS_VALS, { bdlDefWs: 6.01 }, TOTAL_MIN);
  const expectedWsPer48 = (4.3 + 6.01) / (TOTAL_MIN / 48);
  assert.strictEqual(result[3], expectedWsPer48);
});

test('overrideDwsWithBdl: no BDL defense data (pre-2022 season, or ESPN provider) -> unchanged', () => {
  const result = overrideDwsWithBdl(HOMEGROWN_WS_VALS, null, TOTAL_MIN);
  assert.deepStrictEqual(result, HOMEGROWN_WS_VALS);
});

test('overrideDwsWithBdl: bdlDefense present but its own def_ws is null -> unchanged', () => {
  const result = overrideDwsWithBdl(HOMEGROWN_WS_VALS, { bdlDefWs: null }, TOTAL_MIN);
  assert.deepStrictEqual(result, HOMEGROWN_WS_VALS);
});

test('overrideDwsWithBdl: OWS itself is null (homegrown formula bailed) -> never overrides, even with real BDL data', () => {
  const noOws = [null, null, null, null];
  const result = overrideDwsWithBdl(noOws, { bdlDefWs: 6.01 }, TOTAL_MIN);
  assert.deepStrictEqual(result, noOws);
});

test('overrideDwsWithBdl: zero total minutes -> WS_PER48 is null, not divide-by-zero', () => {
  const result = overrideDwsWithBdl(HOMEGROWN_WS_VALS, { bdlDefWs: 6.01 }, 0);
  assert.strictEqual(result[3], null);
});
