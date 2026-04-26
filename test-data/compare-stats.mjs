// Compares computed advanced stats from local API against BRef reference data.
// Usage: node test-data/compare-stats.mjs

const API = 'http://localhost:5000/api';

const PLAYERS = [
  { id: '981',    name: 'Vandersloot' },
  { id: '1068',   name: 'Ogwumike' },
  { id: '3142191', name: 'Mitchell' },
];

// BRef reference data — keyed by [name][year]
// Stats: PER, TS%, eFG%, 3PAr, FTr, ORB%, DRB%, TRB%, AST%, STL%, BLK%, TOV%, USG%, OWS, DWS, WS, WS/48
const BREF = {
  Vandersloot: {
    2011: { per: 8.0,  ts: .467, efg: .428, tpar: .274, ftr: .219, orbPct: 0.8,  drbPct: 9.4,  trbPct: 5.2,  astPct: 28.2, stlPct: 1.6, blkPct: 1.3, tovPct: 28.1, usgPct: 19.1, ows: -1.0, dws: 0.9,  ws: -0.1, wsPer48: -.008 },
    2012: { per: 10.6, ts: .476, efg: .454, tpar: .289, ftr: .196, orbPct: 0.8,  drbPct: 9.1,  trbPct: 4.9,  astPct: 31.0, stlPct: 2.6, blkPct: 0.7, tovPct: 26.0, usgPct: 21.2, ows: -0.5, dws: 1.2,  ws: 0.6,  wsPer48: .034  },
    2013: { per: 14.2, ts: .482, efg: .427, tpar: .209, ftr: .269, orbPct: 1.2,  drbPct: 11.0, trbPct: 6.1,  astPct: 31.2, stlPct: 2.4, blkPct: 2.1, tovPct: 21.5, usgPct: 17.3, ows: 1.0,  dws: 1.6,  ws: 2.6,  wsPer48: .125  },
    2014: { per: 12.8, ts: .482, efg: .440, tpar: .205, ftr: .205, orbPct: 2.1,  drbPct: 7.5,  trbPct: 5.0,  astPct: 37.4, stlPct: 2.4, blkPct: 1.5, tovPct: 26.9, usgPct: 17.6, ows: 0.0,  dws: 0.4,  ws: 0.4,  wsPer48: .042  },
    2015: { per: 19.6, ts: .560, efg: .514, tpar: .286, ftr: .225, orbPct: 2.5,  drbPct: 10.4, trbPct: 6.5,  astPct: 30.8, stlPct: 2.3, blkPct: 1.3, tovPct: 17.0, usgPct: 18.3, ows: 3.4,  dws: 0.9,  ws: 4.3,  wsPer48: .203  },
    2016: { per: 18.0, ts: .544, efg: .476, tpar: .323, ftr: .319, orbPct: 2.1,  drbPct: 10.8, trbPct: 6.5,  astPct: 28.0, stlPct: 2.9, blkPct: 0.5, tovPct: 15.3, usgPct: 18.5, ows: 1.9,  dws: 0.5,  ws: 2.4,  wsPer48: .156  },
    2017: { per: 18.6, ts: .594, efg: .569, tpar: .276, ftr: .146, orbPct: 2.4,  drbPct: 11.5, trbPct: 7.2,  astPct: 41.9, stlPct: 2.0, blkPct: 0.5, tovPct: 23.4, usgPct: 18.5, ows: 2.1,  dws: 0.5,  ws: 2.5,  wsPer48: .149  },
    2018: { per: 18.5, ts: .606, efg: .570, tpar: .406, ftr: .248, orbPct: 1.9,  drbPct: 11.4, trbPct: 6.8,  astPct: 43.4, stlPct: 2.1, blkPct: 1.3, tovPct: 25.2, usgPct: 19.3, ows: 2.1,  dws: 0.3,  ws: 2.3,  wsPer48: .117  },
    2019: { per: 20.5, ts: .552, efg: .503, tpar: .358, ftr: .268, orbPct: 2.4,  drbPct: 13.1, trbPct: 8.1,  astPct: 47.0, stlPct: 2.2, blkPct: 1.1, tovPct: 22.3, usgPct: 18.9, ows: 3.0,  dws: 1.1,  ws: 4.1,  wsPer48: .199  },
    2020: { per: 23.0, ts: .610, efg: .560, tpar: .349, ftr: .289, orbPct: 2.0,  drbPct: 11.1, trbPct: 6.8,  astPct: 46.3, stlPct: 1.9, blkPct: 0.9, tovPct: 18.0, usgPct: 19.3, ows: 3.4,  dws: 0.7,  ws: 4.1,  wsPer48: .281  },
    2021: { per: 17.5, ts: .526, efg: .493, tpar: .349, ftr: .164, orbPct: 1.9,  drbPct: 10.7, trbPct: 6.4,  astPct: 44.9, stlPct: 2.8, blkPct: 1.0, tovPct: 23.3, usgPct: 19.0, ows: 1.6,  dws: 1.4,  ws: 3.0,  wsPer48: .149  },
    2022: { per: 20.1, ts: .576, efg: .532, tpar: .279, ftr: .346, orbPct: 3.4,  drbPct: 13.3, trbPct: 8.7,  astPct: 37.6, stlPct: 2.3, blkPct: 1.5, tovPct: 21.1, usgPct: 22.1, ows: 2.1,  dws: 1.3,  ws: 3.5,  wsPer48: .196  },
    2023: { per: 16.7, ts: .521, efg: .493, tpar: .346, ftr: .184, orbPct: 1.9,  drbPct: 10.7, trbPct: 6.5,  astPct: 40.0, stlPct: 2.2, blkPct: 1.6, tovPct: 20.9, usgPct: 18.6, ows: 2.6,  dws: 1.9,  ws: 4.5,  wsPer48: .181  },
    2024: { per: 13.2, ts: .503, efg: .495, tpar: .368, ftr: .170, orbPct: 2.2,  drbPct: 11.1, trbPct: 6.8,  astPct: 33.1, stlPct: 1.9, blkPct: 1.9, tovPct: 22.3, usgPct: 16.4, ows: 0.7,  dws: 1.2,  ws: 1.9,  wsPer48: .134  },
    2025: { per: 15.4, ts: .516, efg: .477, tpar: .348, ftr: .197, orbPct: 1.2,  drbPct: 12.2, trbPct: 6.8,  astPct: 35.3, stlPct: 3.0, blkPct: 1.0, tovPct: 19.2, usgPct: 20.9, ows: 0.1,  dws: 0.1,  ws: 0.2,  wsPer48: .059  },
  },
  Ogwumike: {
    2012: { per: 23.8, ts: .583, efg: .536, tpar: .021, ftr: .429, orbPct: 12.7, drbPct: 17.6, trbPct: 15.3, astPct: 7.5,  stlPct: 2.5, blkPct: 2.5, tovPct: 9.6,  usgPct: 20.5, ows: 4.3,  dws: 1.7,  ws: 5.9,  wsPer48: .310  },
    2013: { per: 27.3, ts: .623, efg: .569, tpar: .015, ftr: .389, orbPct: 13.6, drbPct: 20.8, trbPct: 17.4, astPct: 9.1,  stlPct: 2.9, blkPct: 2.8, tovPct: 14.3, usgPct: 23.8, ows: 4.4,  dws: 2.1,  ws: 6.5,  wsPer48: .358  },
    2014: { per: 24.5, ts: .582, efg: .524, tpar: .026, ftr: .321, orbPct: 8.8,  drbPct: 23.1, trbPct: 15.8, astPct: 10.2, stlPct: 3.3, blkPct: 1.4, tovPct: 13.2, usgPct: 25.9, ows: 3.1,  dws: 1.8,  ws: 4.9,  wsPer48: .260  },
    2015: { per: 22.5, ts: .587, efg: .527, tpar: .043, ftr: .346, orbPct: 8.0,  drbPct: 17.9, trbPct: 13.2, astPct: 12.4, stlPct: 1.7, blkPct: 1.1, tovPct: 11.8, usgPct: 22.8, ows: 3.0,  dws: 0.7,  ws: 3.7,  wsPer48: .229  },
    2016: { per: 31.3, ts: .737, efg: .687, tpar: .071, ftr: .458, orbPct: 9.9,  drbPct: 25.3, trbPct: 18.1, astPct: 17.9, stlPct: 2.1, blkPct: 3.0, tovPct: 13.7, usgPct: 23.0, ows: 7.0,  dws: 2.7,  ws: 9.6,  wsPer48: .444  },
    2017: { per: 28.1, ts: .636, efg: .582, tpar: .122, ftr: .354, orbPct: 7.8,  drbPct: 23.2, trbPct: 16.0, astPct: 12.4, stlPct: 3.1, blkPct: 1.5, tovPct: 9.4,  usgPct: 24.4, ows: 5.5,  dws: 2.9,  ws: 8.4,  wsPer48: .385  },
    2018: { per: 21.5, ts: .580, efg: .539, tpar: .081, ftr: .270, orbPct: 7.0,  drbPct: 20.1, trbPct: 13.4, astPct: 11.6, stlPct: 2.7, blkPct: 1.2, tovPct: 10.0, usgPct: 22.9, ows: 2.2,  dws: 1.8,  ws: 4.0,  wsPer48: .231  },
    2019: { per: 25.7, ts: .575, efg: .538, tpar: .167, ftr: .229, orbPct: 9.3,  drbPct: 26.6, trbPct: 18.0, astPct: 12.4, stlPct: 3.4, blkPct: 1.4, tovPct: 11.5, usgPct: 25.2, ows: 3.1,  dws: 2.4,  ws: 5.5,  wsPer48: .298  },
    2020: { per: 20.0, ts: .636, efg: .596, tpar: .108, ftr: .293, orbPct: 5.5,  drbPct: 17.0, trbPct: 11.3, astPct: 10.9, stlPct: 2.0, blkPct: 0.6, tovPct: 12.9, usgPct: 20.9, ows: 1.5,  dws: 0.8,  ws: 2.3,  wsPer48: .231  },
    2021: { per: 20.0, ts: .586, efg: .559, tpar: .146, ftr: .195, orbPct: 5.2,  drbPct: 19.8, trbPct: 12.3, astPct: 17.6, stlPct: 2.4, blkPct: 0.8, tovPct: 14.9, usgPct: 21.5, ows: 1.1,  dws: 1.1,  ws: 2.2,  wsPer48: .183  },
    2022: { per: 23.0, ts: .604, efg: .567, tpar: .124, ftr: .251, orbPct: 5.4,  drbPct: 20.9, trbPct: 12.9, astPct: 12.5, stlPct: 2.7, blkPct: 1.3, tovPct: 10.9, usgPct: 24.2, ows: 3.1,  dws: 0.9,  ws: 4.0,  wsPer48: .181  },
    2023: { per: 25.3, ts: .587, efg: .532, tpar: .120, ftr: .312, orbPct: 6.2,  drbPct: 28.7, trbPct: 17.1, astPct: 18.4, stlPct: 2.8, blkPct: 2.2, tovPct: 12.0, usgPct: 27.3, ows: 3.1,  dws: 2.5,  ws: 5.6,  wsPer48: .241  },
    2024: { per: 22.6, ts: .578, efg: .542, tpar: .150, ftr: .197, orbPct: 6.6,  drbPct: 20.7, trbPct: 13.5, astPct: 13.1, stlPct: 3.0, blkPct: 1.5, tovPct: 8.4,  usgPct: 21.8, ows: 3.7,  dws: 2.7,  ws: 6.4,  wsPer48: .261  },
    2025: { per: 21.8, ts: .600, efg: .572, tpar: .292, ftr: .191, orbPct: 5.1,  drbPct: 22.8, trbPct: 13.7, astPct: 13.5, stlPct: 1.9, blkPct: 1.2, tovPct: 11.3, usgPct: 25.4, ows: 3.3,  dws: 2.4,  ws: 5.7,  wsPer48: .201  },
  },
  Mitchell: {
    2018: { per: 11.7, ts: .477, efg: .432, tpar: .510, ftr: .237, orbPct: 1.2,  drbPct: 7.6,  trbPct: 4.2,  astPct: 20.6, stlPct: 1.4, blkPct: 0.4, tovPct: 12.7, usgPct: 28.4, ows: -0.6, dws: 0.2,  ws: -0.5, wsPer48: -.026 },
    2019: { per: 15.1, ts: .506, efg: .478, tpar: .488, ftr: .141, orbPct: 0.6,  drbPct: 6.8,  trbPct: 3.8,  astPct: 20.2, stlPct: 0.9, blkPct: 0.4, tovPct: 11.0, usgPct: 27.3, ows: 1.2,  dws: -0.1, ws: 1.1,  wsPer48: .062  },
    2020: { per: 15.0, ts: .579, efg: .539, tpar: .468, ftr: .237, orbPct: 1.0,  drbPct: 7.2,  trbPct: 4.1,  astPct: 16.2, stlPct: 1.0, blkPct: 0.2, tovPct: 13.7, usgPct: 24.7, ows: 1.4,  dws: -0.5, ws: 0.9,  wsPer48: .058  },
    2021: { per: 16.4, ts: .537, efg: .502, tpar: .425, ftr: .173, orbPct: 2.3,  drbPct: 7.3,  trbPct: 4.7,  astPct: 14.8, stlPct: 1.7, blkPct: 0.6, tovPct: 10.9, usgPct: 25.1, ows: 2.0,  dws: -0.4, ws: 1.6,  wsPer48: .074  },
    2022: { per: 17.6, ts: .568, efg: .519, tpar: .394, ftr: .273, orbPct: 1.5,  drbPct: 5.7,  trbPct: 3.5,  astPct: 25.0, stlPct: 1.4, blkPct: 0.6, tovPct: 12.7, usgPct: 24.6, ows: 2.6,  dws: -0.4, ws: 2.2,  wsPer48: .106  },
    2023: { per: 16.6, ts: .580, efg: .533, tpar: .461, ftr: .297, orbPct: 1.1,  drbPct: 4.8,  trbPct: 2.9,  astPct: 16.4, stlPct: 1.4, blkPct: 0.1, tovPct: 12.8, usgPct: 23.9, ows: 3.4,  dws: -0.1, ws: 3.3,  wsPer48: .118  },
    2024: { per: 18.2, ts: .588, efg: .559, tpar: .450, ftr: .188, orbPct: 2.5,  drbPct: 6.5,  trbPct: 4.5,  astPct: 9.9,  stlPct: 1.1, blkPct: 0.5, tovPct: 8.9,  usgPct: 24.9, ows: 3.7,  dws: -0.5, ws: 3.2,  wsPer48: .122  },
    2025: { per: 19.9, ts: .574, efg: .536, tpar: .408, ftr: .275, orbPct: 1.6,  drbPct: 5.3,  trbPct: 3.4,  astPct: 19.6, stlPct: 1.4, blkPct: 0.5, tovPct: 9.1,  usgPct: 27.7, ows: 4.5,  dws: 1.0,  ws: 5.6,  wsPer48: .193  },
  },
};

