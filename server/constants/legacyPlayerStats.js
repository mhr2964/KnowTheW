// legacyPlayerStats.js — hand-curated season stats for pre-2002 WNBA legends.
//
// Why this exists: ESPN's player API returns sparse or empty data for many pre-2002 careers,
// so players like Cynthia Cooper and early-career Sheryl Swoopes show up missing in the
// normal flow. This constant fills that gap with Wikipedia-sourced per-game stats so the
// search/profile/detailed-stats/graded-report pipeline can serve historical greats.
//
// Source: Wikipedia regular-season career stat tables, extracted 2026-05-11.
// Advanced stats (PER, WS, TS%) are NOT included — Wikipedia does not publish them
// and BBRef scraping is out of scope. The graded-report prompt is told to grade legacy
// players from per-game + accolades alone.
//
// Synthetic id pattern: `<lastname>-<firstname>-<birthyear>` (lowercase, no spaces).
// Birthyear distinguishes namesakes; if unknown we use first WNBA season.
//
// seasonRows: array of objects keyed by ESPN_DETAILED_HEADERS column names from
// statsParser.js, so the same downstream rowToObj() works without branching. Each row
// represents a regular-season per-game line (no per-totals; the route synthesises totals
// where needed).

'use strict';

const { ESPN_DETAILED_HEADERS } = require('../lib/statsParser');

// Build a season-row object from per-game inputs. Fields not provided default to null
// (Wikipedia does not publish OREB/DREB/TOV/PF for older players consistently).
//   season   — '1997' style string
//   team     — abbreviation like 'HOU', 'LAS', 'SEA', 'NYL', 'SAC'
//   pg       — per-game stats object
function row(season, team, pg) {
  const r = {
    SEASON_ID:          season,
    TEAM_ABBREVIATION:  team,
    GP:                 pg.gp  ?? null,
    GS:                 pg.gs  ?? null,
    MIN:                pg.min ?? null,
    FGM:                pg.fgm ?? null,
    FGA:                pg.fga ?? null,
    FG_PCT:             pg.fgPct ?? null,
    FG3M:               pg.fg3m ?? null,
    FG3A:               pg.fg3a ?? null,
    FG3_PCT:            pg.fg3Pct ?? null,
    FTM:                pg.ftm ?? null,
    FTA:                pg.fta ?? null,
    FT_PCT:             pg.ftPct ?? null,
    OREB:               pg.oreb ?? null,
    DREB:               pg.dreb ?? null,
    REB:                pg.reb ?? null,
    AST:                pg.ast ?? null,
    STL:                pg.stl ?? null,
    BLK:                pg.blk ?? null,
    TOV:                pg.tov ?? null,
    PF:                 pg.pf  ?? null,
    PTS:                pg.pts ?? null,
  };
  return r;
}