// BRef displays TS%/eFG%/3PAr/FTr as 3-decimal values (e.g. .560), stored as decimals in BREF.
// TOV%/USG%/AST%/ORB%/DRB%/TRB%/STL%/BLK% are stored as percentages (e.g. 17.0) in BREF.
// Our API returns all as decimals (0-1). scale=1 for stats where BREF is decimal, scale=100 for percent.
const STAT_MAP = [
  { key: 'ts',      col: 3,  label: 'TS%',     scale: 1,   dp: 3 },
  { key: 'efg',     col: 4,  label: 'eFG%',    scale: 1,   dp: 3 },
  { key: 'tpar',    col: 5,  label: '3PAr',    scale: 1,   dp: 3 },
  { key: 'ftr',     col: 6,  label: 'FTr',     scale: 1,   dp: 3 },
  { key: 'tovPct',  col: 7,  label: 'TOV%',    scale: 100, dp: 1 },
  { key: 'usgPct',  col: 8,  label: 'USG%',    scale: 100, dp: 1 },
  { key: 'astPct',  col: 9,  label: 'AST%',    scale: 100, dp: 1 },
  { key: 'orbPct',  col: 10, label: 'ORB%',    scale: 100, dp: 1 },
  { key: 'drbPct',  col: 11, label: 'DRB%',    scale: 100, dp: 1 },
  { key: 'trbPct',  col: 12, label: 'TRB%',    scale: 100, dp: 1 },
  { key: 'stlPct',  col: 13, label: 'STL%',    scale: 100, dp: 1 },
  { key: 'blkPct',  col: 14, label: 'BLK%',    scale: 100, dp: 1 },
  { key: 'per',     col: 15, label: 'PER',     scale: 1,   dp: 1 },
  { key: 'ows',     col: 16, label: 'OWS',     scale: 1,   dp: 2 },
  { key: 'dws',     col: 17, label: 'DWS',     scale: 1,   dp: 2 },
  { key: 'ws',      col: 18, label: 'WS',      scale: 1,   dp: 2 },
  { key: 'wsPer48', col: 19, label: 'WS/48',   scale: 1,   dp: 3 },
];