// All percentages stored as decimals (0.470 not 47.0) to match ESPN's
// parseStat output convention used elsewhere in the codebase.
const LEGACY_PLAYERS = {

  // ── Cynthia Cooper — 4× champ, 2× MVP, 3× Finals MVP ─────────────────────
  'cooper-cynthia-1963': {
    id:          'cooper-cynthia-1963',
    name:        'Cynthia Cooper',
    position:    'G',
    retired:     true,
    finalTeam:   'Houston Comets',
    careerYears: [1997, 1998, 1999, 2000, 2003],
    seasonRows: [
      row('1997', 'HOU', { gp:28, min:35.1, pts:22.2, reb:4.0, ast:4.7, stl:2.1, blk:0.2, tov:3.9, fgPct:0.470, fg3Pct:0.414, ftPct:0.864 }),
      row('1998', 'HOU', { gp:30, min:35.0, pts:22.7, reb:3.7, ast:4.4, stl:1.6, blk:0.4, tov:3.2, fgPct:0.446, fg3Pct:0.400, ftPct:0.854 }),
      row('1999', 'HOU', { gp:31, min:35.5, pts:22.1, reb:2.8, ast:5.2, stl:1.4, blk:0.4, tov:3.4, fgPct:0.463, fg3Pct:0.335, ftPct:0.891 }),
      row('2000', 'HOU', { gp:31, min:35.0, pts:17.7, reb:2.7, ast:5.0, stl:1.3, blk:0.2, tov:3.2, fgPct:0.459, fg3Pct:0.355, ftPct:0.875 }),
      row('2003', 'HOU', { gp:4,  min:36.0, pts:16.0, reb:2.5, ast:5.5, stl:1.0, blk:0.3, tov:3.5, fgPct:0.421, fg3Pct:0.389, ftPct:0.893 }),
    ],
  },

  // ── Sheryl Swoopes — 3× MVP, 4× champ, 3× DPOY ───────────────────────────
  // Missed 2001 entirely (torn ACL). 2009-2010 not listed in WP table.
  'swoopes-sheryl-1971': {
    id:          'swoopes-sheryl-1971',
    name:        'Sheryl Swoopes',
    position:    'F',
    retired:     true,
    finalTeam:   'Tulsa Shock',
    careerYears: [1997, 1998, 1999, 2000, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2011],
    seasonRows: [
      row('1997', 'HOU', { gp:9,  min:14.3, pts:7.1,  reb:1.7, ast:0.8, stl:0.8, blk:0.4, fgPct:0.472, fg3Pct:0.250, ftPct:0.714 }),
      row('1998', 'HOU', { gp:29, min:32.3, pts:15.6, reb:5.1, ast:2.1, stl:2.5, blk:0.5, fgPct:0.427, fg3Pct:0.360, ftPct:0.826 }),
      row('1999', 'HOU', { gp:32, min:34.4, pts:18.3, reb:6.3, ast:4.0, stl:2.4, blk:1.4, fgPct:0.462, fg3Pct:0.337, ftPct:0.820 }),
      row('2000', 'HOU', { gp:31, min:35.2, pts:20.7, reb:6.3, ast:3.8, stl:2.8, blk:1.1, fgPct:0.506, fg3Pct:0.374, ftPct:0.821 }),
      row('2002', 'HOU', { gp:32, min:36.1, pts:18.5, reb:4.9, ast:3.3, stl:2.8, blk:0.7, fgPct:0.434, fg3Pct:0.288, ftPct:0.825 }),
      row('2003', 'HOU', { gp:31, min:35.0, pts:15.6, reb:4.6, ast:3.9, stl:2.5, blk:0.8, fgPct:0.406, fg3Pct:0.304, ftPct:0.887 }),
      row('2004', 'HOU', { gp:31, min:34.5, pts:14.8, reb:4.9, ast:2.9, stl:1.5, blk:0.5, fgPct:0.422, fg3Pct:0.308, ftPct:0.856 }),
      row('2005', 'HOU', { gp:33, min:37.1, pts:18.6, reb:3.6, ast:4.3, stl:2.0, blk:0.8, fgPct:0.447, fg3Pct:0.360, ftPct:0.850 }),
      row('2006', 'HOU', { gp:31, min:35.8, pts:15.5, reb:5.9, ast:3.7, stl:2.1, blk:0.3, fgPct:0.413, fg3Pct:0.278, ftPct:0.764 }),
      row('2007', 'HOU', { gp:3,  min:35.3, pts:7.7,  reb:5.7, ast:3.7, stl:1.7, blk:0.3, fgPct:0.360, fg3Pct:0.143, ftPct:1.000 }),
      row('2008', 'SEA', { gp:29, min:24.3, pts:7.1,  reb:4.3, ast:2.1, stl:1.5, blk:0.3, fgPct:0.391, fg3Pct:0.222, ftPct:0.695 }),
      row('2011', 'TUL', { gp:33, min:29.9, pts:8.2,  reb:4.1, ast:2.3, stl:0.8, blk:0.3, fgPct:0.398, fg3Pct:0.319, ftPct:0.870 }),
    ],
  },

  // ── Lisa Leslie — 2× MVP, 2× champ, 3× DPOY, 8× All-WNBA First ──────────
  // Missed 2007 (pregnancy).
  'leslie-lisa-1972': {
    id:          'leslie-lisa-1972',
    name:        'Lisa Leslie',
    position:    'C',
    retired:     true,
    finalTeam:   'Los Angeles Sparks',
    careerYears: [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2008, 2009],
    seasonRows: [
      row('1997', 'LAS', { gp:28, min:32.2, pts:15.9, reb:9.5,  ast:2.6, stl:1.4, blk:2.1, fgPct:0.431, fg3Pct:0.261, ftPct:0.598 }),
      row('1998', 'LAS', { gp:28, min:32.1, pts:19.6, reb:10.2, ast:2.5, stl:1.5, blk:2.1, fgPct:0.478, fg3Pct:0.391, ftPct:0.768 }),
      row('1999', 'LAS', { gp:32, min:29.1, pts:15.6, reb:7.8,  ast:1.8, stl:1.1, blk:1.5, fgPct:0.468, fg3Pct:0.423, ftPct:0.731 }),
      row('2000', 'LAS', { gp:32, min:32.1, pts:17.8, reb:9.6,  ast:1.9, stl:1.0, blk:2.3, fgPct:0.458, fg3Pct:0.219, ftPct:0.824 }),
      row('2001', 'LAS', { gp:31, min:33.3, pts:19.5, reb:9.6,  ast:2.4, stl:1.1, blk:2.3, fgPct:0.473, fg3Pct:0.367, ftPct:0.736 }),
      row('2002', 'LAS', { gp:31, min:34.2, pts:16.9, reb:10.4, ast:2.7, stl:1.5, blk:2.9, fgPct:0.466, fg3Pct:0.324, ftPct:0.727 }),
      row('2003', 'LAS', { gp:23, min:34.4, pts:18.4, reb:10.0, ast:2.0, stl:1.3, blk:2.7, fgPct:0.442, fg3Pct:0.324, ftPct:0.617 }),
      row('2004', 'LAS', { gp:34, min:33.8, pts:17.6, reb:9.9,  ast:2.6, stl:1.5, blk:2.9, fgPct:0.494, fg3Pct:0.273, ftPct:0.712 }),
      row('2005', 'LAS', { gp:34, min:32.2, pts:15.2, reb:7.3,  ast:2.6, stl:2.0, blk:2.1, fgPct:0.440, fg3Pct:0.206, ftPct:0.586 }),
      row('2006', 'LAS', { gp:34, min:30.7, pts:20.0, reb:9.5,  ast:3.2, stl:1.5, blk:1.7, fgPct:0.511, fg3Pct:0.400, ftPct:0.650 }),
      row('2008', 'LAS', { gp:33, min:32.1, pts:15.1, reb:8.9,  ast:2.4, stl:1.5, blk:2.9, fgPct:0.463, fg3Pct:0.235, ftPct:0.661 }),
      row('2009', 'LAS', { gp:23, min:27.7, pts:15.4, reb:6.6,  ast:2.1, stl:0.7, blk:1.4, fgPct:0.518, fg3Pct:0.167, ftPct:0.722 }),
    ],
  },

  // ── Lauren Jackson — 3× MVP, 2× champ, 7× All-WNBA First ────────────────
  // 2012: only 9 games before retiring; Wikipedia table shows same per-game line as 2011 —
  // likely a Wikipedia data issue but preserved as published.
  'jackson-lauren-1981': {
    id:          'jackson-lauren-1981',
    name:        'Lauren Jackson',
    position:    'F',
    retired:     true,
    finalTeam:   'Seattle Storm',
    careerYears: [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012],
    seasonRows: [
      row('2001', 'SEA', { gp:29, min:34.5, pts:15.2, reb:6.7, ast:1.5, stl:1.9, blk:2.2, fgPct:0.367, fg3Pct:0.310, ftPct:0.727 }),
      row('2002', 'SEA', { gp:28, min:31.5, pts:17.2, reb:6.8, ast:1.5, stl:1.1, blk:2.9, fgPct:0.403, fg3Pct:0.350, ftPct:0.756 }),
      row('2003', 'SEA', { gp:33, min:33.6, pts:21.2, reb:9.3, ast:1.9, stl:1.2, blk:1.9, fgPct:0.483, fg3Pct:0.317, ftPct:0.825 }),
      row('2004', 'SEA', { gp:31, min:34.5, pts:20.5, reb:6.7, ast:1.6, stl:1.0, blk:2.0, fgPct:0.478, fg3Pct:0.452, ftPct:0.811 }),
      row('2005', 'SEA', { gp:34, min:34.6, pts:17.6, reb:9.2, ast:1.7, stl:1.1, blk:2.0, fgPct:0.458, fg3Pct:0.288, ftPct:0.834 }),
      row('2006', 'SEA', { gp:30, min:28.3, pts:19.5, reb:7.7, ast:1.6, stl:0.8, blk:1.7, fgPct:0.535, fg3Pct:0.377, ftPct:0.899 }),
      row('2007', 'SEA', { gp:31, min:32.9, pts:23.8, reb:9.7, ast:1.3, stl:1.0, blk:2.0, fgPct:0.519, fg3Pct:0.402, ftPct:0.883 }),
      row('2008', 'SEA', { gp:21, min:33.0, pts:20.2, reb:7.0, ast:1.2, stl:1.5, blk:1.6, fgPct:0.452, fg3Pct:0.295, ftPct:0.934 }),
      row('2009', 'SEA', { gp:26, min:32.4, pts:19.2, reb:7.0, ast:0.8, stl:1.5, blk:1.7, fgPct:0.463, fg3Pct:0.430, ftPct:0.797 }),
      row('2010', 'SEA', { gp:32, min:31.0, pts:20.5, reb:8.3, ast:1.2, stl:0.9, blk:1.2, fgPct:0.462, fg3Pct:0.346, ftPct:0.910 }),
      row('2011', 'SEA', { gp:13, min:24.8, pts:12.2, reb:4.9, ast:0.3, stl:1.0, blk:0.8, fgPct:0.396, fg3Pct:0.311, ftPct:0.884 }),
      row('2012', 'SEA', { gp:9,  min:24.8, pts:12.2, reb:4.9, ast:0.3, stl:1.0, blk:0.8, fgPct:0.425, fg3Pct:0.311, ftPct:0.720 }),
    ],
  },

  // ── Yolanda Griffith — 1999 MVP, 2005 champ ────────────────────────────
  'griffith-yolanda-1970': {
    id:          'griffith-yolanda-1970',
    name:        'Yolanda Griffith',
    position:    'F',
    retired:     true,
    finalTeam:   'Indiana Fever',
    careerYears: [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009],
    seasonRows: [
      row('1999', 'SAC', { gp:29, min:33.8, pts:18.8, reb:11.3, ast:1.6, stl:2.5, blk:1.9, fgPct:0.541, fg3Pct:0.000, ftPct:0.617 }),
      row('2000', 'SAC', { gp:32, min:32.1, pts:16.3, reb:10.3, ast:1.5, stl:2.6, blk:1.9, fgPct:0.535, fg3Pct:0.000, ftPct:0.706 }),
      row('2001', 'SAC', { gp:32, min:33.7, pts:16.2, reb:11.2, ast:1.7, stl:2.0, blk:1.2, fgPct:0.522, fg3Pct:0.000, ftPct:0.720 }),
      row('2002', 'SAC', { gp:17, min:33.9, pts:16.9, reb:8.7,  ast:1.1, stl:0.9, blk:0.8, fgPct:0.520, fg3Pct:0.000, ftPct:0.803 }),
      row('2003', 'SAC', { gp:34, min:29.9, pts:13.8, reb:7.3,  ast:1.4, stl:1.7, blk:1.1, fgPct:0.485, fg3Pct:0.000, ftPct:0.774 }),
      row('2004', 'SAC', { gp:34, min:30.3, pts:14.5, reb:7.2,  ast:1.2, stl:2.2, blk:1.2, fgPct:0.519, fg3Pct:0.000, ftPct:0.853 }),
      row('2005', 'SAC', { gp:34, min:28.3, pts:13.8, reb:6.6,  ast:1.5, stl:1.2, blk:0.9, fgPct:0.485, fg3Pct:0.000, ftPct:0.707 }),
      row('2006', 'SAC', { gp:34, min:25.1, pts:12.0, reb:6.4,  ast:1.6, stl:1.3, blk:0.5, fgPct:0.457, fg3Pct:0.000, ftPct:0.751 }),
      row('2007', 'SAC', { gp:32, min:23.1, pts:9.0,  reb:4.6,  ast:1.5, stl:1.0, blk:0.4, fgPct:0.502, fg3Pct:0.000, ftPct:0.658 }),
      row('2008', 'SEA', { gp:30, min:21.9, pts:7.2,  reb:6.3,  ast:1.5, stl:1.4, blk:0.6, fgPct:0.462, fg3Pct:0.000, ftPct:0.648 }),
      row('2009', 'IND', { gp:3,  min:13.7, pts:6.3,  reb:2.3,  ast:0.0, stl:0.0, blk:0.7, fgPct:0.500, fg3Pct:0.000, ftPct:0.778 }),
    ],
  },

  // ── Tina Thompson — 4× champ (Houston dynasty), 9× All-Star ─────────────
  'thompson-tina-1975': {
    id:          'thompson-tina-1975',
    name:        'Tina Thompson',
    position:    'F',
    retired:     true,
    finalTeam:   'Seattle Storm',
    careerYears: [1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013],
    seasonRows: [
      row('1997', 'HOU', { gp:28, min:31.6, pts:13.2, reb:6.6, ast:1.1, stl:0.8, blk:1.0, fgPct:0.418, fg3Pct:0.370, ftPct:0.838 }),
      row('1998', 'HOU', { gp:27, min:32.4, pts:12.7, reb:7.1, ast:0.9, stl:1.2, blk:0.9, fgPct:0.419, fg3Pct:0.359, ftPct:0.851 }),
      row('1999', 'HOU', { gp:32, min:33.6, pts:12.2, reb:6.4, ast:0.9, stl:1.0, blk:1.0, fgPct:0.419, fg3Pct:0.351, ftPct:0.782 }),
      row('2000', 'HOU', { gp:32, min:34.0, pts:16.9, reb:7.7, ast:1.5, stl:1.5, blk:0.8, fgPct:0.469, fg3Pct:0.417, ftPct:0.837 }),
      row('2001', 'HOU', { gp:30, min:36.7, pts:19.3, reb:7.8, ast:1.9, stl:1.0, blk:0.7, fgPct:0.377, fg3Pct:0.293, ftPct:0.840 }),
      row('2002', 'HOU', { gp:29, min:36.3, pts:16.7, reb:7.5, ast:2.1, stl:0.9, blk:0.7, fgPct:0.431, fg3Pct:0.370, ftPct:0.823 }),
      row('2003', 'HOU', { gp:28, min:34.8, pts:16.9, reb:5.9, ast:1.7, stl:0.6, blk:0.8, fgPct:0.413, fg3Pct:0.342, ftPct:0.779 }),
      row('2004', 'HOU', { gp:26, min:36.3, pts:20.0, reb:6.0, ast:1.8, stl:0.8, blk:0.9, fgPct:0.402, fg3Pct:0.407, ftPct:0.789 }),
      row('2005', 'HOU', { gp:15, min:29.3, pts:10.1, reb:3.8, ast:1.5, stl:0.8, blk:0.3, fgPct:0.413, fg3Pct:0.300, ftPct:0.762 }),
      row('2006', 'HOU', { gp:21, min:33.1, pts:18.7, reb:5.6, ast:2.2, stl:1.0, blk:0.6, fgPct:0.457, fg3Pct:0.417, ftPct:0.804 }),
      row('2007', 'HOU', { gp:34, min:36.3, pts:18.8, reb:6.7, ast:2.8, stl:0.9, blk:0.7, fgPct:0.420, fg3Pct:0.400, ftPct:0.834 }),
      row('2008', 'HOU', { gp:30, min:35.8, pts:18.1, reb:6.9, ast:2.2, stl:1.1, blk:0.7, fgPct:0.413, fg3Pct:0.406, ftPct:0.859 }),
      row('2009', 'LAS', { gp:34, min:34.8, pts:13.0, reb:5.9, ast:2.3, stl:0.8, blk:0.7, fgPct:0.385, fg3Pct:0.369, ftPct:0.867 }),
      row('2010', 'LAS', { gp:33, min:33.2, pts:16.6, reb:6.2, ast:1.8, stl:1.2, blk:0.7, fgPct:0.446, fg3Pct:0.352, ftPct:0.872 }),
      row('2011', 'LAS', { gp:34, min:25.0, pts:9.9,  reb:4.6, ast:1.1, stl:1.2, blk:0.7, fgPct:0.386, fg3Pct:0.339, ftPct:0.833 }),
      row('2012', 'SEA', { gp:29, min:19.0, pts:8.9,  reb:3.4, ast:0.5, stl:0.5, blk:0.8, fgPct:0.442, fg3Pct:0.427, ftPct:0.833 }),
      row('2013', 'SEA', { gp:34, min:28.7, pts:14.1, reb:5.8, ast:1.1, stl:0.5, blk:0.6, fgPct:0.410, fg3Pct:0.370, ftPct:0.874 }),
    ],
  },

  // ── Tamecka Dixon — 2× champ (LA Sparks 2001-02) ────────────────────────
  'dixon-tamecka-1975': {
    id:          'dixon-tamecka-1975',
    name:        'Tamecka Dixon',
    position:    'G',
    retired:     true,
    finalTeam:   'Houston Comets',
    careerYears: [1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008],
    seasonRows: [
      row('1997', 'LAS', { gp:27, min:26.5, pts:11.9, reb:3.0, ast:2.0, stl:1.8, blk:0.2, fgPct:0.456, fg3Pct:0.423, ftPct:0.773 }),
      row('1998', 'LAS', { gp:22, min:32.3, pts:16.2, reb:2.5, ast:2.5, stl:1.1, blk:0.4, fgPct:0.438, fg3Pct:0.356, ftPct:0.779 }),
      row('1999', 'LAS', { gp:32, min:17.6, pts:6.8,  reb:2.1, ast:1.7, stl:0.5, blk:0.1, fgPct:0.387, fg3Pct:0.313, ftPct:0.738 }),
      row('2000', 'LAS', { gp:31, min:28.5, pts:10.9, reb:3.4, ast:3.1, stl:1.3, blk:0.3, fgPct:0.454, fg3Pct:0.353, ftPct:0.805 }),
      row('2001', 'LAS', { gp:29, min:31.9, pts:11.7, reb:2.9, ast:3.9, stl:0.9, blk:0.1, fgPct:0.417, fg3Pct:0.176, ftPct:0.791 }),
      row('2002', 'LAS', { gp:30, min:31.9, pts:10.6, reb:3.1, ast:4.0, stl:0.9, blk:0.2, fgPct:0.391, fg3Pct:0.351, ftPct:0.831 }),
      row('2003', 'LAS', { gp:30, min:34.7, pts:13.7, reb:4.2, ast:3.0, stl:1.2, blk:0.3, fgPct:0.437, fg3Pct:0.212, ftPct:0.883 }),
      row('2004', 'LAS', { gp:32, min:28.5, pts:9.7,  reb:3.4, ast:3.5, stl:1.1, blk:0.0, fgPct:0.442, fg3Pct:0.455, ftPct:0.782 }),
      row('2005', 'LAS', { gp:30, min:20.2, pts:5.3,  reb:2.2, ast:2.6, stl:0.8, blk:0.1, fgPct:0.409, fg3Pct:0.000, ftPct:0.850 }),
      row('2006', 'HOU', { gp:21, min:25.7, pts:7.0,  reb:2.6, ast:2.3, stl:0.6, blk:0.1, fgPct:0.404, fg3Pct:0.111, ftPct:0.821 }),
      row('2007', 'HOU', { gp:18, min:27.2, pts:12.0, reb:3.2, ast:3.2, stl:1.3, blk:0.3, fgPct:0.439, fg3Pct:0.294, ftPct:0.861 }),
      row('2008', 'HOU', { gp:24, min:26.4, pts:9.0,  reb:3.2, ast:1.8, stl:1.0, blk:0.1, fgPct:0.403, fg3Pct:0.154, ftPct:0.857 }),
    ],
  },

  // ── Sue Wicks — early Liberty (1997-2002) ──────────────────────────────
  // Wikipedia table shows percentages as 0-100; converted to 0.000-1.000 decimals here.
  'wicks-sue-1966': {
    id:          'wicks-sue-1966',
    name:        'Sue Wicks',
    position:    'F',
    retired:     true,
    finalTeam:   'New York Liberty',
    careerYears: [1997,1998,1999,2000,2001,2002],
    seasonRows: [
      row('1997', 'NYL', { gp:28, min:11.9, pts:3.6, reb:3.4, ast:1.0, stl:0.6, blk:0.6, fgPct:0.355, fg3Pct:0.286, ftPct:0.667 }),
      row('1998', 'NYL', { gp:30, min:14.8, pts:4.3, reb:2.8, ast:1.2, stl:0.5, blk:0.3, fgPct:0.430, fg3Pct:0.000, ftPct:0.800 }),
      row('1999', 'NYL', { gp:32, min:29.3, pts:6.8, reb:7.0, ast:1.4, stl:1.3, blk:1.3, fgPct:0.403, fg3Pct:0.133, ftPct:0.615 }),
      row('2000', 'NYL', { gp:32, min:21.3, pts:4.9, reb:4.7, ast:0.7, stl:0.8, blk:1.2, fgPct:0.385, fg3Pct:0.200, ftPct:0.726 }),
      row('2001', 'NYL', { gp:30, min:20.1, pts:5.2, reb:4.6, ast:1.2, stl:1.2, blk:1.0, fgPct:0.469, fg3Pct:0.000, ftPct:0.673 }),
      row('2002', 'NYL', { gp:30, min:14.3, pts:2.2, reb:3.4, ast:0.5, stl:0.7, blk:0.5, fgPct:0.343, fg3Pct:0.000, ftPct:0.667 }),
    ],
  },
};