function fmt(v, dp) {
  if (v == null) return 'null';
  return v.toFixed(dp);
}

async function fetchAdv(playerId) {
  const res = await fetch(`${API}/players/${playerId}/advanced-pbp-all`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function run() {
  for (const { id, name } of PLAYERS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${name} (ESPN ID: ${id})`);
    console.log('='.repeat(70));

    let data;
    try {
      data = await fetchAdv(id);
    } catch (e) {
      console.log(`  FAILED: ${e.message}`);
      continue;
    }

    const rows = data?.regular?.rows ?? [];
    const bref = BREF[name];

    const errors = { total: 0, count: 0 };
    const statErrors = {};
    for (const s of STAT_MAP) statErrors[s.key] = { total: 0, count: 0, max: 0, maxYear: null };

    const header = 'Year | Stat       | BRef   | Ours   | Diff  ';
    console.log(`\n${header}`);
    console.log('-'.repeat(header.length));

    for (const row of rows) {
      const year = row[0];
      const bRow = bref?.[year];
      if (!bRow) continue;

      for (const s of STAT_MAP) {
        const raw = row[s.col];
        if (raw == null) continue;
        // Our computed values are 0-1 decimals; multiply by scale to get display units.
        // BRef values are already in display units (e.g. 28.1 for TOV%, 19.6 for PER).
        const ours = raw * s.scale;
        const bVal = bRow[s.key];
        if (bVal == null) continue;
        const diff = ours - bVal;
        const absDiff = Math.abs(diff);

        statErrors[s.key].total += absDiff;
        statErrors[s.key].count++;
        if (absDiff > statErrors[s.key].max) {
          statErrors[s.key].max = absDiff;
          statErrors[s.key].maxYear = year;
        }
        errors.total += absDiff;
        errors.count++;

        const bigThresh  = s.scale === 100 ? 2.0  : (s.key.includes('ws') ? 1.0  : 0.5);
        const showThresh = s.scale === 100 ? 1.0  : (s.key.includes('ws') ? 0.4  : 0.01);
        const flag = absDiff > bigThresh ? ' <<<' : '';
        if (flag || absDiff > showThresh) {
          console.log(`${String(year).padEnd(5)}| ${s.label.padEnd(11)}| ${fmt(bVal, s.dp).padStart(6)} | ${fmt(ours, s.dp).padStart(6)} | ${(diff >= 0 ? '+' : '') + fmt(diff, s.dp).padStart(5)}${flag}`);
        }
      }
    }

    console.log('\n--- Per-stat average absolute error ---');
    for (const s of STAT_MAP) {
      const e = statErrors[s.key];
      if (!e.count) continue;
      const avg = e.total / e.count;
      const threshold = s.scale === 100 ? 1.0 : (s.key.includes('ws') ? 0.5 : 0.005);
      const flag = avg > threshold ? ' <<<' : '';
      console.log(`  ${s.label.padEnd(8)} avg=${fmt(avg, s.dp === 3 ? 3 : 2)}  max=${fmt(e.max, s.dp)}@${e.maxYear}${flag}`);
    }

    if (errors.count > 0) {
      console.log(`\nOverall avg abs error across all stats: ${(errors.total / errors.count).toFixed(3)}`);
    }
  }
}

run().catch(console.error);