/**
 * Check if a player id refers to a legacy (hand-curated) player.
 * Legacy ids are non-numeric (ESPN ids are integer strings); the synthetic pattern is
 * <lastname>-<firstname>-<year>. A simple "contains a hyphen" check is sufficient
 * because ESPN ids never contain hyphens.
 */
function isLegacyId(id) {
  return typeof id === 'string' && id.includes('-');
}

function getLegacyPlayer(id) {
  return LEGACY_PLAYERS[id] ?? null;
}

/**
 * Find legacy players whose name matches a search query (substring, case-insensitive).
 * Mirrors the search response shape used elsewhere: { id, name, position, retired, headshot }.
 */
function searchLegacyPlayers(q) {
  const needle = q.toLowerCase().trim();
  if (!needle) return [];
  return Object.values(LEGACY_PLAYERS)
    .filter(p => p.name.toLowerCase().includes(needle))
    .map(p => ({
      id:       p.id,
      name:     p.name,
      position: p.position,
      headshot: null,
      retired:  true,
      legacy:   true,
    }));
}

/**
 * Build a profile object matching the shape /api/players/:id returns for ESPN players.
 * Many fields are null because Wikipedia tables don't include them (height, weight, age, jersey).
 */
function buildLegacyProfile(player) {
  return {
    id:           player.id,
    name:         player.name,
    position:     player.position,
    positionName: player.position,
    jersey:       null,
    headshot:     null,
    height:       null,
    weight:       null,
    age:          null,
    college:      null,
    birthPlace:   null,
    experience:   player.seasonRows.length,
    teamId:       null,
    teamName:     player.finalTeam ?? null,
    retired:      true,
    dataSource:   'legacy',
  };
}

/**
 * Build a /detailed-stats response payload from a legacy player's seasonRows.
 *
 * The downstream consumer (the client and gradedReportInputs) expects:
 *   { source, perGame: { regular, regularCareer, playoffs, playoffCareer }, totals: {...}, per36: {...}, per100: null }
 * where each .regular is a { headers, rows } table. We only have per-game data (no totals, no per36),
 * so we fill the per-game split and mirror it into totals as a same-shape placeholder; per36 stays null.
 *
 * Playoffs are null for all legacy players (Wikipedia doesn't publish per-season playoff splits).
 */
function buildLegacyDetailedStats(player) {
  const rows = player.seasonRows.map(r => ESPN_DETAILED_HEADERS.map(h => r[h] ?? null));

  const careerRow = computeCareerAverages(player.seasonRows);

  const makeTable = (rs) => rs.length ? { headers: ESPN_DETAILED_HEADERS, rows: rs } : null;
  const makeCareer = (row) => ({ headers: ESPN_DETAILED_HEADERS, rows: [row] });

  return {
    source:    'legacy',
    perGame: {
      regular:       makeTable(rows),
      regularCareer: makeCareer(careerRow),
      playoffs:      null,
      playoffCareer: null,
    },
    totals:    { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per36:     { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per100:    null,
    advanced:  null,
    dataSource: 'legacy',
  };
}

/**
 * GP-weighted career averages across all season rows.
 * Returns an array aligned to ESPN_DETAILED_HEADERS.
 */
function computeCareerAverages(seasonRows) {
  const totalGp = seasonRows.reduce((s, r) => s + (r.GP ?? 0), 0);

  const wAvg = (key) => {
    if (totalGp === 0) return null;
    let sum = 0; let weight = 0;
    for (const r of seasonRows) {
      const v = r[key]; const g = r.GP ?? 0;
      if (v == null || g === 0) continue;
      sum += v * g; weight += g;
    }
    return weight ? Number((sum / weight).toFixed(3)) : null;
  };

  const career = {
    SEASON_ID:         'Career',
    TEAM_ABBREVIATION: '',
    GP:                totalGp,
    GS:                null,
    MIN:               wAvg('MIN'),
    FGM:               wAvg('FGM'),
    FGA:               wAvg('FGA'),
    FG_PCT:            wAvg('FG_PCT'),
    FG3M:              wAvg('FG3M'),
    FG3A:              wAvg('FG3A'),
    FG3_PCT:           wAvg('FG3_PCT'),
    FTM:               wAvg('FTM'),
    FTA:               wAvg('FTA'),
    FT_PCT:            wAvg('FT_PCT'),
    OREB:              wAvg('OREB'),
    DREB:              wAvg('DREB'),
    REB:               wAvg('REB'),
    AST:               wAvg('AST'),
    STL:               wAvg('STL'),
    BLK:               wAvg('BLK'),
    TOV:               wAvg('TOV'),
    PF:                wAvg('PF'),
    PTS:               wAvg('PTS'),
  };

  return ESPN_DETAILED_HEADERS.map(h => career[h] ?? null);
}

module.exports = {
  LEGACY_PLAYERS,
  isLegacyId,
  getLegacyPlayer,
  searchLegacyPlayers,
  buildLegacyProfile,
  buildLegacyDetailedStats,
};
