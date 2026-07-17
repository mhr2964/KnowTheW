// legacyPlayerBulk.js — bulk-imported pre-2002 WNBA players (FiveThirtyEight CSV, BBRef-sourced).
//
// Source: https://raw.githubusercontent.com/fivethirtyeight/WNBA-stats/master/wnba-player-stats.csv
//   Upstream is FiveThirtyEight's mirror of Basketball-Reference WNBA player advanced stats.
//   Filtered to year_ID 1997-2001 so every player from the first five seasons is represented.
//
// Why this exists: ESPN's player API returns sparse/empty data for most pre-2002 players, so
// search, /api/players/:id, and team rosters can't surface them. This constant fills the gap
// with advanced metrics (PER, TS%, WS, USG%) — per-game stats (PPG/RPG/APG) are NOT in this
// data set. The graded-report prompt is told to grade these players from advanced metrics +
// accolades alone.
//
// player_ID format is BBRef's (e.g. 'staleda01w'). Used as the synthetic player id.
//
// Per-game vs advanced: most entries are advanced-only (1997-2001 CSV). Eight legends have
// hand-curated per-game data merged inline on their season objects (PTS_pg, REB_pg, AST_pg,
// MIN_pg, FG_pct, FG3_pct, FT_pct, STL_pg, BLK_pg) plus extra season entries for years past
// 2001 that the CSV does not cover (those entries are per-game-only, no PER/TS%/WS).
//
// LEGACY_ID_REDIRECTS below maps the retired synthetic ids
// (e.g. 'cooper-cynthia-1963') to their BBRef counterparts so old URLs still resolve.
//
// Multi-team seasons: when a player played for two teams in one year (e.g., Olympia Scott 1999
// DET → UTA), only the LAST team is recorded in seasons[year]. Both teams' rosters still list
// the player. ~16 such cases in 1997-2001; aggregating advanced stats across teams is not
// straightforward (PER/WS are not additive), so we keep the simpler "last team" approach.
//
// Regenerate via: node scripts/build-legacy-bulk.js (see scripts/).
// Generated 2026-05-12 from 1997-2001 CSV rows.

'use strict';

const { toColumnTable } = require('../lib/statColumns');

const LEGACY_PLAYERS_BULK = {
  'abrahta01w': {
    id: 'abrahta01w',
    name: 'Tajama Abraham',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 21, G: 28, MP: 422, MP_pct: 0.373, PER: 6.4, TS_pct: 0.427, ThrPAr: 0, FTr: 0.302, ORB_pct: 9.2, TRB_pct: 10, AST_pct: 6, STL_pct: 1.5, BLK_pct: 2.3, TOV_pct: 25.6, USG_pct: 20.3, OWS: -0.6, DWS: -0.2, WS: -0.8, WS40: -0.077, MIN_pg: 15.1, PTS_pg: 4.4, REB_pg: 2.4, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 1.8, FG_pct: 0.381, FT_pct: 0.684 },
      1998: { team: 'DET', age: 22, G: 12, MP: 44, MP_pct: 0.037, PER: 8.2, TS_pct: 0.437, ThrPAr: 0, FTr: 1.071, ORB_pct: 5.4, TRB_pct: 9.4, AST_pct: 0, STL_pct: 2.5, BLK_pct: 1.8, TOV_pct: 19.5, USG_pct: 26.4, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.001, MIN_pg: 3.7, PTS_pg: 1.5, REB_pg: 0.6, AST_pg: 0, STL_pg: 0.2, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.357, FT_pct: 0.533 },
    },
  },
  'abrossv01w': {
    id: 'abrossv01w',
    name: 'Svetlana Abrosimova',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'MIN', age: 20, G: 26, MP: 846, MP_pct: 0.653, PER: 16.3, TS_pct: 0.488, ThrPAr: 0.259, FTr: 0.451, ORB_pct: 6.6, TRB_pct: 13.2, AST_pct: 16.3, STL_pct: 2.9, BLK_pct: 0.9, TOV_pct: 19.5, USG_pct: 25.3, OWS: 0.5, DWS: 1.4, WS: 1.9, WS40: 0.089, MIN_pg: 32.5, PTS_pg: 13.3, REB_pg: 6.7, AST_pg: 2, STL_pg: 1.6, BLK_pg: 0.3, TOV_pg: 3.3, FG_pct: 0.391, FG3_pct: 0.260, FT_pct: 0.727 },
      2002: { G: 27, MIN_pg: 29.8, PTS_pg: 11.6, REB_pg: 5.4, AST_pg: 2.2, STL_pg: 1.6, BLK_pg: 0.4, TOV_pg: 3.4, FG_pct: 0.377, FG3_pct: 0.333, FT_pct: 0.483 },
      2003: { G: 30, MIN_pg: 26.4, PTS_pg: 10.6, REB_pg: 4.7, AST_pg: 2.7, STL_pg: 1.5, BLK_pg: 0.4, TOV_pg: 3, FG_pct: 0.393, FG3_pct: 0.305, FT_pct: 0.704 },
      2004: { G: 22, MIN_pg: 21, PTS_pg: 6.6, REB_pg: 3.4, AST_pg: 2, STL_pg: 1.4, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.353, FG3_pct: 0.377, FT_pct: 0.609 },
      2005: { G: 31, MIN_pg: 25.1, PTS_pg: 9.8, REB_pg: 3.5, AST_pg: 1.9, STL_pg: 1.5, BLK_pg: 0.2, TOV_pg: 2.6, FG_pct: 0.395, FG3_pct: 0.402, FT_pct: 0.726 },
      2006: { G: 34, MIN_pg: 21.2, PTS_pg: 7.7, REB_pg: 3.1, AST_pg: 1.6, STL_pg: 1, BLK_pg: 0, TOV_pg: 1.8, FG_pct: 0.411, FG3_pct: 0.369, FT_pct: 0.661 },
      2007: { G: 34, MIN_pg: 24.8, PTS_pg: 10.1, REB_pg: 4.4, AST_pg: 2.5, STL_pg: 1.3, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.443, FG3_pct: 0.446, FT_pct: 0.837 },
      2008: { G: 6, MIN_pg: 17.8, PTS_pg: 5.7, REB_pg: 3.3, AST_pg: 2, STL_pg: 1.3, BLK_pg: 0, TOV_pg: 1.8, FG_pct: 0.306, FG3_pct: 0.167, FT_pct: 0.833 },
      2010: { G: 34, MIN_pg: 20.2, PTS_pg: 7.6, REB_pg: 3.1, AST_pg: 2, STL_pg: 1.2, BLK_pg: 0.1, TOV_pg: 1.8, FG_pct: 0.415, FG3_pct: 0.376, FT_pct: 0.568 },
      2012: { G: 19, MIN_pg: 17.3, PTS_pg: 4.6, REB_pg: 2.9, AST_pg: 1.6, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.347, FG3_pct: 0.222, FT_pct: 0.458 },
    },
  },
  'alberma01w': {
    id: 'alberma01w',
    name: 'Marcie Alberts',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 22, G: 5, MP: 30, MP_pct: 0.026, PER: -1, TS_pct: 0, ThrPAr: 1, FTr: 0, ORB_pct: 0, TRB_pct: 2.1, AST_pct: 15.7, STL_pct: 3.6, BLK_pct: 0, TOV_pct: 60, USG_pct: 7.8, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.138 },
    },
  },
  'aldrima01w': {
    id: 'aldrima01w',
    name: 'Markita Aldridge',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 25, G: 31, MP: 379, MP_pct: 0.293, PER: 5.1, TS_pct: 0.373, ThrPAr: 0.213, FTr: 0.351, ORB_pct: 4.3, TRB_pct: 6.3, AST_pct: 17.1, STL_pct: 2.3, BLK_pct: 1.5, TOV_pct: 27.4, USG_pct: 19.2, OWS: -1.1, DWS: 0.3, WS: -0.9, WS40: -0.092, MIN_pg: 12.2, PTS_pg: 2.6, REB_pg: 1.2, AST_pg: 1.1, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 1.3, FG_pct: 0.309, FG3_pct: 0.150, FT_pct: 0.606 },
      2000: { team: 'WAS', age: 26, G: 29, MP: 272, MP_pct: 0.213, PER: 8.2, TS_pct: 0.495, ThrPAr: 0.222, FTr: 0.407, ORB_pct: 4.1, TRB_pct: 6.1, AST_pct: 18.4, STL_pct: 1.9, BLK_pct: 1.3, TOV_pct: 29.8, USG_pct: 16.6, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.025, MIN_pg: 9.4, PTS_pg: 2.2, REB_pg: 0.8, AST_pg: 1, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.463, FG3_pct: 0.500, FT_pct: 0.318 },
      2001: { team: 'WAS', age: 27, G: 5, MP: 35, MP_pct: 0.027, PER: -1.1, TS_pct: 0.371, ThrPAr: 0.333, FTr: 0.111, ORB_pct: 6.8, TRB_pct: 3.5, AST_pct: 11.8, STL_pct: 0, BLK_pct: 0, TOV_pct: 29.8, USG_pct: 19, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.162, MIN_pg: 7, PTS_pg: 1.4, REB_pg: 0.4, AST_pg: 0.4, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.333, FG3_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'alexaer01w': {
    id: 'alexaer01w',
    name: 'Erin Alexander',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'UTA', age: 23, G: 12, MP: 68, MP_pct: 0.056, PER: 1.3, TS_pct: 0.372, ThrPAr: 0.864, FTr: 0.091, ORB_pct: 0, TRB_pct: 2.6, AST_pct: 7.8, STL_pct: 0.8, BLK_pct: 0, TOV_pct: 17.9, USG_pct: 18.7, OWS: -0.1, DWS: -0.1, WS: -0.2, WS40: -0.125, MIN_pg: 5.7, PTS_pg: 1.4, REB_pg: 0.3, AST_pg: 0.3, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.227, FG3_pct: 0.263, FT_pct: 1.000 },
    },
  },
  'alhalta01w': {
    id: 'alhalta01w',
    name: 'Tawona Alhaleem',
    position: 'F-G',
    retired: true,
    seasons: {
      2001: { team: 'ORL', age: 26, G: 26, MP: 252, MP_pct: 0.195, PER: 4.8, TS_pct: 0.382, ThrPAr: 0.19, FTr: 0.241, ORB_pct: 7.6, TRB_pct: 10, AST_pct: 10.7, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 30.4, USG_pct: 17.4, OWS: -0.7, DWS: 0.1, WS: -0.6, WS40: -0.095 },
    },
  },
  'amachma01w': {
    id: 'amachma01w',
    name: 'Mactabene Amachree',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'NYL', age: 23, G: 2, MP: 3, MP_pct: 0.002, PER: 5.6, TS_pct: 0.568, ThrPAr: null, FTr: null, ORB_pct: 45.7, TRB_pct: 22.5, AST_pct: 0, STL_pct: 0, BLK_pct: 31.3, TOV_pct: 53.2, USG_pct: 32.3, OWS: 0, DWS: 0, WS: 0, WS40: -0.075, MIN_pg: 1.5, PTS_pg: 0.5, REB_pg: 0.5, AST_pg: 0, STL_pg: 0, BLK_pg: 0.5, TOV_pg: 0.5, FT_pct: 0.500 },
      2003: { G: 7, MIN_pg: 6.7, PTS_pg: 1.1, REB_pg: 2, AST_pg: 0, STL_pg: 0.7, BLK_pg: 0.3, TOV_pg: 1.3, FG_pct: 0.300, FT_pct: 0.500 },
      2005: { G: 3, MIN_pg: 1, PTS_pg: 0.7, REB_pg: 0, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'ambermo01w': {
    id: 'ambermo01w',
    name: 'Monique Ambers',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 26, G: 19, MP: 85, MP_pct: 0.075, PER: 6.1, TS_pct: 0.449, ThrPAr: 0, FTr: 1.667, ORB_pct: 13.8, TRB_pct: 14.5, AST_pct: 8.8, STL_pct: 0, BLK_pct: 2, TOV_pct: 31, USG_pct: 12, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.038, MIN_pg: 4.5, PTS_pg: 0.7, REB_pg: 1.1, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.555, FT_pct: 0.400 },
      2002: { G: 2, MIN_pg: 2, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0 },
    },
  },
  'anderke01w': {
    id: 'anderke01w',
    name: 'Keisha Anderson',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'WAS', age: 26, G: 30, MP: 434, MP_pct: 0.339, PER: 10.4, TS_pct: 0.494, ThrPAr: 0.118, FTr: 0.265, ORB_pct: 3.9, TRB_pct: 7.3, AST_pct: 29.6, STL_pct: 3.3, BLK_pct: 0.6, TOV_pct: 38.2, USG_pct: 14.1, OWS: -0.2, DWS: 0.4, WS: 0.2, WS40: 0.017, MIN_pg: 14.5, PTS_pg: 2.5, REB_pg: 1.5, AST_pg: 2.5, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.6, FG_pct: 0.426, FG3_pct: 0.375, FT_pct: 0.778 },
      2001: { team: 'CHA', age: 27, G: 18, MP: 102, MP_pct: 0.078, PER: 2.1, TS_pct: 0.294, ThrPAr: 0.125, FTr: 0.625, ORB_pct: 4.4, TRB_pct: 10.3, AST_pct: 24.8, STL_pct: 3.7, BLK_pct: 0, TOV_pct: 45.5, USG_pct: 19.2, OWS: -0.6, DWS: 0.2, WS: -0.4, WS40: -0.162, MIN_pg: 5.7, PTS_pg: 0.7, REB_pg: 0.8, AST_pg: 0.8, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.9, FG_pct: 0.125, FG3_pct: 0.000, FT_pct: 0.800 },
      2002: { G: 7, MIN_pg: 4.4, PTS_pg: 1, REB_pg: 0.9, AST_pg: 0.7, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.250, FG3_pct: 0.250, FT_pct: 0.000 },
    },
  },
  'andrame01w': {
    id: 'andrame01w',
    name: 'Mery Andrade',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 23, G: 32, MP: 364, MP_pct: 0.284, PER: 8.3, TS_pct: 0.504, ThrPAr: 0.407, FTr: 0.441, ORB_pct: 5.5, TRB_pct: 8.9, AST_pct: 25.2, STL_pct: 2.8, BLK_pct: 0.9, TOV_pct: 36.2, USG_pct: 14.7, OWS: -0.3, DWS: 0.5, WS: 0.2, WS40: 0.018 },
      2000: { team: 'CLE', age: 24, G: 32, MP: 797, MP_pct: 0.613, PER: 16, TS_pct: 0.576, ThrPAr: 0.385, FTr: 0.41, ORB_pct: 5.6, TRB_pct: 8.6, AST_pct: 18.4, STL_pct: 3, BLK_pct: 1.2, TOV_pct: 22, USG_pct: 18.4, OWS: 1.7, DWS: 1.3, WS: 3, WS40: 0.151 },
      2001: { team: 'CLE', age: 25, G: 32, MP: 893, MP_pct: 0.695, PER: 9.8, TS_pct: 0.398, ThrPAr: 0.175, FTr: 0.263, ORB_pct: 3.4, TRB_pct: 6.8, AST_pct: 21.2, STL_pct: 3.6, BLK_pct: 1.1, TOV_pct: 24.2, USG_pct: 14.9, OWS: -0.6, DWS: 2.3, WS: 1.7, WS40: 0.078 },
    },
  },
  'angelyv01w': {
    id: 'angelyv01w',
    name: 'Yvette Angel',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 33, G: 5, MP: 90, MP_pct: 0.08, PER: 7.8, TS_pct: 0.404, ThrPAr: 0.313, FTr: 0.188, ORB_pct: 2.7, TRB_pct: 6.3, AST_pct: 22.4, STL_pct: 2.4, BLK_pct: 0.9, TOV_pct: 31.6, USG_pct: 12.6, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.061, MIN_pg: 18, PTS_pg: 2.8, REB_pg: 1.8, AST_pg: 2.2, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 1.6, FG_pct: 0.438, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'arcaija01w': {
    id: 'arcaija01w',
    name: 'Janeth Arcain',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 28, G: 28, MP: 784, MP_pct: 0.694, PER: 18.2, TS_pct: 0.531, ThrPAr: 0.132, FTr: 0.34, ORB_pct: 6.8, TRB_pct: 9.3, AST_pct: 12, STL_pct: 3.1, BLK_pct: 0.4, TOV_pct: 18.9, USG_pct: 21.2, OWS: 2.3, DWS: 1, WS: 3.3, WS40: 0.169, MIN_pg: 28.0, PTS_pg: 10.9, REB_pg: 3.9, AST_pg: 1.6, STL_pg: 1.5, BLK_pg: 0.1, FG_pct: 0.440, FG3_pct: 0.273, FT_pct: 0.894 },
      1998: { team: 'HOU', age: 29, G: 30, MP: 657, MP_pct: 0.541, PER: 14, TS_pct: 0.477, ThrPAr: 0.169, FTr: 0.231, ORB_pct: 8.6, TRB_pct: 10.6, AST_pct: 7.5, STL_pct: 2.1, BLK_pct: 0.4, TOV_pct: 15, USG_pct: 18.4, OWS: 1, DWS: 1.2, WS: 2.2, WS40: 0.133, MIN_pg: 21.9, PTS_pg: 6.8, REB_pg: 3.6, AST_pg: 0.9, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.426, FG3_pct: 0.152, FT_pct: 0.756 },
      1999: { team: 'HOU', age: 30, G: 32, MP: 735, MP_pct: 0.572, PER: 11.9, TS_pct: 0.514, ThrPAr: 0.268, FTr: 0.25, ORB_pct: 6.1, TRB_pct: 8.1, AST_pct: 9.3, STL_pct: 2.3, BLK_pct: 0.2, TOV_pct: 17.6, USG_pct: 14.7, OWS: 1, DWS: 1.1, WS: 2.1, WS40: 0.115, MIN_pg: 23.0, PTS_pg: 5.8, REB_pg: 2.8, AST_pg: 1.2, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.433, FG3_pct: 0.250, FT_pct: 0.829 },
      2000: { team: 'HOU', age: 31, G: 32, MP: 977, MP_pct: 0.754, PER: 13.5, TS_pct: 0.526, ThrPAr: 0.193, FTr: 0.21, ORB_pct: 5.4, TRB_pct: 8.3, AST_pct: 10.7, STL_pct: 2.5, BLK_pct: 0.3, TOV_pct: 17.2, USG_pct: 15.6, OWS: 1.5, DWS: 1.9, WS: 3.4, WS40: 0.141, MIN_pg: 30.5, PTS_pg: 8.4, REB_pg: 3.7, AST_pg: 1.9, STL_pg: 1.3, BLK_pg: 0.1, FG_pct: 0.468, FG3_pct: 0.200, FT_pct: 0.837 },
      2001: { team: 'HOU', age: 32, G: 32, MP: 1154, MP_pct: 0.895, PER: 23.2, TS_pct: 0.514, ThrPAr: 0.13, FTr: 0.295, ORB_pct: 5.3, TRB_pct: 7.5, AST_pct: 20.8, STL_pct: 3.1, BLK_pct: 0.2, TOV_pct: 12.6, USG_pct: 28.5, OWS: 4.5, DWS: 1.7, WS: 6.2, WS40: 0.216, MIN_pg: 36.1, PTS_pg: 18.5, REB_pg: 4.3, AST_pg: 2.9, STL_pg: 1.9, BLK_pg: 0.1, FG_pct: 0.426, FG3_pct: 0.333, FT_pct: 0.900 },
      2002: { team: 'HOU', age: 33, G: 32, MIN_pg: 34.9, PTS_pg: 11.4, REB_pg: 3.9, AST_pg: 2.7, STL_pg: 1.6, BLK_pg: 0.2, FG_pct: 0.424, FG3_pct: 0.270, FT_pct: 0.883 },
      2003: { team: 'HOU', age: 34, G: 34, MIN_pg: 33.4, PTS_pg: 11.5, REB_pg: 4.0, AST_pg: 2.0, STL_pg: 1.2, BLK_pg: 0.0, FG_pct: 0.466, FG3_pct: 0.243, FT_pct: 0.840 },
      2005: { team: 'HOU', age: 36, G: 34, MIN_pg: 31.7, PTS_pg: 10.1, REB_pg: 2.7, AST_pg: 1.6, STL_pg: 1.6, BLK_pg: 0.2, FG_pct: 0.421, FG3_pct: 0.188, FT_pct: 0.883 },
    },
  },
  'artiska01w': {
    id: 'artiska01w',
    name: 'Katasha Artis',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 23, G: 20, MP: 113, MP_pct: 0.101, PER: 3.3, TS_pct: 0.354, ThrPAr: 0.063, FTr: 0.938, ORB_pct: 1.1, TRB_pct: 8.8, AST_pct: 11.7, STL_pct: 2.9, BLK_pct: 0.7, TOV_pct: 34.7, USG_pct: 14.5, OWS: -0.4, DWS: 0.2, WS: -0.2, WS40: -0.057, MIN_pg: 5.7, PTS_pg: 0.8, REB_pg: 0.8, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.250, FG3_pct: 0.000, FT_pct: 0.533 },
    },
  },
  'askamma01w': {
    id: 'askamma01w',
    name: 'Marlies Askamp',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 26, G: 28, MP: 517, MP_pct: 0.456, PER: 18.2, TS_pct: 0.482, ThrPAr: 0.006, FTr: 0.522, ORB_pct: 14.9, TRB_pct: 17.4, AST_pct: 10, STL_pct: 2.2, BLK_pct: 1.5, TOV_pct: 17.4, USG_pct: 23.1, OWS: 1.1, DWS: 1.2, WS: 2.3, WS40: 0.179, MIN_pg: 18.5, PTS_pg: 7.5, REB_pg: 5.2, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.6, FG_pct: 0.393, FG3_pct: 0.000, FT_pct: 0.763 },
      1998: { team: 'PHO', age: 27, G: 26, MP: 319, MP_pct: 0.263, PER: 19.7, TS_pct: 0.529, ThrPAr: 0, FTr: 0.596, ORB_pct: 14.1, TRB_pct: 17.2, AST_pct: 7.6, STL_pct: 2, BLK_pct: 1.8, TOV_pct: 14.4, USG_pct: 22, OWS: 1, DWS: 0.7, WS: 1.7, WS40: 0.213, MIN_pg: 12.3, PTS_pg: 5.3, REB_pg: 3.3, AST_pg: 0.5, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 0.9, FG_pct: 0.471, FG3_pct: 0.000, FT_pct: 0.661 },
      1999: { team: 'PHO', age: 28, G: 30, MP: 781, MP_pct: 0.61, PER: 20.2, TS_pct: 0.573, ThrPAr: 0.01, FTr: 0.579, ORB_pct: 14.8, TRB_pct: 17.5, AST_pct: 6.8, STL_pct: 1.6, BLK_pct: 1.9, TOV_pct: 13, USG_pct: 17.4, OWS: 3.1, DWS: 1.1, WS: 4.2, WS40: 0.217, MIN_pg: 26, PTS_pg: 9.4, REB_pg: 7.2, AST_pg: 0.8, STL_pg: 0.7, BLK_pg: 0.6, TOV_pg: 1.2, FG_pct: 0.482, FG3_pct: 0.000, FT_pct: 0.816 },
      2000: { team: 'MIA', age: 29, G: 32, MP: 869, MP_pct: 0.671, PER: 15.1, TS_pct: 0.482, ThrPAr: 0.01, FTr: 0.56, ORB_pct: 14.1, TRB_pct: 18.3, AST_pct: 8.3, STL_pct: 1.2, BLK_pct: 2.3, TOV_pct: 15.8, USG_pct: 17.8, OWS: 1.1, DWS: 1.7, WS: 2.8, WS40: 0.129, MIN_pg: 27.2, PTS_pg: 7.8, REB_pg: 7.2, AST_pg: 0.9, STL_pg: 0.5, BLK_pg: 0.7, TOV_pg: 1.5, FG_pct: 0.407, FG3_pct: 0.500, FT_pct: 0.684 },
      2001: { team: 'MIA', age: 30, G: 30, MP: 431, MP_pct: 0.328, PER: 11, TS_pct: 0.513, ThrPAr: 0, FTr: 0.552, ORB_pct: 11.1, TRB_pct: 13.9, AST_pct: 6.8, STL_pct: 1.7, BLK_pct: 2.5, TOV_pct: 20.9, USG_pct: 11.2, OWS: 0.5, DWS: 0.9, WS: 1.3, WS40: 0.124, MIN_pg: 14.4, PTS_pg: 2.5, REB_pg: 2.9, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 0.6, FG_pct: 0.483, FG3_pct: 0.000, FT_pct: 0.563 },
      2002: { G: 20, MIN_pg: 10.8, PTS_pg: 3.1, REB_pg: 2.5, AST_pg: 0.2, STL_pg: 0.6, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.473, FG3_pct: 0.000, FT_pct: 0.643 },
    },
  },
  'aycocan01w': {
    id: 'aycocan01w',
    name: 'Angela Aycock',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 26, G: 8, MP: 30, MP_pct: 0.023, PER: -4.3, TS_pct: 0.347, ThrPAr: 0.75, FTr: 1, ORB_pct: 0, TRB_pct: 2.1, AST_pct: 16.8, STL_pct: 3.8, BLK_pct: 0, TOV_pct: 51, USG_pct: 18.8, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.231, MIN_pg: 3.8, PTS_pg: 0.5, REB_pg: 0.1, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 1.000 },
      2000: { team: 'SEA', age: 27, G: 1, MP: 7, MP_pct: 0.005, PER: -15.1, TS_pct: 0, ThrPAr: 0.667, FTr: 0, ORB_pct: 18.9, TRB_pct: 20.5, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 22.1, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.435, MIN_pg: 3.25, PTS_pg: 0, REB_pg: 1.5, AST_pg: 0.75, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'azzije01w': {
    id: 'azzije01w',
    name: 'Jennifer Azzi',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 30, G: 28, MP: 838, MP_pct: 0.645, PER: 17.2, TS_pct: 0.666, ThrPAr: 0.32, FTr: 0.575, ORB_pct: 0.7, TRB_pct: 4.6, AST_pct: 25.4, STL_pct: 1.6, BLK_pct: 0.4, TOV_pct: 19.8, USG_pct: 15.7, OWS: 3.2, DWS: 0.7, WS: 3.9, WS40: 0.185, MIN_pg: 29.9, PTS_pg: 10.8, REB_pg: 2.2, AST_pg: 3.8, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.514, FG3_pct: 0.517, FT_pct: 0.827 },
      2000: { team: 'UTA', age: 31, G: 15, MP: 559, MP_pct: 0.437, PER: 14.8, TS_pct: 0.586, ThrPAr: 0.231, FTr: 0.413, ORB_pct: 1.2, TRB_pct: 4.7, AST_pct: 28.1, STL_pct: 1.2, BLK_pct: 0.8, TOV_pct: 18.6, USG_pct: 12.4, OWS: 1.8, DWS: -0.1, WS: 1.7, WS40: 0.122, MIN_pg: 37.3, PTS_pg: 9.6, REB_pg: 2.7, AST_pg: 6.1, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.9, FG_pct: 0.452, FG3_pct: 0.417, FT_pct: 0.930 },
      2001: { team: 'UTA', age: 32, G: 32, MP: 1205, MP_pct: 0.931, PER: 13.6, TS_pct: 0.61, ThrPAr: 0.402, FTr: 0.522, ORB_pct: 1.2, TRB_pct: 5.2, AST_pct: 25.2, STL_pct: 1.1, BLK_pct: 0.7, TOV_pct: 23.4, USG_pct: 12, OWS: 3.3, DWS: 0.1, WS: 3.5, WS40: 0.115, MIN_pg: 37.7, PTS_pg: 8.6, REB_pg: 3.1, AST_pg: 5.3, STL_pg: 0.7, BLK_pg: 0.3, TOV_pg: 2.2, FG_pct: 0.408, FG3_pct: 0.514, FT_pct: 0.917 },
      2002: { G: 32, MIN_pg: 36, PTS_pg: 9.6, REB_pg: 2.2, AST_pg: 4.9, STL_pg: 0.8, BLK_pg: 0.4, TOV_pg: 2.1, FG_pct: 0.460, FG3_pct: 0.446, FT_pct: 0.798 },
      2003: { G: 34, MIN_pg: 33.4, PTS_pg: 7.6, REB_pg: 2.7, AST_pg: 3.3, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.8, FG_pct: 0.403, FG3_pct: 0.402, FT_pct: 0.785 },
    },
  },
  'badertr01w': {
    id: 'badertr01w',
    name: 'Tricia Bader Binford',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'UTA', age: 25, G: 22, MP: 206, MP_pct: 0.17, PER: 2.7, TS_pct: 0.407, ThrPAr: 0.509, FTr: 0.151, ORB_pct: 0, TRB_pct: 2.9, AST_pct: 17.2, STL_pct: 3.4, BLK_pct: 0, TOV_pct: 31.5, USG_pct: 18.3, OWS: -0.6, DWS: 0, WS: -0.6, WS40: -0.123, MIN_pg: 9.4, PTS_pg: 2.1, REB_pg: 0.5, AST_pg: 0.9, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.302, FG3_pct: 0.370, FT_pct: 0.500 },
      1999: { team: 'UTA', age: 26, G: 7, MP: 34, MP_pct: 0.026, PER: -5.4, TS_pct: 0.258, ThrPAr: 0.667, FTr: 0.667, ORB_pct: 0, TRB_pct: 3.8, AST_pct: 4.5, STL_pct: 4.8, BLK_pct: 2.6, TOV_pct: 50.8, USG_pct: 10.6, OWS: -0.2, DWS: 0, WS: -0.1, WS40: -0.152, MIN_pg: 8, PTS_pg: 0.6, REB_pg: 1.2, AST_pg: 1.2, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.154, FG3_pct: 0.125 },
      2000: { team: 'CLE', age: 27, G: 25, MP: 201, MP_pct: 0.155, PER: 10.6, TS_pct: 0.464, ThrPAr: 0.5, FTr: 0.125, ORB_pct: 1.4, TRB_pct: 3.9, AST_pct: 19.4, STL_pct: 5, BLK_pct: 0.5, TOV_pct: 26.2, USG_pct: 17, OWS: -0.1, DWS: 0.4, WS: 0.3, WS40: 0.053, MIN_pg: 8, PTS_pg: 1.9, REB_pg: 0.4, AST_pg: 0.8, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.354, FG3_pct: 0.333, FT_pct: 0.833 },
      2001: { team: 'CLE', age: 28, G: 19, MP: 114, MP_pct: 0.089, PER: 10.6, TS_pct: 0.525, ThrPAr: 0.65, FTr: 0, ORB_pct: 2.5, TRB_pct: 7.3, AST_pct: 18.4, STL_pct: 2.7, BLK_pct: 0, TOV_pct: 28.6, USG_pct: 13, OWS: 0, DWS: 0.3, WS: 0.3, WS40: 0.106, MIN_pg: 6, PTS_pg: 1.1, REB_pg: 0.6, AST_pg: 0.6, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.400, FG3_pct: 0.385 },
      2002: { G: 18, MIN_pg: 7.3, PTS_pg: 0.8, REB_pg: 0.4, AST_pg: 0.8, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.154, FG3_pct: 0.071, FT_pct: 0.833 },
    },
  },
  'banchrh01w': {
    id: 'banchrh01w',
    name: 'Rhonda Banchero',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'SAC', age: 27, G: 9, MP: 21, MP_pct: 0.016, PER: 1.7, TS_pct: 0.342, ThrPAr: 0.286, FTr: 0.571, ORB_pct: 12, TRB_pct: 9.2, AST_pct: 8.1, STL_pct: 0, BLK_pct: 0, TOV_pct: 18.6, USG_pct: 24, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.119, MIN_pg: 2.3, PTS_pg: 0.7, REB_pg: 0.3, AST_pg: 0.1, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.2, FG_pct: 0.286, FG3_pct: 0.000, FT_pct: 0.500 },
    },
  },
  'baranel01w': {
    id: 'baranel01w',
    name: 'Elena Baranova',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 25, G: 28, MP: 913, MP_pct: 0.808, PER: 18, TS_pct: 0.476, ThrPAr: 0.32, FTr: 0.187, ORB_pct: 6.8, TRB_pct: 13.1, AST_pct: 15.2, STL_pct: 2.5, BLK_pct: 5.4, TOV_pct: 18.6, USG_pct: 21.5, OWS: 0.8, DWS: 0.8, WS: 1.5, WS40: 0.068, MIN_pg: 32.6, PTS_pg: 12.2, REB_pg: 7.4, AST_pg: 2.2, STL_pg: 1.5, BLK_pg: 2.3, TOV_pg: 2.9, FG_pct: 0.390, FG3_pct: 0.377, FT_pct: 0.694 },
      1998: { team: 'UTA', age: 26, G: 20, MP: 671, MP_pct: 0.555, PER: 21.4, TS_pct: 0.516, ThrPAr: 0.219, FTr: 0.324, ORB_pct: 11.1, TRB_pct: 16.6, AST_pct: 20.7, STL_pct: 1.7, BLK_pct: 3.5, TOV_pct: 18, USG_pct: 20.8, OWS: 1.8, DWS: 0.5, WS: 2.3, WS40: 0.134, MIN_pg: 33.6, PTS_pg: 12.9, REB_pg: 9.3, AST_pg: 3.5, STL_pg: 1.1, BLK_pg: 1.5, TOV_pg: 2.8, FG_pct: 0.420, FG3_pct: 0.313, FT_pct: 0.831 },
      1999: { team: 'UTA', age: 27, G: 29, MP: 572, MP_pct: 0.44, PER: 14.1, TS_pct: 0.521, ThrPAr: 0.324, FTr: 0.277, ORB_pct: 5.7, TRB_pct: 11, AST_pct: 14.4, STL_pct: 1.9, BLK_pct: 3.5, TOV_pct: 20.9, USG_pct: 16.8, OWS: 0.6, DWS: 0.3, WS: 0.9, WS40: 0.062, MIN_pg: 19.7, PTS_pg: 6, REB_pg: 3.4, AST_pg: 1.6, STL_pg: 0.7, BLK_pg: 0.8, TOV_pg: 1.5, FG_pct: 0.405, FG3_pct: 0.417, FT_pct: 0.805 },
      2001: { team: 'MIA', age: 29, G: 32, MP: 984, MP_pct: 0.748, PER: 21.3, TS_pct: 0.523, ThrPAr: 0.242, FTr: 0.215, ORB_pct: 5.6, TRB_pct: 13.4, AST_pct: 14.9, STL_pct: 2.1, BLK_pct: 5.7, TOV_pct: 14.6, USG_pct: 22.8, OWS: 2.4, DWS: 2.6, WS: 4.9, WS40: 0.201, MIN_pg: 30.8, PTS_pg: 11.8, REB_pg: 6, AST_pg: 2, STL_pg: 1, BLK_pg: 1.8, TOV_pg: 1.9, FG_pct: 0.427, FG3_pct: 0.375, FT_pct: 0.930 },
      2003: { G: 33, MIN_pg: 25.8, PTS_pg: 8.4, REB_pg: 5.5, AST_pg: 1.9, STL_pg: 1.1, BLK_pg: 1.3, TOV_pg: 1.9, FG_pct: 0.416, FG3_pct: 0.363, FT_pct: 0.886 },
      2004: { G: 34, MIN_pg: 30.8, PTS_pg: 11.6, REB_pg: 7.2, AST_pg: 2, STL_pg: 1.1, BLK_pg: 1.7, TOV_pg: 2.4, FG_pct: 0.463, FG3_pct: 0.461, FT_pct: 0.925 },
      2005: { G: 33, MIN_pg: 28.9, PTS_pg: 8.7, REB_pg: 6.9, AST_pg: 1.8, STL_pg: 0.8, BLK_pg: 1.4, TOV_pg: 1.8, FG_pct: 0.441, FG3_pct: 0.388, FT_pct: 0.855 },
    },
  },
  'barksla01w': {
    id: 'barksla01w',
    name: 'LaQuanda Barksdale',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'POR', age: 21, G: 5, MP: 35, MP_pct: 0.027, PER: 1.4, TS_pct: 0.1, ThrPAr: 0.3, FTr: 0, ORB_pct: 3.5, TRB_pct: 10.6, AST_pct: 21.4, STL_pct: 3.3, BLK_pct: 0, TOV_pct: 9.1, USG_pct: 15.4, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.149, MIN_pg: 7, PTS_pg: 0.4, REB_pg: 1.2, AST_pg: 0.8, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 0.2, FG_pct: 0.100, FG3_pct: 0.000 },
      2002: { G: 17, MIN_pg: 16.8, PTS_pg: 5.9, REB_pg: 2.4, AST_pg: 0.7, STL_pg: 0.5, BLK_pg: 0.4, TOV_pg: 1.4, FG_pct: 0.356, FG3_pct: 0.227, FT_pct: 0.885 },
      2003: { G: 26, MIN_pg: 6.5, PTS_pg: 2.3, REB_pg: 1.3, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.266, FG3_pct: 0.288, FT_pct: 1.000 },
    },
  },
  'barnead01w': {
    id: 'barnead01w',
    name: 'Adia Barnes',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 21, G: 29, MP: 619, MP_pct: 0.514, PER: 10, TS_pct: 0.456, ThrPAr: 0.211, FTr: 0.175, ORB_pct: 7, TRB_pct: 8.6, AST_pct: 7.6, STL_pct: 1.3, BLK_pct: 1.4, TOV_pct: 18.1, USG_pct: 22.1, OWS: -0.2, DWS: 0.2, WS: 0, WS40: 0.002, MIN_pg: 21.3, PTS_pg: 7.6, REB_pg: 2.9, AST_pg: 0.8, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 1.9, FG_pct: 0.395, FG3_pct: 0.298, FT_pct: 0.744 },
      1999: { team: 'MIN', age: 22, G: 19, MP: 91, MP_pct: 0.07, PER: 7.6, TS_pct: 0.371, ThrPAr: 0.13, FTr: 0.522, ORB_pct: 11.1, TRB_pct: 14.7, AST_pct: 13.2, STL_pct: 3.3, BLK_pct: 0, TOV_pct: 22.1, USG_pct: 20.1, OWS: -0.2, DWS: 0.2, WS: 0, WS40: -0.017, MIN_pg: 4.8, PTS_pg: 1.1, REB_pg: 1.1, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.304, FG3_pct: 0.333, FT_pct: 0.500 },
      2000: { team: 'CLE', age: 23, G: 5, MP: 18, MP_pct: 0.014, PER: 22.1, TS_pct: 0.592, ThrPAr: 0.2, FTr: 0.8, ORB_pct: 15.6, TRB_pct: 8, AST_pct: 48.8, STL_pct: 0, BLK_pct: 0, TOV_pct: 22.8, USG_pct: 24.2, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.194, MIN_pg: 3.6, PTS_pg: 1.6, REB_pg: 0.4, AST_pg: 0.8, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.600, FG3_pct: 0.000, FT_pct: 0.500 },
      2001: { team: 'CLE', age: 24, G: 3, MP: 3, MP_pct: 0.002, PER: 45.3, TS_pct: 1, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 23.2, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 17.6, OWS: 0, DWS: 0, WS: 0, WS40: 0.495, MIN_pg: 1, PTS_pg: 0.7, REB_pg: 0.3, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 1.000, FG3_pct: 0.000, FT_pct: 0.000 },
      2002: { G: 26, MIN_pg: 19, PTS_pg: 3.5, REB_pg: 3.9, AST_pg: 1.1, STL_pg: 1.2, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.333, FG3_pct: 0.250, FT_pct: 0.517 },
      2003: { G: 16, MIN_pg: 24.8, PTS_pg: 5.5, REB_pg: 4.1, AST_pg: 1.4, STL_pg: 0.7, BLK_pg: 0.4, TOV_pg: 1.1, FG_pct: 0.381, FG3_pct: 0.387, FT_pct: 0.571 },
      2004: { G: 34, MIN_pg: 11.8, PTS_pg: 2, REB_pg: 1.9, AST_pg: 0, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.304, FG3_pct: 0.500, FT_pct: 0.710 },
    },
  },
  'barnequ01w': {
    id: 'barnequ01w',
    name: 'Quacy Barnes',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 21, G: 17, MP: 90, MP_pct: 0.075, PER: 0.5, TS_pct: 0.403, ThrPAr: 0, FTr: 0.733, ORB_pct: 6.9, TRB_pct: 5.6, AST_pct: 4.1, STL_pct: 0.6, BLK_pct: 5.8, TOV_pct: 31.2, USG_pct: 15, OWS: -0.3, DWS: 0, WS: -0.2, WS40: -0.107, MIN_pg: 5.3, PTS_pg: 0.9, REB_pg: 0.5, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0.4, TOV_pg: 0.5, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.364 },
      2000: { team: 'SEA', age: 23, G: 31, MP: 705, MP_pct: 0.544, PER: 8.7, TS_pct: 0.44, ThrPAr: 0.042, FTr: 0.263, ORB_pct: 5.1, TRB_pct: 8.6, AST_pct: 12, STL_pct: 1.6, BLK_pct: 4.4, TOV_pct: 20.7, USG_pct: 21.9, OWS: -1.5, DWS: 0.6, WS: -0.9, WS40: -0.051, MIN_pg: 22.7, PTS_pg: 6.7, REB_pg: 2.7, AST_pg: 1.1, STL_pg: 0.6, BLK_pg: 1.1, TOV_pg: 2, FG_pct: 0.418, FG3_pct: 0.111, FT_pct: 0.536 },
      2001: { team: 'SEA', age: 24, G: 20, MP: 229, MP_pct: 0.175, PER: 13.3, TS_pct: 0.48, ThrPAr: 0.017, FTr: 0.458, ORB_pct: 7.5, TRB_pct: 10, AST_pct: 11.3, STL_pct: 2.4, BLK_pct: 2.4, TOV_pct: 18.4, USG_pct: 19.7, OWS: 0.1, DWS: 0.3, WS: 0.4, WS40: 0.07, MIN_pg: 11.5, PTS_pg: 3.4, REB_pg: 1.7, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 0.8, FG_pct: 0.390, FG3_pct: 1.000, FT_pct: 0.778 },
      2002: { G: 2, MIN_pg: 6.5, PTS_pg: 1.5, REB_pg: 0.5, AST_pg: 0, STL_pg: 0.5, BLK_pg: 1, TOV_pg: 0, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.750 },
    },
  },
  'bauerca01w': {
    id: 'bauerca01w',
    name: 'Cass Bauer-Bilodeau',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 27, G: 25, MP: 123, MP_pct: 0.096, PER: 3.5, TS_pct: 0.44, ThrPAr: 0.029, FTr: 0.235, ORB_pct: 4.7, TRB_pct: 11, AST_pct: 6.4, STL_pct: 0.5, BLK_pct: 0.7, TOV_pct: 25.7, USG_pct: 21, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.08, MIN_pg: 4.9, PTS_pg: 1.3, REB_pg: 0.8, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.382, FG3_pct: 0.000, FT_pct: 0.875 },
      2000: { team: 'CHA', age: 28, G: 29, MP: 398, MP_pct: 0.307, PER: 4.5, TS_pct: 0.468, ThrPAr: 0.014, FTr: 0.292, ORB_pct: 6.7, TRB_pct: 9.5, AST_pct: 6.3, STL_pct: 1.2, BLK_pct: 0.6, TOV_pct: 25.6, USG_pct: 13.4, OWS: -0.3, DWS: -0.2, WS: -0.5, WS40: -0.054, MIN_pg: 13.7, PTS_pg: 2.6, REB_pg: 1.9, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.403, FG3_pct: 0.000, FT_pct: 0.857 },
      2001: { team: 'WAS', age: 29, G: 15, MP: 102, MP_pct: 0.078, PER: 4.5, TS_pct: 0.35, ThrPAr: 0.059, FTr: 0.588, ORB_pct: 9.3, TRB_pct: 10.8, AST_pct: 5.7, STL_pct: 1.2, BLK_pct: 0.8, TOV_pct: 21.9, USG_pct: 13.3, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.036, MIN_pg: 6.8, PTS_pg: 1, REB_pg: 1.2, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.294, FG3_pct: 0.000, FT_pct: 0.500 },
      2002: { G: 25, MIN_pg: 9.3, PTS_pg: 1.7, REB_pg: 1.6, AST_pg: 0, STL_pg: 0.1, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.298, FG3_pct: 0.000, FT_pct: 0.600 },
    },
  },
  'becenry01w': {
    id: 'becenry01w',
    name: 'Ryneldi Becenti',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 25, G: 1, MP: 8, MP_pct: 0.007, PER: 0, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 6.7, BLK_pct: 0, TOV_pct: 100, USG_pct: 5.6, OWS: 0, DWS: 0, WS: 0, WS40: -0.09, MIN_pg: 8, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 1, BLK_pg: 0, TOV_pg: 1 },
    },
  },
  'beviltu01w': {
    id: 'beviltu01w',
    name: 'Tully Bevilaqua',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'CLE', age: 25, G: 12, MP: 126, MP_pct: 0.104, PER: 16.5, TS_pct: 0.617, ThrPAr: 0.188, FTr: 0.375, ORB_pct: 2.3, TRB_pct: 5.4, AST_pct: 32.3, STL_pct: 5.2, BLK_pct: 1.3, TOV_pct: 32.6, USG_pct: 10.6, OWS: 0.3, DWS: 0.2, WS: 0.5, WS40: 0.167, MIN_pg: 11.5, PTS_pg: 1.9, REB_pg: 0.9, AST_pg: 2.1, STL_pg: 1.1, BLK_pg: 0.2, FG_pct: 0.571, FG3_pct: 0.333, FT_pct: 0.667 },
      2000: { team: 'POR', age: 27, G: 32, MP: 796, MP_pct: 0.61, PER: 9.9, TS_pct: 0.532, ThrPAr: 0.536, FTr: 0.643, ORB_pct: 3.3, TRB_pct: 8.2, AST_pct: 21, STL_pct: 2.9, BLK_pct: 0.7, TOV_pct: 31.5, USG_pct: 12.6, OWS: 0.2, DWS: 0.9, WS: 1.1, WS40: 0.058, MIN_pg: 24.9, PTS_pg: 4.8, REB_pg: 3.0, AST_pg: 2.8, STL_pg: 1.3, BLK_pg: 0.2, FG_pct: 0.357, FG3_pct: 0.283, FT_pct: 0.778 },
      2001: { team: 'POR', age: 28, G: 31, MP: 788, MP_pct: 0.604, PER: 13.2, TS_pct: 0.509, ThrPAr: 0.613, FTr: 0.597, ORB_pct: 4.2, TRB_pct: 6.9, AST_pct: 25.5, STL_pct: 4.3, BLK_pct: 0.6, TOV_pct: 25.7, USG_pct: 12.6, OWS: 1, DWS: 1.1, WS: 2.1, WS40: 0.108, MIN_pg: 25.4, PTS_pg: 4.9, REB_pg: 2.8, AST_pg: 3.3, STL_pg: 1.9, BLK_pg: 0.2, FG_pct: 0.328, FG3_pct: 0.315, FT_pct: 0.732 },
    },
  },
  'bibbyje01w': {
    id: 'bibbyje01w',
    name: 'Jessica Bibby',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'NYL', age: 20, G: 17, MP: 69, MP_pct: 0.054, PER: 4.9, TS_pct: 0.401, ThrPAr: 0.333, FTr: 0.722, ORB_pct: 6, TRB_pct: 4.9, AST_pct: 27.8, STL_pct: 2.6, BLK_pct: 0, TOV_pct: 33.6, USG_pct: 26.2, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.096 },
    },
  },
  'bjedoni01w': {
    id: 'bjedoni01w',
    name: 'Nina Bjedov',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 27, G: 27, MP: 431, MP_pct: 0.333, PER: 12.4, TS_pct: 0.561, ThrPAr: 0.19, FTr: 0.18, ORB_pct: 6.1, TRB_pct: 10, AST_pct: 7, STL_pct: 1.1, BLK_pct: 4.3, TOV_pct: 18.8, USG_pct: 14.1, OWS: 0.5, DWS: 0.5, WS: 1, WS40: 0.092 },
    },
  },
  'blackde01w': {
    id: 'blackde01w',
    name: 'Debbie Black',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 32, G: 32, MP: 1014, MP_pct: 0.78, PER: 11.8, TS_pct: 0.441, ThrPAr: 0.245, FTr: 0.307, ORB_pct: 4, TRB_pct: 7, AST_pct: 27, STL_pct: 4.1, BLK_pct: 0.5, TOV_pct: 26.6, USG_pct: 11.4, OWS: 0.5, DWS: 0.6, WS: 1.1, WS40: 0.043, MIN_pg: 31.7, PTS_pg: 5.1, REB_pg: 3.5, AST_pg: 5.0, STL_pg: 2.4, BLK_pg: 0.2, FG_pct: 0.378, FG3_pct: 0.195, FT_pct: 0.620 },
      2000: { team: 'MIA', age: 33, G: 32, MP: 820, MP_pct: 0.633, PER: 12, TS_pct: 0.451, ThrPAr: 0.28, FTr: 0.28, ORB_pct: 3.6, TRB_pct: 7.7, AST_pct: 27.8, STL_pct: 4.3, BLK_pct: 0.1, TOV_pct: 22.9, USG_pct: 13.3, OWS: 0.1, DWS: 1.9, WS: 1.9, WS40: 0.095, MIN_pg: 25.6, PTS_pg: 4.8, REB_pg: 2.9, AST_pg: 3.1, STL_pg: 1.8, BLK_pg: 0.0, FG_pct: 0.380, FG3_pct: 0.214, FT_pct: 0.690 },
      2001: { team: 'MIA', age: 34, G: 32, MP: 946, MP_pct: 0.719, PER: 16.2, TS_pct: 0.432, ThrPAr: 0.107, FTr: 0.257, ORB_pct: 6.2, TRB_pct: 9.2, AST_pct: 26, STL_pct: 5.4, BLK_pct: 0.2, TOV_pct: 19.7, USG_pct: 14.5, OWS: 0.8, DWS: 2.6, WS: 3.4, WS40: 0.144, MIN_pg: 29.6, PTS_pg: 5.6, REB_pg: 3.9, AST_pg: 3.8, STL_pg: 2.6, BLK_pg: 0.1, FG_pct: 0.374, FG3_pct: 0.150, FT_pct: 0.771 },
    },
  },
  'bladerh01w': {
    id: 'bladerh01w',
    name: 'Rhonda Blades',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 24, G: 28, MP: 290, MP_pct: 0.256, PER: 6.1, TS_pct: 0.508, ThrPAr: 0.771, FTr: 0.286, ORB_pct: 2.5, TRB_pct: 4.4, AST_pct: 19.3, STL_pct: 2.6, BLK_pct: 0.3, TOV_pct: 33.1, USG_pct: 18.3, OWS: -0.3, DWS: 0.4, WS: 0.1, WS40: 0.017, MIN_pg: 10.4, PTS_pg: 2.9, REB_pg: 0.8, AST_pg: 1.1, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.357, FG3_pct: 0.315, FT_pct: 0.650 },
      1998: { team: 'DET', age: 25, G: 29, MP: 340, MP_pct: 0.283, PER: 2.7, TS_pct: 0.364, ThrPAr: 0.641, FTr: 0.372, ORB_pct: 1.7, TRB_pct: 5.6, AST_pct: 20.7, STL_pct: 1.9, BLK_pct: 0.2, TOV_pct: 31.1, USG_pct: 17.6, OWS: -1, DWS: 0.4, WS: -0.6, WS40: -0.075, MIN_pg: 11.7, PTS_pg: 2.3, REB_pg: 1.1, AST_pg: 1.4, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.256, FG3_pct: 0.240, FT_pct: 0.483 },
    },
  },
  'blodgci01w': {
    id: 'blodgci01w',
    name: 'Cindy Blodgett',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'CLE', age: 22, G: 22, MP: 184, MP_pct: 0.151, PER: 10.1, TS_pct: 0.411, ThrPAr: 0.561, FTr: 0.364, ORB_pct: 1.6, TRB_pct: 5.1, AST_pct: 17.5, STL_pct: 2.7, BLK_pct: 0, TOV_pct: 13.6, USG_pct: 23.2, OWS: -0.1, DWS: 0.2, WS: 0.1, WS40: 0.026, MIN_pg: 8.4, PTS_pg: 2.9, REB_pg: 0.6, AST_pg: 0.8, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.288, FG3_pct: 0.270, FT_pct: 0.625 },
      1999: { team: 'SAC', age: 23, G: 12, MP: 34, MP_pct: 0.027, PER: -4, TS_pct: 0.324, ThrPAr: 0.538, FTr: 0.692, ORB_pct: 0, TRB_pct: 1.8, AST_pct: 5.1, STL_pct: 1.6, BLK_pct: 0, TOV_pct: 22.8, USG_pct: 28.6, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.231, MIN_pg: 2.8, PTS_pg: 0.9, REB_pg: 0.1, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.231, FG3_pct: 0.000, FT_pct: 0.556 },
      2000: { team: 'SAC', age: 24, G: 20, MP: 133, MP_pct: 0.104, PER: 10.6, TS_pct: 0.494, ThrPAr: 0.56, FTr: 0.12, ORB_pct: 0.9, TRB_pct: 4.4, AST_pct: 4.2, STL_pct: 3.4, BLK_pct: 0.6, TOV_pct: 19.8, USG_pct: 23.1, OWS: -0.1, DWS: 0.2, WS: 0, WS40: 0.013, MIN_pg: 6.7, PTS_pg: 2.6, REB_pg: 0.5, AST_pg: 0.2, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.400, FG3_pct: 0.286, FT_pct: 0.667 },
      2001: { team: 'SAC', age: 25, G: 11, MP: 72, MP_pct: 0.055, PER: 18.1, TS_pct: 0.586, ThrPAr: 0.517, FTr: 0, ORB_pct: 1.7, TRB_pct: 7.8, AST_pct: 18.1, STL_pct: 4.8, BLK_pct: 1.1, TOV_pct: 27.5, USG_pct: 26.5, OWS: 0, DWS: 0.2, WS: 0.2, WS40: 0.089, MIN_pg: 6.5, PTS_pg: 3.1, REB_pg: 0.8, AST_pg: 0.5, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.448, FG3_pct: 0.533, FT_pct: 0.000 },
    },
  },
  'blueoc01w': {
    id: 'blueoc01w',
    name: 'Octavia Blue',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'LAS', age: 22, G: 30, MP: 331, MP_pct: 0.275, PER: 5.8, TS_pct: 0.417, ThrPAr: 0.273, FTr: 0.312, ORB_pct: 6.9, TRB_pct: 8.8, AST_pct: 5.2, STL_pct: 2.1, BLK_pct: 0.7, TOV_pct: 23.6, USG_pct: 15.5, OWS: -0.4, DWS: 0.3, WS: -0.2, WS40: -0.019, MIN_pg: 11, PTS_pg: 2.4, REB_pg: 1.6, AST_pg: 0.3, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.338, FG3_pct: 0.286, FT_pct: 0.625 },
      2003: { G: 16, MIN_pg: 2.3, PTS_pg: 0.3, REB_pg: 0.1, AST_pg: 0.1, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.1, FG_pct: 0.250, FG3_pct: 0.000, FT_pct: 0.500 },
      2004: { G: 13, MIN_pg: 11.9, PTS_pg: 3.4, REB_pg: 1.6, AST_pg: 0.4, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.381, FG3_pct: 0.000, FT_pct: 0.923 },
    },
  },
  'boltoru01w': {
    id: 'boltoru01w',
    name: 'Ruthie Bolton',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 30, G: 23, MP: 813, MP_pct: 0.719, PER: 23.6, TS_pct: 0.51, ThrPAr: 0.471, FTr: 0.169, ORB_pct: 4.6, TRB_pct: 10.4, AST_pct: 17.2, STL_pct: 3.6, BLK_pct: 0.1, TOV_pct: 11.7, USG_pct: 27.3, OWS: 3.5, DWS: 0.3, WS: 3.8, WS40: 0.187, MIN_pg: 35.3, PTS_pg: 19.4, REB_pg: 5.8, AST_pg: 2.6, STL_pg: 2.3, BLK_pg: 0.0, FG_pct: 0.402, FG3_pct: 0.344, FT_pct: 0.768 },
      1998: { team: 'SAC', age: 31, G: 5, MP: 133, MP_pct: 0.11, PER: 10.7, TS_pct: 0.391, ThrPAr: 0.448, FTr: 0.483, ORB_pct: 4.7, TRB_pct: 5.3, AST_pct: 9.4, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 9.1, USG_pct: 27.1, OWS: 0, DWS: 0.1, WS: 0, WS40: 0.007, MIN_pg: 26.6, PTS_pg: 11.0, REB_pg: 2.2, AST_pg: 1.2, STL_pg: 1.2, BLK_pg: 0.0, FG_pct: 0.293, FG3_pct: 0.154, FT_pct: 0.607 },
      1999: { team: 'SAC', age: 32, G: 31, MP: 970, MP_pct: 0.758, PER: 17, TS_pct: 0.485, ThrPAr: 0.476, FTr: 0.239, ORB_pct: 5.6, TRB_pct: 8.3, AST_pct: 14.6, STL_pct: 1.7, BLK_pct: 0, TOV_pct: 9.2, USG_pct: 21.9, OWS: 3.1, DWS: 0.9, WS: 4, WS40: 0.167, MIN_pg: 31.3, PTS_pg: 13.6, REB_pg: 4.3, AST_pg: 2.4, STL_pg: 1.0, BLK_pg: 0.0, FG_pct: 0.364, FG3_pct: 0.321, FT_pct: 0.798 },
      2000: { team: 'SAC', age: 33, G: 29, MP: 868, MP_pct: 0.678, PER: 16, TS_pct: 0.469, ThrPAr: 0.435, FTr: 0.228, ORB_pct: 6.1, TRB_pct: 7.9, AST_pct: 12.4, STL_pct: 2.2, BLK_pct: 0.1, TOV_pct: 10, USG_pct: 24.2, OWS: 2, DWS: 0.7, WS: 2.8, WS40: 0.128, MIN_pg: 29.9, PTS_pg: 13.1, REB_pg: 3.7, AST_pg: 2.0, STL_pg: 1.2, BLK_pg: 0.0, FG_pct: 0.361, FG3_pct: 0.313, FT_pct: 0.762 },
      2001: { team: 'SAC', age: 34, G: 31, MP: 582, MP_pct: 0.446, PER: 16, TS_pct: 0.465, ThrPAr: 0.509, FTr: 0.241, ORB_pct: 7.4, TRB_pct: 9.9, AST_pct: 18.3, STL_pct: 2.7, BLK_pct: 0.1, TOV_pct: 14, USG_pct: 22.7, OWS: 1.2, DWS: 0.8, WS: 2, WS40: 0.138, MIN_pg: 18.8, PTS_pg: 7.2, REB_pg: 3.0, AST_pg: 1.8, STL_pg: 0.9, BLK_pg: 0.0, FG_pct: 0.338, FG3_pct: 0.364, FT_pct: 0.692 },
      2002: { team: 'SAC', age: 35, G: 32, MIN_pg: 23.0, PTS_pg: 10.9, REB_pg: 2.9, AST_pg: 1.2, STL_pg: 1.4, BLK_pg: 0.1, FG_pct: 0.396, FG3_pct: 0.326, FT_pct: 0.727 },
      2003: { team: 'SAC', age: 36, G: 33, MIN_pg: 15.8, PTS_pg: 4.5, REB_pg: 1.7, AST_pg: 1.1, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.314, FG3_pct: 0.192, FT_pct: 0.769 },
      2004: { team: 'SAC', age: 37, G: 34, MIN_pg: 13.8, PTS_pg: 4.7, REB_pg: 1.4, AST_pg: 0.9, STL_pg: 0.7, BLK_pg: 0.0, FG_pct: 0.370, FG3_pct: 0.405, FT_pct: 0.737 },
    },
  },
  'bookeka01w': {
    id: 'bookeka01w',
    name: 'Karen Booker',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 32, G: 26, MP: 321, MP_pct: 0.284, PER: 7.6, TS_pct: 0.4, ThrPAr: 0.05, FTr: 0.617, ORB_pct: 11.7, TRB_pct: 14.4, AST_pct: 14.2, STL_pct: 4, BLK_pct: 3.7, TOV_pct: 39.1, USG_pct: 17.4, OWS: -1, DWS: 0.4, WS: -0.7, WS40: -0.084 },
      1998: { team: 'HOU', age: 33, G: 1, MP: 2, MP_pct: 0.002, PER: 9.6, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 28.1, BLK_pct: 0, TOV_pct: 0, USG_pct: 23.9, OWS: 0, DWS: 0, WS: 0, WS40: -0.132 },
    },
  },
  'bouceje01w': {
    id: 'bouceje01w',
    name: 'Jenny Boucek',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 23, G: 10, MP: 112, MP_pct: 0.099, PER: 1, TS_pct: 0.498, ThrPAr: 0.2, FTr: 0.467, ORB_pct: 3.7, TRB_pct: 5.8, AST_pct: 13.9, STL_pct: 2.9, BLK_pct: 0, TOV_pct: 54.9, USG_pct: 16.7, OWS: -0.5, DWS: 0.1, WS: -0.4, WS40: -0.158, MIN_pg: 11.2, PTS_pg: 1.8, REB_pg: 1, AST_pg: 0.9, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 2.2, FG_pct: 0.467, FG3_pct: 0.000, FT_pct: 0.571 },
    },
  },
  'bouchke01w': {
    id: 'bouchke01w',
    name: 'Kelly Boucher',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 30, G: 9, MP: 52, MP_pct: 0.043, PER: 4.6, TS_pct: 0.298, ThrPAr: 0.4, FTr: 0.267, ORB_pct: 4.8, TRB_pct: 15.4, AST_pct: 6.3, STL_pct: 1, BLK_pct: 0, TOV_pct: 15.2, USG_pct: 17.6, OWS: -0.1, DWS: 0.1, WS: -0.1, WS40: -0.043, MIN_pg: 5.8, PTS_pg: 1.1, REB_pg: 1.4, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.200, FG3_pct: 0.167, FT_pct: 0.750 },
    },
  },
  'boydca01w': {
    id: 'boydca01w',
    name: 'Carla Boyd',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 22, G: 30, MP: 817, MP_pct: 0.681, PER: 11.4, TS_pct: 0.417, ThrPAr: 0.242, FTr: 0.292, ORB_pct: 7.4, TRB_pct: 8.6, AST_pct: 15.6, STL_pct: 1.8, BLK_pct: 1, TOV_pct: 15.1, USG_pct: 19.2, OWS: 0.4, DWS: 0.9, WS: 1.4, WS40: 0.067, MIN_pg: 27.2, PTS_pg: 8.2, REB_pg: 3.9, AST_pg: 2.3, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 1.7, FG_pct: 0.342, FG3_pct: 0.302, FT_pct: 0.632 },
      1999: { team: 'DET', age: 23, G: 32, MP: 694, MP_pct: 0.534, PER: 8.2, TS_pct: 0.463, ThrPAr: 0.293, FTr: 0.155, ORB_pct: 4.3, TRB_pct: 6.6, AST_pct: 14.4, STL_pct: 1.9, BLK_pct: 1, TOV_pct: 22.5, USG_pct: 16.1, OWS: -0.4, DWS: 0.7, WS: 0.2, WS40: 0.013, MIN_pg: 21.7, PTS_pg: 5.4, REB_pg: 2.3, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.7, FG_pct: 0.397, FG3_pct: 0.333, FT_pct: 0.630 },
      2001: { team: 'DET', age: 25, G: 21, MP: 230, MP_pct: 0.176, PER: 12.7, TS_pct: 0.495, ThrPAr: 0.537, FTr: 0.299, ORB_pct: 5.6, TRB_pct: 7.7, AST_pct: 12.4, STL_pct: 2.8, BLK_pct: 0.8, TOV_pct: 17.4, USG_pct: 19.7, OWS: 0.3, DWS: 0.1, WS: 0.4, WS40: 0.066, MIN_pg: 11, PTS_pg: 3.6, REB_pg: 1.2, AST_pg: 0.7, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.343, FG3_pct: 0.306, FT_pct: 0.900 },
    },
  },
  'branzal01w': {
    id: 'branzal01w',
    name: 'Albena Branzova',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'NYL', age: 26, G: 11, MP: 94, MP_pct: 0.078, PER: 5.1, TS_pct: 0.43, ThrPAr: 0.16, FTr: 0.16, ORB_pct: 8.2, TRB_pct: 11.2, AST_pct: 10, STL_pct: 1.8, BLK_pct: 0.9, TOV_pct: 31, USG_pct: 19.5, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.042, MIN_pg: 8.5, PTS_pg: 2.1, REB_pg: 1.5, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.360, FG3_pct: 0.500, FT_pct: 0.750 },
    },
  },
  'branzge01w': {
    id: 'branzge01w',
    name: 'Gergana Branzova',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 21, G: 26, MP: 204, MP_pct: 0.17, PER: 8.3, TS_pct: 0.467, ThrPAr: 0.062, FTr: 0.308, ORB_pct: 7.6, TRB_pct: 12.2, AST_pct: 6.9, STL_pct: 0.8, BLK_pct: 1.6, TOV_pct: 22.2, USG_pct: 21.1, OWS: -0.2, DWS: 0.3, WS: 0.1, WS40: 0.022, MIN_pg: 7.8, PTS_pg: 2.7, REB_pg: 1.6, AST_pg: 0.3, STL_pg: 0.1, BLK_pg: 0.2, TOV_pg: 0.8, FG_pct: 0.446, FG3_pct: 0.000, FT_pct: 0.550 },
    },
  },
  'braxtja01w': {
    id: 'braxtja01w',
    name: 'Janice Braxton',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 35, G: 25, MP: 822, MP_pct: 0.724, PER: 19.2, TS_pct: 0.528, ThrPAr: 0.047, FTr: 0.654, ORB_pct: 6.3, TRB_pct: 14.8, AST_pct: 11.2, STL_pct: 2.4, BLK_pct: 2.8, TOV_pct: 16.3, USG_pct: 18.4, OWS: 2.4, DWS: 1.6, WS: 3.9, WS40: 0.191 },
      1998: { team: 'CLE', age: 36, G: 30, MP: 840, MP_pct: 0.691, PER: 18.5, TS_pct: 0.561, ThrPAr: 0.028, FTr: 0.468, ORB_pct: 6.5, TRB_pct: 13.5, AST_pct: 16.5, STL_pct: 3.3, BLK_pct: 1.5, TOV_pct: 20.3, USG_pct: 18.9, OWS: 1.9, DWS: 1.7, WS: 3.6, WS40: 0.171 },
      1999: { team: 'CLE', age: 37, G: 26, MP: 476, MP_pct: 0.372, PER: 16.7, TS_pct: 0.532, ThrPAr: 0.071, FTr: 0.584, ORB_pct: 7.3, TRB_pct: 15, AST_pct: 14.2, STL_pct: 2.3, BLK_pct: 2.3, TOV_pct: 19.3, USG_pct: 17.9, OWS: 0.7, DWS: 0.8, WS: 1.5, WS40: 0.127 },
    },
  },
  'brazian01w': {
    id: 'brazian01w',
    name: 'Angie Braziel',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 22, G: 7, MP: 41, MP_pct: 0.032, PER: 30.5, TS_pct: 0.622, ThrPAr: 0, FTr: 0.857, ORB_pct: 3.5, TRB_pct: 18.2, AST_pct: 16.4, STL_pct: 2.9, BLK_pct: 0, TOV_pct: 9.4, USG_pct: 26.6, OWS: 0.3, DWS: 0.1, WS: 0.4, WS40: 0.372, MIN_pg: 5.9, PTS_pg: 3.4, REB_pg: 1.6, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.833 },
      2000: { team: 'CHA', age: 23, G: 22, MP: 203, MP_pct: 0.157, PER: 6.6, TS_pct: 0.445, ThrPAr: 0, FTr: 0.388, ORB_pct: 10.5, TRB_pct: 11.3, AST_pct: 4.6, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 22.9, USG_pct: 17.9, OWS: -0.2, DWS: -0.1, WS: -0.4, WS40: -0.071, MIN_pg: 9.2, PTS_pg: 2.3, REB_pg: 1.5, AST_pg: 0.2, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.388, FG3_pct: 0.000, FT_pct: 0.684 },
      2001: { team: 'IND', age: 24, G: 23, MP: 341, MP_pct: 0.263, PER: 17, TS_pct: 0.487, ThrPAr: 0.009, FTr: 0.304, ORB_pct: 8.4, TRB_pct: 15.4, AST_pct: 4.6, STL_pct: 1.5, BLK_pct: 3.2, TOV_pct: 13.3, USG_pct: 22.2, OWS: 0.5, DWS: 0.2, WS: 0.7, WS40: 0.082, MIN_pg: 14.8, PTS_pg: 5.5, REB_pg: 3.3, AST_pg: 0.3, STL_pg: 0.4, BLK_pg: 0.6, TOV_pg: 0.9, FG_pct: 0.435, FG3_pct: 0.000, FT_pct: 0.771 },
    },
  },
  'brcanra01w': {
    id: 'brcanra01w',
    name: 'Razija Brcaninovic',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 31, G: 30, MP: 695, MP_pct: 0.579, PER: 16.4, TS_pct: 0.558, ThrPAr: 0, FTr: 0.441, ORB_pct: 9.2, TRB_pct: 13.1, AST_pct: 8.5, STL_pct: 0.7, BLK_pct: 3, TOV_pct: 20.8, USG_pct: 20.1, OWS: 1.3, DWS: 1, WS: 2.3, WS40: 0.134, MIN_pg: 23.2, PTS_pg: 9.1, REB_pg: 5.1, AST_pg: 1, STL_pg: 0.3, BLK_pg: 0.9, TOV_pg: 2.1, FG_pct: 0.520, FT_pct: 0.667 },
    },
  },
  'bristre01w': {
    id: 'bristre01w',
    name: 'Reshea Bristol',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'CHA', age: 23, G: 1, MP: 5, MP_pct: 0.004, PER: -4.1, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 59.4, TRB_pct: 28, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 50, USG_pct: 20.9, OWS: 0, DWS: 0, WS: 0, WS40: -0.391, MIN_pg: 5, PTS_pg: 0, REB_pg: 2, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.000 },
    },
  },
  'brogami01w': {
    id: 'brogami01w',
    name: 'Michelle Brogan',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'PHO', age: 25, G: 30, MP: 779, MP_pct: 0.641, PER: 18.5, TS_pct: 0.605, ThrPAr: 0.125, FTr: 0.533, ORB_pct: 7.2, TRB_pct: 11, AST_pct: 10, STL_pct: 3.1, BLK_pct: 0.5, TOV_pct: 18.6, USG_pct: 16.4, OWS: 2.5, DWS: 1.6, WS: 4, WS40: 0.206, MIN_pg: 26, PTS_pg: 9.2, REB_pg: 4.4, AST_pg: 1.4, STL_pg: 1.5, BLK_pg: 0.2, TOV_pg: 1.7, FG_pct: 0.505, FG3_pct: 0.478, FT_pct: 0.796 },
      2000: { team: 'PHO', age: 27, G: 28, MP: 725, MP_pct: 0.564, PER: 16.6, TS_pct: 0.614, ThrPAr: 0.182, FTr: 0.577, ORB_pct: 7.8, TRB_pct: 10.6, AST_pct: 12.8, STL_pct: 2.4, BLK_pct: 0.8, TOV_pct: 17.3, USG_pct: 14.6, OWS: 2.4, DWS: 1, WS: 3.4, WS40: 0.19, MIN_pg: 25.9, PTS_pg: 7.5, REB_pg: 4, AST_pg: 1.8, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 1.3, FG_pct: 0.511, FG3_pct: 0.320, FT_pct: 0.797 },
    },
  },
  'brondsa01w': {
    id: 'brondsa01w',
    name: 'Sandy Brondello',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 29, G: 30, MP: 993, MP_pct: 0.828, PER: 18.3, TS_pct: 0.516, ThrPAr: 0.12, FTr: 0.283, ORB_pct: 2.1, TRB_pct: 5.2, AST_pct: 20.4, STL_pct: 2.1, BLK_pct: 0.1, TOV_pct: 13.4, USG_pct: 21.8, OWS: 3.2, DWS: 1, WS: 4.2, WS40: 0.17, MIN_pg: 33.1, PTS_pg: 14.2, REB_pg: 2.9, AST_pg: 3.3, STL_pg: 1.3, BLK_pg: 0.0, FG_pct: 0.428, FG3_pct: 0.364, FT_pct: 0.923 },
      1999: { team: 'DET', age: 30, G: 32, MP: 1002, MP_pct: 0.771, PER: 15.2, TS_pct: 0.543, ThrPAr: 0.219, FTr: 0.282, ORB_pct: 3.5, TRB_pct: 4.2, AST_pct: 16, STL_pct: 1.4, BLK_pct: 0.4, TOV_pct: 16.1, USG_pct: 21.6, OWS: 2.1, DWS: 0.5, WS: 2.6, WS40: 0.104, MIN_pg: 31.3, PTS_pg: 13.3, REB_pg: 2.1, AST_pg: 2.3, STL_pg: 0.8, BLK_pg: 0.2, FG_pct: 0.438, FG3_pct: 0.487, FT_pct: 0.847 },
      2001: { team: 'MIA', age: 32, G: 29, MP: 850, MP_pct: 0.646, PER: 18, TS_pct: 0.49, ThrPAr: 0.192, FTr: 0.203, ORB_pct: 1.6, TRB_pct: 4, AST_pct: 18.2, STL_pct: 2, BLK_pct: 0.5, TOV_pct: 8.8, USG_pct: 25.6, OWS: 2.3, DWS: 1, WS: 3.3, WS40: 0.155, MIN_pg: 29.3, PTS_pg: 12.7, REB_pg: 1.7, AST_pg: 2.2, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.413, FG3_pct: 0.394, FT_pct: 0.814 },
      2002: { team: 'MIA', age: 33, G: 30, MIN_pg: 25.4, PTS_pg: 8.8, REB_pg: 1.4, AST_pg: 1.5, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.365, FG3_pct: 0.318, FT_pct: 0.821 },
      2003: { team: 'SEA', age: 34, G: 34, MIN_pg: 28.7, PTS_pg: 8.2, REB_pg: 1.6, AST_pg: 2.0, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.415, FG3_pct: 0.438, FT_pct: 0.806 },
    },
  },
  'brownci01w': {
    id: 'brownci01w',
    name: 'Cindy Brown',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 33, G: 30, MP: 965, MP_pct: 0.804, PER: 20.8, TS_pct: 0.556, ThrPAr: 0.228, FTr: 0.425, ORB_pct: 8.6, TRB_pct: 18.5, AST_pct: 10.7, STL_pct: 2.9, BLK_pct: 1.8, TOV_pct: 17.4, USG_pct: 18.1, OWS: 2.7, DWS: 2.6, WS: 5.3, WS40: 0.219 },
      1999: { team: 'UTA', age: 34, G: 9, MP: 156, MP_pct: 0.12, PER: 11.3, TS_pct: 0.435, ThrPAr: 0.313, FTr: 0.5, ORB_pct: 11.6, TRB_pct: 13.5, AST_pct: 11.1, STL_pct: 3.1, BLK_pct: 1.1, TOV_pct: 23.5, USG_pct: 15, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.021 },
    },
  },
  'browned01w': {
    id: 'browned01w',
    name: 'Edwina Brown',
    position: 'G-F',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 21, G: 32, MP: 619, MP_pct: 0.482, PER: 10.9, TS_pct: 0.463, ThrPAr: 0.024, FTr: 0.476, ORB_pct: 7.6, TRB_pct: 9.3, AST_pct: 20.1, STL_pct: 2.1, BLK_pct: 0.7, TOV_pct: 25.1, USG_pct: 20, OWS: -0.1, DWS: 0.3, WS: 0.2, WS40: 0.011, MIN_pg: 19.3, PTS_pg: 5.9, REB_pg: 2.8, AST_pg: 2.3, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.357, FG3_pct: 0.250, FT_pct: 0.838 },
      2001: { team: 'DET', age: 22, G: 32, MP: 800, MP_pct: 0.611, PER: 12.6, TS_pct: 0.459, ThrPAr: 0.228, FTr: 0.259, ORB_pct: 4.9, TRB_pct: 8.6, AST_pct: 22.4, STL_pct: 2.4, BLK_pct: 0.8, TOV_pct: 20.8, USG_pct: 20.2, OWS: 0.3, DWS: 0.2, WS: 0.5, WS40: 0.024, MIN_pg: 25, PTS_pg: 7.4, REB_pg: 3.2, AST_pg: 2.7, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.366, FG3_pct: 0.377, FT_pct: 0.783 },
      2002: { G: 28, MIN_pg: 19.6, PTS_pg: 4.1, REB_pg: 2.9, AST_pg: 2.1, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 2.1, FG_pct: 0.328, FG3_pct: 0.500, FT_pct: 0.719 },
      2003: { G: 34, MIN_pg: 15.4, PTS_pg: 3.5, REB_pg: 2.1, AST_pg: 1.8, STL_pg: 0.9, BLK_pg: 0.2, TOV_pg: 1.4, FG_pct: 0.270, FG3_pct: 0.000, FT_pct: 0.818 },
      2006: { G: 4, MIN_pg: 7, PTS_pg: 1, REB_pg: 1, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.200, FG3_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'brownla01w': {
    id: 'brownla01w',
    name: 'La\'Shawn Brown',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 25, G: 22, MP: 272, MP_pct: 0.226, PER: 5.2, TS_pct: 0.417, ThrPAr: 0, FTr: 0.892, ORB_pct: 7.3, TRB_pct: 12, AST_pct: 5.4, STL_pct: 1.9, BLK_pct: 5.7, TOV_pct: 31.8, USG_pct: 12.3, OWS: -0.5, DWS: 0.1, WS: -0.4, WS40: -0.062 },
    },
  },
  'brownle01w': {
    id: 'brownle01w',
    name: 'Lesley Brown',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 22, G: 13, MP: 43, MP_pct: 0.033, PER: 10.7, TS_pct: 0.51, ThrPAr: 0.125, FTr: 0.375, ORB_pct: 5.5, TRB_pct: 13.2, AST_pct: 10.4, STL_pct: 1.3, BLK_pct: 1.9, TOV_pct: 24.4, USG_pct: 26.7, OWS: -0.1, DWS: 0.1, WS: 0, WS40: 0.01 },
    },
  },
  'brownru01w': {
    id: 'brownru01w',
    name: 'Rushia Brown',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 25, G: 28, MP: 511, MP_pct: 0.45, PER: 20.2, TS_pct: 0.579, ThrPAr: 0, FTr: 0.52, ORB_pct: 12.8, TRB_pct: 14.3, AST_pct: 7.6, STL_pct: 3.6, BLK_pct: 2.3, TOV_pct: 15.2, USG_pct: 16.3, OWS: 2, DWS: 1, WS: 2.9, WS40: 0.229, MIN_pg: 18.3, PTS_pg: 6.3, REB_pg: 4, AST_pg: 0.7, STL_pg: 1.2, BLK_pg: 0.5, TOV_pg: 1, FG_pct: 0.520, FT_pct: 0.734 },
      1998: { team: 'CLE', age: 26, G: 30, MP: 522, MP_pct: 0.43, PER: 16.3, TS_pct: 0.55, ThrPAr: 0.007, FTr: 0.612, ORB_pct: 9.6, TRB_pct: 12, AST_pct: 9.9, STL_pct: 3.5, BLK_pct: 2.6, TOV_pct: 21.7, USG_pct: 20.8, OWS: 0.9, DWS: 1, WS: 1.9, WS40: 0.147, MIN_pg: 17.4, PTS_pg: 6.5, REB_pg: 3.1, AST_pg: 0.9, STL_pg: 1.1, BLK_pg: 0.5, TOV_pg: 1.6, FG_pct: 0.460, FG3_pct: 0.000, FT_pct: 0.776 },
      1999: { team: 'CLE', age: 27, G: 30, MP: 434, MP_pct: 0.339, PER: 12.3, TS_pct: 0.467, ThrPAr: 0.008, FTr: 0.298, ORB_pct: 9.5, TRB_pct: 12.9, AST_pct: 9.7, STL_pct: 2.5, BLK_pct: 2, TOV_pct: 19.5, USG_pct: 19.5, OWS: -0.1, DWS: 0.6, WS: 0.5, WS40: 0.047, MIN_pg: 14.5, PTS_pg: 4.4, REB_pg: 2.9, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 0.3, TOV_pg: 1.1, FG_pct: 0.427, FG3_pct: 0.000, FT_pct: 0.676 },
      2000: { team: 'CLE', age: 28, G: 30, MP: 679, MP_pct: 0.522, PER: 18.7, TS_pct: 0.572, ThrPAr: 0.011, FTr: 0.417, ORB_pct: 11.2, TRB_pct: 13.1, AST_pct: 13.4, STL_pct: 3.3, BLK_pct: 1.8, TOV_pct: 21, USG_pct: 20.5, OWS: 1.6, DWS: 1.3, WS: 3, WS40: 0.175, MIN_pg: 22.6, PTS_pg: 8.4, REB_pg: 4.1, AST_pg: 1.5, STL_pg: 1.3, BLK_pg: 0.4, TOV_pg: 2, FG_pct: 0.497, FG3_pct: 0.500, FT_pct: 0.846 },
      2001: { team: 'CLE', age: 29, G: 30, MP: 760, MP_pct: 0.591, PER: 19.7, TS_pct: 0.559, ThrPAr: 0.005, FTr: 0.323, ORB_pct: 9.3, TRB_pct: 12.1, AST_pct: 10.6, STL_pct: 3.6, BLK_pct: 1.3, TOV_pct: 14.2, USG_pct: 18, OWS: 2.3, DWS: 2.3, WS: 4.6, WS40: 0.242, MIN_pg: 25.3, PTS_pg: 8.3, REB_pg: 4.4, AST_pg: 1.2, STL_pg: 1.5, BLK_pg: 0.3, TOV_pg: 1.2, FG_pct: 0.518, FG3_pct: 1.000, FT_pct: 0.730 },
      2002: { G: 28, MIN_pg: 16.7, PTS_pg: 4, REB_pg: 2.7, AST_pg: 1, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.4, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.737 },
      2003: { G: 34, MIN_pg: 14.2, PTS_pg: 3.7, REB_pg: 2.4, AST_pg: 0.5, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.457, FG3_pct: 0.000, FT_pct: 0.826 },
    },
  },
  'brumfma01w': {
    id: 'brumfma01w',
    name: 'Marla Brumfield',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 22, G: 32, MP: 613, MP_pct: 0.477, PER: 8.4, TS_pct: 0.519, ThrPAr: 0.089, FTr: 0.416, ORB_pct: 4.9, TRB_pct: 6.8, AST_pct: 13.1, STL_pct: 2.1, BLK_pct: 0.3, TOV_pct: 25.1, USG_pct: 12.9, OWS: 0.2, DWS: 0.6, WS: 0.8, WS40: 0.05 },
      2001: { team: 'MIA', age: 23, G: 27, MP: 247, MP_pct: 0.188, PER: 8.5, TS_pct: 0.354, ThrPAr: 0.25, FTr: 0.083, ORB_pct: 4.4, TRB_pct: 7, AST_pct: 25.7, STL_pct: 5, BLK_pct: 0, TOV_pct: 27.8, USG_pct: 18.5, OWS: -0.6, DWS: 0.6, WS: 0, WS40: -0.005 },
    },
  },
  'bullevi01w': {
    id: 'bullevi01w',
    name: 'Vicky Bullett',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 29, G: 28, MP: 875, MP_pct: 0.781, PER: 22.1, TS_pct: 0.5, ThrPAr: 0.071, FTr: 0.247, ORB_pct: 9.6, TRB_pct: 12.7, AST_pct: 15.6, STL_pct: 3.4, BLK_pct: 5.2, TOV_pct: 15.9, USG_pct: 23.2, OWS: 2.2, DWS: 2, WS: 4.2, WS40: 0.193, MIN_pg: 31.3, PTS_pg: 12.8, REB_pg: 6.4, AST_pg: 2.3, STL_pg: 1.9, BLK_pg: 2.0, FG_pct: 0.448, FG3_pct: 0.304, FT_pct: 0.775 },
      1998: { team: 'CHA', age: 30, G: 30, MP: 947, MP_pct: 0.789, PER: 20.6, TS_pct: 0.493, ThrPAr: 0.071, FTr: 0.234, ORB_pct: 8.1, TRB_pct: 12.6, AST_pct: 9.8, STL_pct: 3.8, BLK_pct: 3.9, TOV_pct: 13.7, USG_pct: 23, OWS: 1.8, DWS: 2.3, WS: 4.2, WS40: 0.175, MIN_pg: 31.6, PTS_pg: 13.3, REB_pg: 6.5, AST_pg: 1.5, STL_pg: 2.2, BLK_pg: 1.5, FG_pct: 0.441, FG3_pct: 0.154, FT_pct: 0.826 },
      1999: { team: 'CHA', age: 31, G: 32, MP: 1008, MP_pct: 0.784, PER: 21.7, TS_pct: 0.551, ThrPAr: 0.092, FTr: 0.332, ORB_pct: 8.6, TRB_pct: 14.7, AST_pct: 10.4, STL_pct: 3.6, BLK_pct: 3.8, TOV_pct: 15.2, USG_pct: 20.1, OWS: 2.4, DWS: 2.2, WS: 4.6, WS40: 0.181, MIN_pg: 31.5, PTS_pg: 11.5, REB_pg: 6.8, AST_pg: 1.6, STL_pg: 1.9, BLK_pg: 1.4, FG_pct: 0.486, FG3_pct: 0.370, FT_pct: 0.773 },
      2000: { team: 'WAS', age: 32, G: 32, MP: 1094, MP_pct: 0.855, PER: 17.5, TS_pct: 0.532, ThrPAr: 0.116, FTr: 0.214, ORB_pct: 7.8, TRB_pct: 11.5, AST_pct: 7.4, STL_pct: 3.4, BLK_pct: 3.7, TOV_pct: 15.3, USG_pct: 17.3, OWS: 1.8, DWS: 1.6, WS: 3.4, WS40: 0.123, MIN_pg: 34.2, PTS_pg: 10.7, REB_pg: 5.7, AST_pg: 1.3, STL_pg: 2.0, BLK_pg: 1.5, FG_pct: 0.486, FG3_pct: 0.324, FT_pct: 0.714 },
      2001: { team: 'WAS', age: 33, G: 32, MP: 1073, MP_pct: 0.825, PER: 15.8, TS_pct: 0.453, ThrPAr: 0.224, FTr: 0.168, ORB_pct: 7.2, TRB_pct: 13.2, AST_pct: 8.2, STL_pct: 2.9, BLK_pct: 4.6, TOV_pct: 14.7, USG_pct: 16.6, OWS: 0.6, DWS: 2.3, WS: 2.9, WS40: 0.109, MIN_pg: 33.5, PTS_pg: 8.7, REB_pg: 7.2, AST_pg: 1.3, STL_pg: 1.7, BLK_pg: 1.8, FG_pct: 0.392, FG3_pct: 0.297, FT_pct: 0.729 },
      2002: { team: 'WAS', age: 34, G: 32, MIN_pg: 29.8, PTS_pg: 8.5, REB_pg: 5.8, AST_pg: 1.7, STL_pg: 1.7, BLK_pg: 1.2, FG_pct: 0.462, FG3_pct: 0.396, FT_pct: 0.829 },
    },
  },
  'burgean01w': {
    id: 'burgean01w',
    name: 'Annie Burgess',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 30, G: 25, MP: 333, MP_pct: 0.257, PER: 8.8, TS_pct: 0.424, ThrPAr: 0.364, FTr: 0.121, ORB_pct: 5.3, TRB_pct: 7.6, AST_pct: 21.3, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 22.3, USG_pct: 13.6, OWS: -0.1, DWS: 0.2, WS: 0.1, WS40: 0.016 },
      2001: { team: 'WAS', age: 32, G: 31, MP: 731, MP_pct: 0.562, PER: 8.3, TS_pct: 0.406, ThrPAr: 0.333, FTr: 0.191, ORB_pct: 4.4, TRB_pct: 6.4, AST_pct: 23.9, STL_pct: 2.1, BLK_pct: 0.2, TOV_pct: 28.2, USG_pct: 14.4, OWS: -0.8, DWS: 0.5, WS: -0.2, WS40: -0.013 },
    },
  },
  'burgehe01w': {
    id: 'burgehe01w',
    name: 'Heidi Burge',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 25, G: 22, MP: 282, MP_pct: 0.246, PER: 12.7, TS_pct: 0.474, ThrPAr: 0.056, FTr: 0.625, ORB_pct: 10.5, TRB_pct: 14.8, AST_pct: 9.2, STL_pct: 2.2, BLK_pct: 3.3, TOV_pct: 21.4, USG_pct: 18.4, OWS: 0.1, DWS: 0.5, WS: 0.7, WS40: 0.094, MIN_pg: 12.8, PTS_pg: 4, REB_pg: 3.1, AST_pg: 0.7, STL_pg: 0.5, BLK_pg: 0.5, TOV_pg: 1.1, FG_pct: 0.444, FG3_pct: 0.000, FT_pct: 0.511 },
      1998: { team: 'WAS', age: 26, G: 30, MP: 501, MP_pct: 0.416, PER: 12, TS_pct: 0.54, ThrPAr: 0.044, FTr: 0.39, ORB_pct: 7.2, TRB_pct: 12.3, AST_pct: 11.9, STL_pct: 1.7, BLK_pct: 2.3, TOV_pct: 28.2, USG_pct: 22.9, OWS: -0.3, DWS: -0.1, WS: -0.4, WS40: -0.03, MIN_pg: 16.7, PTS_pg: 6.7, REB_pg: 3.3, AST_pg: 0.9, STL_pg: 0.5, BLK_pg: 0.5, TOV_pg: 2.4, FG_pct: 0.509, FG3_pct: 0.286, FT_pct: 0.597 },
    },
  },
  'burgehe02w': {
    id: 'burgehe02w',
    name: 'Heather Burge',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'SAC', age: 27, G: 13, MP: 28, MP_pct: 0.022, PER: 0.9, TS_pct: 0.38, ThrPAr: 0, FTr: 0.714, ORB_pct: 0, TRB_pct: 11, AST_pct: 0, STL_pct: 3.8, BLK_pct: 6.1, TOV_pct: 35.2, USG_pct: 22.5, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.175, MIN_pg: 2.2, PTS_pg: 0.5, REB_pg: 0.4, AST_pg: 0.7, STL_pg: 0, BLK_pg: 0.2, TOV_pg: 0.4, FG_pct: 0.429, FG3_pct: 0.000, FT_pct: 0.200 },
    },
  },
  'burgeli01w': {
    id: 'burgeli01w',
    name: 'Linda Burgess',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 27, G: 28, MP: 492, MP_pct: 0.43, PER: 17, TS_pct: 0.584, ThrPAr: 0.015, FTr: 0.363, ORB_pct: 12.1, TRB_pct: 14.4, AST_pct: 3.4, STL_pct: 2.1, BLK_pct: 2.1, TOV_pct: 23.1, USG_pct: 18.3, OWS: 1, DWS: 0.7, WS: 1.7, WS40: 0.139 },
      1998: { team: 'SAC', age: 28, G: 30, MP: 692, MP_pct: 0.574, PER: 15.4, TS_pct: 0.526, ThrPAr: 0.042, FTr: 0.312, ORB_pct: 9.5, TRB_pct: 13.4, AST_pct: 8.4, STL_pct: 3.4, BLK_pct: 1.4, TOV_pct: 22.1, USG_pct: 18.6, OWS: 0.6, DWS: 1.1, WS: 1.6, WS40: 0.095 },
      1999: { team: 'SAC', age: 29, G: 27, MP: 233, MP_pct: 0.182, PER: 13.4, TS_pct: 0.516, ThrPAr: 0.013, FTr: 0.539, ORB_pct: 8.7, TRB_pct: 14.5, AST_pct: 2.5, STL_pct: 1.4, BLK_pct: 0.7, TOV_pct: 17.5, USG_pct: 21.7, OWS: 0.3, DWS: 0.3, WS: 0.7, WS40: 0.119 },
      2000: { team: 'SAC', age: 30, G: 5, MP: 41, MP_pct: 0.032, PER: 7.8, TS_pct: 0.316, ThrPAr: 0, FTr: 0.6, ORB_pct: 21.4, TRB_pct: 26.7, AST_pct: 8, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 17.4, USG_pct: 26.2, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.023 },
    },
  },
  'burraal01w': {
    id: 'burraal01w',
    name: 'Alisa Burras',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 24, G: 31, MP: 563, MP_pct: 0.44, PER: 18.6, TS_pct: 0.548, ThrPAr: 0, FTr: 0.246, ORB_pct: 9.5, TRB_pct: 14.2, AST_pct: 7.3, STL_pct: 1.7, BLK_pct: 1.5, TOV_pct: 15.2, USG_pct: 21.5, OWS: 0.9, DWS: 0.7, WS: 1.6, WS40: 0.114, MIN_pg: 18.2, PTS_pg: 7.5, REB_pg: 4, AST_pg: 0.5, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 1.2, FG_pct: 0.539, FG3_pct: 0.000, FT_pct: 0.553 },
      2000: { team: 'POR', age: 25, G: 21, MP: 314, MP_pct: 0.241, PER: 19, TS_pct: 0.626, ThrPAr: 0, FTr: 0.376, ORB_pct: 8.7, TRB_pct: 16.3, AST_pct: 5, STL_pct: 0.5, BLK_pct: 2.1, TOV_pct: 22.1, USG_pct: 24.8, OWS: 0.5, DWS: 0.3, WS: 0.8, WS40: 0.107, MIN_pg: 15, PTS_pg: 7.6, REB_pg: 3.5, AST_pg: 0.3, STL_pg: 0.1, BLK_pg: 0.3, TOV_pg: 1.7, FG_pct: 0.587, FG3_pct: 0.000, FT_pct: 0.756 },
      2001: { team: 'POR', age: 26, G: 26, MP: 272, MP_pct: 0.208, PER: 14.5, TS_pct: 0.548, ThrPAr: 0, FTr: 0.373, ORB_pct: 9.9, TRB_pct: 13.5, AST_pct: 9.2, STL_pct: 1.1, BLK_pct: 0.9, TOV_pct: 23.7, USG_pct: 22.8, OWS: 0.1, DWS: 0.2, WS: 0.3, WS40: 0.046, MIN_pg: 10.5, PTS_pg: 4.1, REB_pg: 2.3, AST_pg: 0.4, STL_pg: 0.2, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.530, FG3_pct: 0.000, FT_pct: 0.581 },
      2002: { G: 32, MIN_pg: 19.8, PTS_pg: 8.7, REB_pg: 4.6, AST_pg: 0.2, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 1.5, FG_pct: 0.629, FG3_pct: 0.000, FT_pct: 0.846 },
      2003: { G: 27, MIN_pg: 10, PTS_pg: 3.3, REB_pg: 2.3, AST_pg: 0.2, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.467, FG3_pct: 0.000, FT_pct: 0.704 },
    },
  },
  'burseja01w': {
    id: 'burseja01w',
    name: 'Janell Burse',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'MIN', age: 22, G: 20, MP: 169, MP_pct: 0.131, PER: 10.6, TS_pct: 0.414, ThrPAr: 0.021, FTr: 0.417, ORB_pct: 17.7, TRB_pct: 16, AST_pct: 7, STL_pct: 0.7, BLK_pct: 7.9, TOV_pct: 26, USG_pct: 22.3, OWS: -0.3, DWS: 0.2, WS: -0.1, WS40: -0.028, MIN_pg: 8.5, PTS_pg: 2.4, REB_pg: 2.1, AST_pg: 0.3, STL_pg: 0.1, BLK_pg: 0.8, TOV_pg: 1, FG_pct: 0.333, FG3_pct: 0.000, FT_pct: 0.750 },
      2002: { G: 31, MIN_pg: 11.1, PTS_pg: 2.7, REB_pg: 1.9, AST_pg: 0.2, STL_pg: 0.2, BLK_pg: 0.4, TOV_pg: 0.6, FG_pct: 0.373, FG3_pct: 0.000, FT_pct: 0.750 },
      2003: { G: 29, MIN_pg: 15.1, PTS_pg: 7.1, REB_pg: 3.7, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 1, TOV_pg: 1.4, FG_pct: 0.490, FG3_pct: 0.000, FT_pct: 0.771 },
      2004: { G: 29, MIN_pg: 17.7, PTS_pg: 4.9, REB_pg: 3.3, AST_pg: 0.7, STL_pg: 0.8, BLK_pg: 1.2, TOV_pg: 1.4, FG_pct: 0.429, FG3_pct: 0.000, FT_pct: 0.582 },
      2005: { G: 34, MIN_pg: 25.3, PTS_pg: 10, REB_pg: 5.9, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 1.2, TOV_pg: 2.3, FG_pct: 0.523, FG3_pct: 0.000, FT_pct: 0.699 },
      2006: { G: 27, MIN_pg: 27.4, PTS_pg: 11.1, REB_pg: 6.6, AST_pg: 0.8, STL_pg: 0.6, BLK_pg: 0.9, TOV_pg: 2, FG_pct: 0.511, FG3_pct: 1.000, FT_pct: 0.670 },
      2007: { G: 29, MIN_pg: 24.4, PTS_pg: 8.8, REB_pg: 5.3, AST_pg: 0.8, STL_pg: 0.4, BLK_pg: 1, TOV_pg: 2, FG_pct: 0.445, FG3_pct: 0.000, FT_pct: 0.693 },
      2009: { G: 34, MIN_pg: 15.9, PTS_pg: 6.1, REB_pg: 3.1, AST_pg: 0.3, STL_pg: 0.6, BLK_pg: 0.9, TOV_pg: 1, FG_pct: 0.510, FG3_pct: 0.000, FT_pct: 0.738 },
    },
  },
  'byearla01w': {
    id: 'byearla01w',
    name: 'Latasha Byears',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 23, G: 28, MP: 656, MP_pct: 0.581, PER: 19.2, TS_pct: 0.51, ThrPAr: 0.024, FTr: 0.33, ORB_pct: 16.1, TRB_pct: 18.5, AST_pct: 15.4, STL_pct: 3.2, BLK_pct: 1, TOV_pct: 21.9, USG_pct: 20.9, OWS: 1.5, DWS: 0.4, WS: 1.9, WS40: 0.116, MIN_pg: 23.4, PTS_pg: 8.7, REB_pg: 6.9, AST_pg: 1.7, STL_pg: 1.4, BLK_pg: 0.3, TOV_pg: 2.4, FG_pct: 0.459, FG3_pct: 0.200, FT_pct: 0.739 },
      1998: { team: 'SAC', age: 24, G: 30, MP: 828, MP_pct: 0.687, PER: 20.1, TS_pct: 0.485, ThrPAr: 0.045, FTr: 0.23, ORB_pct: 12.7, TRB_pct: 15.3, AST_pct: 9, STL_pct: 2.9, BLK_pct: 1.4, TOV_pct: 13.9, USG_pct: 28.8, OWS: 1.4, DWS: 1.2, WS: 2.5, WS40: 0.122, MIN_pg: 27.6, PTS_pg: 14.2, REB_pg: 6.6, AST_pg: 1, STL_pg: 1.4, BLK_pg: 0.4, TOV_pg: 2.4, FG_pct: 0.453, FG3_pct: 0.222, FT_pct: 0.663 },
      1999: { team: 'SAC', age: 25, G: 32, MP: 705, MP_pct: 0.551, PER: 18.5, TS_pct: 0.548, ThrPAr: 0.004, FTr: 0.256, ORB_pct: 13, TRB_pct: 14.9, AST_pct: 9.2, STL_pct: 2.7, BLK_pct: 0.7, TOV_pct: 18.2, USG_pct: 20.7, OWS: 1.5, DWS: 1.2, WS: 2.7, WS40: 0.154, MIN_pg: 22, PTS_pg: 9.2, REB_pg: 5.3, AST_pg: 1, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 1.9, FG_pct: 0.537, FG3_pct: 0.000, FT_pct: 0.565 },
      2000: { team: 'SAC', age: 26, G: 32, MP: 521, MP_pct: 0.407, PER: 17, TS_pct: 0.55, ThrPAr: 0.014, FTr: 0.343, ORB_pct: 10.1, TRB_pct: 15.1, AST_pct: 7.5, STL_pct: 3.3, BLK_pct: 0.8, TOV_pct: 17.5, USG_pct: 17.9, OWS: 1, DWS: 1, WS: 2, WS40: 0.152, MIN_pg: 16.3, PTS_pg: 5.7, REB_pg: 3.8, AST_pg: 0.7, STL_pg: 0.9, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.524, FG3_pct: 0.500, FT_pct: 0.612 },
      2001: { team: 'LAS', age: 27, G: 32, MP: 739, MP_pct: 0.571, PER: 22.4, TS_pct: 0.609, ThrPAr: 0.014, FTr: 0.235, ORB_pct: 14.3, TRB_pct: 15.8, AST_pct: 7.4, STL_pct: 3.2, BLK_pct: 1.6, TOV_pct: 13.5, USG_pct: 18.1, OWS: 3.2, DWS: 1.3, WS: 4.5, WS40: 0.241, MIN_pg: 23.1, PTS_pg: 9.3, REB_pg: 5.7, AST_pg: 0.9, STL_pg: 1.3, BLK_pg: 0.4, TOV_pg: 1.2, FG_pct: 0.602, FG3_pct: 0.333, FT_pct: 0.577 },
      2002: { G: 26, MIN_pg: 18.7, PTS_pg: 7, REB_pg: 5.4, AST_pg: 0.5, STL_pg: 0.7, BLK_pg: 0.2, TOV_pg: 0.8, FG_pct: 0.618, FG3_pct: 0.000, FT_pct: 0.566 },
      2003: { G: 5, MIN_pg: 14.4, PTS_pg: 5.6, REB_pg: 4.2, AST_pg: 0.4, STL_pg: 0, BLK_pg: 0.4, TOV_pg: 0.4, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.727 },
    },
  },
  'campbed01w': {
    id: 'campbed01w',
    name: 'Edna Campbell',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 30, G: 28, MP: 750, MP_pct: 0.586, PER: 11.2, TS_pct: 0.469, ThrPAr: 0.387, FTr: 0.215, ORB_pct: 1.8, TRB_pct: 4.5, AST_pct: 10.5, STL_pct: 1.9, BLK_pct: 1.1, TOV_pct: 14.4, USG_pct: 21.3, OWS: 0.2, DWS: 0.5, WS: 0.7, WS40: 0.037, MIN_pg: 26.8, PTS_pg: 9.6, REB_pg: 1.9, AST_pg: 1.3, STL_pg: 0.9, BLK_pg: 0.4, FG_pct: 0.364, FG3_pct: 0.376, FT_pct: 0.714 },
      2000: { team: 'SEA', age: 31, G: 16, MP: 510, MP_pct: 0.394, PER: 14.2, TS_pct: 0.462, ThrPAr: 0.228, FTr: 0.27, ORB_pct: 2.1, TRB_pct: 4.8, AST_pct: 20.7, STL_pct: 2.2, BLK_pct: 0.7, TOV_pct: 14.3, USG_pct: 28.4, OWS: -0.3, DWS: 0.3, WS: 0, WS40: -0.001, MIN_pg: 31.9, PTS_pg: 13.9, REB_pg: 2.1, AST_pg: 2.3, STL_pg: 1.2, BLK_pg: 0.3, FG_pct: 0.391, FG3_pct: 0.265, FT_pct: 0.707 },
      2001: { team: 'SAC', age: 32, G: 32, MP: 854, MP_pct: 0.654, PER: 11.4, TS_pct: 0.494, ThrPAr: 0.385, FTr: 0.176, ORB_pct: 1.6, TRB_pct: 6.2, AST_pct: 16.2, STL_pct: 1.3, BLK_pct: 0.9, TOV_pct: 19.6, USG_pct: 18.2, OWS: 0.8, DWS: 0.7, WS: 1.5, WS40: 0.068, MIN_pg: 26.7, PTS_pg: 8.1, REB_pg: 2.7, AST_pg: 2.3, STL_pg: 0.6, BLK_pg: 0.3, FG_pct: 0.377, FG3_pct: 0.457, FT_pct: 0.767 },
      2002: { team: 'SAC', age: 33, G: 1, MIN_pg: 12.0, PTS_pg: 4.0, REB_pg: 1.0, AST_pg: 0.0, STL_pg: 1.0, BLK_pg: 0.0, FG_pct: 0.400 },
      2003: { team: 'SAC', age: 34, G: 34, MIN_pg: 21.3, PTS_pg: 7.9, REB_pg: 2.1, AST_pg: 1.3, STL_pg: 0.6, BLK_pg: 0.2, FG_pct: 0.402, FG3_pct: 0.414, FT_pct: 0.758 },
      2004: { team: 'SAC', age: 35, G: 22, MIN_pg: 15.1, PTS_pg: 3.4, REB_pg: 0.9, AST_pg: 0.7, STL_pg: 0.2, BLK_pg: 0.1, FG_pct: 0.382, FG3_pct: 0.410 },
      2005: { team: 'SAN', age: 36, G: 28, MIN_pg: 8.9, PTS_pg: 1.7, REB_pg: 0.5, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.0, FG_pct: 0.313, FG3_pct: 0.263, FT_pct: 1.000 },
    },
  },
  'campbmi01w': {
    id: 'campbmi01w',
    name: 'Michelle Campbell',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 25, G: 8, MP: 30, MP_pct: 0.023, PER: -0.6, TS_pct: 0.34, ThrPAr: 0.1, FTr: 0.4, ORB_pct: 0, TRB_pct: 12.8, AST_pct: 12.1, STL_pct: 0, BLK_pct: 0, TOV_pct: 25.4, USG_pct: 24.1, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.215 },
      2000: { team: 'WAS', age: 26, G: 5, MP: 22, MP_pct: 0.017, PER: 4.7, TS_pct: 0.51, ThrPAr: 0, FTr: 0.4, ORB_pct: 0, TRB_pct: 6.3, AST_pct: 8.1, STL_pct: 0, BLK_pct: 3.9, TOV_pct: 33.8, USG_pct: 20.1, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.094 },
    },
  },
  'cantydo01w': {
    id: 'cantydo01w',
    name: 'Dominique Canty',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 22, G: 26, MP: 646, MP_pct: 0.497, PER: 12.5, TS_pct: 0.431, ThrPAr: 0.074, FTr: 0.594, ORB_pct: 6.5, TRB_pct: 7.8, AST_pct: 12, STL_pct: 2.2, BLK_pct: 0.1, TOV_pct: 13.5, USG_pct: 24.1, OWS: 0, DWS: 0.6, WS: 0.7, WS40: 0.041, MIN_pg: 24.8, PTS_pg: 9.6, REB_pg: 3.1, AST_pg: 1.5, STL_pg: 1.0, BLK_pg: 0.0, FG_pct: 0.332, FG3_pct: 0.176, FT_pct: 0.691 },
      2000: { team: 'DET', age: 23, G: 28, MP: 784, MP_pct: 0.61, PER: 15.1, TS_pct: 0.493, ThrPAr: 0.025, FTr: 0.645, ORB_pct: 5.2, TRB_pct: 5.9, AST_pct: 18.4, STL_pct: 3.4, BLK_pct: 0.5, TOV_pct: 16.4, USG_pct: 18.1, OWS: 1.3, DWS: 0.5, WS: 1.8, WS40: 0.092, MIN_pg: 28.0, PTS_pg: 9.2, REB_pg: 2.5, AST_pg: 2.9, STL_pg: 1.8, BLK_pg: 0.2, FG_pct: 0.409, FG3_pct: 0.000, FT_pct: 0.695 },
      2001: { team: 'DET', age: 24, G: 32, MP: 625, MP_pct: 0.477, PER: 13.6, TS_pct: 0.437, ThrPAr: 0.026, FTr: 0.383, ORB_pct: 9.2, TRB_pct: 9, AST_pct: 23.4, STL_pct: 2.9, BLK_pct: 0.1, TOV_pct: 19.6, USG_pct: 22.2, OWS: 0.3, DWS: 0.1, WS: 0.4, WS40: 0.025, MIN_pg: 19.5, PTS_pg: 6.2, REB_pg: 2.6, AST_pg: 2.2, STL_pg: 1.0, BLK_pg: 0.0, FG_pct: 0.363, FG3_pct: 0.000, FT_pct: 0.757 },
      2002: { team: 'DET', age: 25, G: 28, MIN_pg: 22.3, PTS_pg: 5.7, REB_pg: 2.5, AST_pg: 3.0, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.338, FG3_pct: 0.000, FT_pct: 0.724 },
      2003: { team: 'HOU', age: 26, G: 32, MIN_pg: 20.3, PTS_pg: 5.4, REB_pg: 3.1, AST_pg: 1.8, STL_pg: 0.7, BLK_pg: 0.0, FG_pct: 0.379, FG3_pct: 0.000, FT_pct: 0.667 },
      2004: { team: 'HOU', age: 27, G: 32, MIN_pg: 24.1, PTS_pg: 5.5, REB_pg: 2.6, AST_pg: 2.0, STL_pg: 1.0, BLK_pg: 0.0, FG_pct: 0.420, FG3_pct: 0.000, FT_pct: 0.708 },
      2005: { team: 'HOU', age: 28, G: 33, MIN_pg: 30.2, PTS_pg: 8.2, REB_pg: 3.3, AST_pg: 3.1, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.399, FG3_pct: 0.000, FT_pct: 0.727 },
      2006: { team: 'HOU', age: 29, G: 15, MIN_pg: 28.7, PTS_pg: 10.9, REB_pg: 3.5, AST_pg: 2.9, STL_pg: 1.1, BLK_pg: 0.0, FG_pct: 0.514, FG3_pct: 0.000, FT_pct: 0.727 },
      2007: { team: 'CHI', age: 30, G: 30, MIN_pg: 25.9, PTS_pg: 8.6, REB_pg: 2.1, AST_pg: 4.1, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.361, FG3_pct: 0.250, FT_pct: 0.704 },
      2008: { team: 'CHI', age: 31, G: 28, MIN_pg: 26.3, PTS_pg: 8.1, REB_pg: 2.5, AST_pg: 4.1, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.394, FG3_pct: 0.167, FT_pct: 0.669 },
      2009: { team: 'CHI', age: 32, G: 34, MIN_pg: 22.8, PTS_pg: 6.9, REB_pg: 1.9, AST_pg: 3.2, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.381, FG3_pct: 0.364, FT_pct: 0.689 },
      2010: { team: 'CHI', age: 33, G: 34, MIN_pg: 26.0, PTS_pg: 9.0, REB_pg: 2.6, AST_pg: 3.4, STL_pg: 1.0, BLK_pg: 0.2, FG_pct: 0.430, FG3_pct: 0.182, FT_pct: 0.693 },
      2011: { team: 'CHI', age: 34, G: 22, MIN_pg: 15.0, PTS_pg: 4.1, REB_pg: 1.2, AST_pg: 2.0, STL_pg: 0.5, BLK_pg: 0.1, FG_pct: 0.318, FG3_pct: 0.143, FT_pct: 0.576 },
      2012: { team: 'WAS', age: 35, G: 6, MIN_pg: 12.0, PTS_pg: 2.8, REB_pg: 1.3, AST_pg: 1.0, STL_pg: 0.3, BLK_pg: 0.0, FG_pct: 0.261, FG3_pct: 0.000, FT_pct: 0.500 },
    },
  },
  'cartede01w': {
    id: 'cartede01w',
    name: 'Deborah Carter',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 25, G: 19, MP: 286, MP_pct: 0.253, PER: 10.1, TS_pct: 0.431, ThrPAr: 0.11, FTr: 0.171, ORB_pct: 8.5, TRB_pct: 10.7, AST_pct: 5.9, STL_pct: 2.4, BLK_pct: 0.3, TOV_pct: 16.2, USG_pct: 16.4, OWS: 0, DWS: 0, WS: 0, WS40: 0.002, MIN_pg: 15.9, PTS_pg: 3.9, REB_pg: 2.7, AST_pg: 0.4, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.385, FG3_pct: 0.143, FT_pct: 0.714 },
      1998: { team: 'WAS', age: 26, G: 29, MP: 434, MP_pct: 0.36, PER: 4.6, TS_pct: 0.357, ThrPAr: 0.34, FTr: 0.181, ORB_pct: 5.3, TRB_pct: 9.2, AST_pct: 10.4, STL_pct: 1.9, BLK_pct: 0.7, TOV_pct: 20.5, USG_pct: 20, OWS: -1.1, DWS: -0.2, WS: -1.3, WS40: -0.12, MIN_pg: 15, PTS_pg: 3.8, REB_pg: 2.2, AST_pg: 0.8, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 1.4, FG_pct: 0.271, FG3_pct: 0.245, FT_pct: 0.808 },
    },
  },
  'cassija01w': {
    id: 'cassija01w',
    name: 'Jamie Cassidy',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'MIA', age: 21, G: 22, MP: 175, MP_pct: 0.135, PER: 15.5, TS_pct: 0.501, ThrPAr: 0.145, FTr: 0.782, ORB_pct: 5.1, TRB_pct: 9, AST_pct: 13.3, STL_pct: 1.7, BLK_pct: 1.1, TOV_pct: 15, USG_pct: 24.8, OWS: 0.3, DWS: 0.3, WS: 0.6, WS40: 0.132 },
    },
  },
  'cebriel01w': {
    id: 'cebriel01w',
    name: 'Elisabeth Cebrian',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'NYL', age: 27, G: 22, MP: 187, MP_pct: 0.155, PER: 3.7, TS_pct: 0.462, ThrPAr: 0, FTr: 0.4, ORB_pct: 8.3, TRB_pct: 9.5, AST_pct: 7.8, STL_pct: 0.3, BLK_pct: 3.3, TOV_pct: 32.7, USG_pct: 15.4, OWS: -0.3, DWS: 0.2, WS: -0.1, WS40: -0.027 },
      1997: { G: 28, MIN_pg: 10.1, PTS_pg: 2.3, REB_pg: 1.7, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 0.5, FG_pct: 0.403, FG3_pct: 0.000, FT_pct: 0.667 },
    },
  },
  'chacoke01w': {
    id: 'chacoke01w',
    name: 'Keri Chaconas',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 23, G: 30, MP: 397, MP_pct: 0.329, PER: 7, TS_pct: 0.443, ThrPAr: 0.709, FTr: 0.223, ORB_pct: 2, TRB_pct: 3.7, AST_pct: 19.7, STL_pct: 1.7, BLK_pct: 0, TOV_pct: 23.2, USG_pct: 23.6, OWS: -0.5, DWS: -0.4, WS: -0.9, WS40: -0.088 },
    },
  },
  'charlda01w': {
    id: 'charlda01w',
    name: 'Daedra Charles',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 28, G: 28, MP: 282, MP_pct: 0.246, PER: 9.6, TS_pct: 0.435, ThrPAr: 0.015, FTr: 0.224, ORB_pct: 7.3, TRB_pct: 10.3, AST_pct: 7.1, STL_pct: 1.8, BLK_pct: 2.8, TOV_pct: 16, USG_pct: 13.8, OWS: 0.1, DWS: 0.4, WS: 0.5, WS40: 0.071, MIN_pg: 21.9, PTS_pg: 4.9, REB_pg: 2.1, AST_pg: 1.6, STL_pg: 1.3, BLK_pg: 0.3, TOV_pg: 1.3, FG_pct: 0.437, FG3_pct: 0.360, FT_pct: 0.567 },
      1998: { G: 30, MIN_pg: 19.2, PTS_pg: 2.7, REB_pg: 1.7, AST_pg: 1.6, STL_pg: 0.6, BLK_pg: 0.4, TOV_pg: 1, FG_pct: 0.303, FG3_pct: 0.263, FT_pct: 0.833 },
      2000: { G: 32, MIN_pg: 27.3, PTS_pg: 8.3, REB_pg: 2, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 2, FG_pct: 0.352, FG3_pct: 0.238, FT_pct: 0.757 },
      2001: { G: 14, MIN_pg: 8.6, PTS_pg: 1.9, REB_pg: 0.5, AST_pg: 0.5, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.256, FG3_pct: 0.000, FT_pct: 0.600 },
    },
  },
  'chaseso01w': {
    id: 'chaseso01w',
    name: 'Sonia Chase',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 22, G: 23, MP: 166, MP_pct: 0.138, PER: 8.1, TS_pct: 0.555, ThrPAr: 0, FTr: 0.214, ORB_pct: 3.7, TRB_pct: 5.2, AST_pct: 13.5, STL_pct: 1.6, BLK_pct: 0, TOV_pct: 29.8, USG_pct: 12.2, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.046 },
      1999: { team: 'CHA', age: 23, G: 13, MP: 58, MP_pct: 0.045, PER: 6.8, TS_pct: 0.326, ThrPAr: 0.688, FTr: 0.125, ORB_pct: 5, TRB_pct: 5.8, AST_pct: 15.2, STL_pct: 4.1, BLK_pct: 0, TOV_pct: 10.6, USG_pct: 16.7, OWS: -0.1, DWS: 0.1, WS: 0, WS40: 0.009 },
      1997: { G: 5, MIN_pg: 3.8, PTS_pg: 1, REB_pg: 1, AST_pg: 0.4, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 1.2, FG_pct: 0.286, FG3_pct: 0.250 },
    },
  },
  'clarkma01w': {
    id: 'clarkma01w',
    name: 'Margold Clark',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 26, G: 5, MP: 46, MP_pct: 0.041, PER: 2, TS_pct: 0.394, ThrPAr: 0.125, FTr: 0.25, ORB_pct: 0, TRB_pct: 8.2, AST_pct: 3.9, STL_pct: 1.2, BLK_pct: 1.7, TOV_pct: 18.4, USG_pct: 10.6, OWS: 0, DWS: 0, WS: 0, WS40: -0.042, MIN_pg: 23.5, PTS_pg: 6.7, REB_pg: 4.8, AST_pg: 1.5, STL_pg: 0.6, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.500, FG3_pct: 0.409, FT_pct: 0.768 },
      1998: { G: 24, MIN_pg: 15.5, PTS_pg: 4.3, REB_pg: 3, AST_pg: 1.5, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.432, FG3_pct: 0.294, FT_pct: 0.905 },
      1999: { G: 32, MIN_pg: 25.4, PTS_pg: 6.5, REB_pg: 3.2, AST_pg: 1.1, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 1.5, FG_pct: 0.500, FG3_pct: 0.366, FT_pct: 0.830 },
    },
  },
  'clearmi01w': {
    id: 'clearmi01w',
    name: 'Michelle Cleary',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'PHO', age: 25, G: 24, MP: 509, MP_pct: 0.396, PER: 13.3, TS_pct: 0.501, ThrPAr: 0.667, FTr: 0.6, ORB_pct: 3.3, TRB_pct: 5, AST_pct: 25.3, STL_pct: 3.9, BLK_pct: 0.4, TOV_pct: 19.8, USG_pct: 7.1, OWS: 1.1, DWS: 0.8, WS: 1.9, WS40: 0.145 },
      2001: { team: 'PHO', age: 26, G: 4, MP: 49, MP_pct: 0.038, PER: 7.8, TS_pct: 0.258, ThrPAr: 0.667, FTr: 0.667, ORB_pct: 5.3, TRB_pct: 4, AST_pct: 30.9, STL_pct: 2.3, BLK_pct: 0, TOV_pct: 43.6, USG_pct: 6.8, OWS: 0, DWS: 0, WS: 0, WS40: -0.011, MIN_pg: 3.3, PTS_pg: 0.1, REB_pg: 0.4, AST_pg: 0.7, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.500 },
    },
  },
  'clinest01w': {
    id: 'clinest01w',
    name: 'Stacy Clinesmith',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'SAC', age: 22, G: 26, MP: 285, MP_pct: 0.223, PER: 12.9, TS_pct: 0.512, ThrPAr: 0.719, FTr: 0.298, ORB_pct: 3.1, TRB_pct: 6.8, AST_pct: 28, STL_pct: 2.4, BLK_pct: 0.3, TOV_pct: 27.9, USG_pct: 14.7, OWS: 0.4, DWS: 0.3, WS: 0.6, WS40: 0.089, MIN_pg: 30, PTS_pg: 11.5, REB_pg: 6, AST_pg: 1.1, STL_pg: 0.9, BLK_pg: 0.8, TOV_pg: 2.8, FG_pct: 0.480, FG3_pct: 0.000, FT_pct: 0.696 },
      2001: { team: 'SAC', age: 23, G: 16, MP: 75, MP_pct: 0.057, PER: 4, TS_pct: 0.357, ThrPAr: 0.714, FTr: 0, ORB_pct: 0, TRB_pct: 2.5, AST_pct: 31.7, STL_pct: 0.8, BLK_pct: 0, TOV_pct: 30, USG_pct: 12.7, OWS: -0.1, DWS: 0, WS: 0, WS40: -0.019, MIN_pg: 28.8, PTS_pg: 9.3, REB_pg: 6.3, AST_pg: 1.7, STL_pg: 0.6, BLK_pg: 0.8, TOV_pg: 1.9, FG_pct: 0.449, FG3_pct: 0.000, FT_pct: 0.766 },
      2002: { G: 32, MIN_pg: 25.6, PTS_pg: 8.7, REB_pg: 4.2, AST_pg: 1.5, STL_pg: 0.6, BLK_pg: 1.2, TOV_pg: 1.9, FG_pct: 0.401, FG3_pct: 0.412, FT_pct: 0.698 },
      2003: { G: 33, MIN_pg: 17.1, PTS_pg: 3.5, REB_pg: 3.2, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.6, TOV_pg: 1.2, FG_pct: 0.385, FG3_pct: 0.000, FT_pct: 0.682 },
    },
  },
  'colleka01w': {
    id: 'colleka01w',
    name: 'Katrina Colleton',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 26, G: 28, MP: 613, MP_pct: 0.535, PER: 11.5, TS_pct: 0.489, ThrPAr: 0.198, FTr: 0.238, ORB_pct: 5.3, TRB_pct: 5.9, AST_pct: 12.2, STL_pct: 3, BLK_pct: 1.1, TOV_pct: 20.1, USG_pct: 12.6, OWS: 0.6, DWS: 0.6, WS: 1.2, WS40: 0.081 },
      1998: { team: 'LAS', age: 27, G: 30, MP: 575, MP_pct: 0.477, PER: 6.6, TS_pct: 0.374, ThrPAr: 0.192, FTr: 0.182, ORB_pct: 5.2, TRB_pct: 5.3, AST_pct: 13.4, STL_pct: 1.7, BLK_pct: 1.5, TOV_pct: 21.3, USG_pct: 10.6, OWS: -0.2, DWS: 0.2, WS: 0, WS40: 0.001 },
      2000: { team: 'MIA', age: 29, G: 32, MP: 873, MP_pct: 0.674, PER: 7.6, TS_pct: 0.408, ThrPAr: 0.072, FTr: 0.239, ORB_pct: 2.2, TRB_pct: 5, AST_pct: 15, STL_pct: 1.9, BLK_pct: 0.8, TOV_pct: 16.7, USG_pct: 22.3, OWS: -1.3, DWS: 1.1, WS: -0.2, WS40: -0.009 },
      2001: { team: 'MIA', age: 30, G: 14, MP: 121, MP_pct: 0.092, PER: 1.7, TS_pct: 0.3, ThrPAr: 0.026, FTr: 0.256, ORB_pct: 2.3, TRB_pct: 4, AST_pct: 11.8, STL_pct: 1, BLK_pct: 0.8, TOV_pct: 13.9, USG_pct: 22.1, OWS: -0.5, DWS: 0.1, WS: -0.4, WS40: -0.117 },
    },
  },
  'compame01w': {
    id: 'compame01w',
    name: 'Megan Compain',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 21, G: 4, MP: 19, MP_pct: 0.017, PER: 0, TS_pct: 0, ThrPAr: 0.667, FTr: 0, ORB_pct: 0, TRB_pct: 3, AST_pct: 17.9, STL_pct: 11.2, BLK_pct: 4.2, TOV_pct: 50, USG_pct: 14.1, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.228 },
      2000: { G: 32, MIN_pg: 17.3, PTS_pg: 4.8, REB_pg: 2, AST_pg: 2, STL_pg: 1.2, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.313, FG3_pct: 0.342, FT_pct: 0.738 },
      2001: { G: 32, MIN_pg: 24.3, PTS_pg: 6.1, REB_pg: 2.4, AST_pg: 3.4, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 2.2, FG_pct: 0.355, FG3_pct: 0.329, FT_pct: 0.764 },
      2003: { G: 34, MIN_pg: 24.5, PTS_pg: 4.1, REB_pg: 2.6, AST_pg: 3.8, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 2.2, FG_pct: 0.308, FG3_pct: 0.324, FT_pct: 0.732 },
      2004: { G: 33, MIN_pg: 21.4, PTS_pg: 4.2, REB_pg: 2, AST_pg: 3.5, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 2.2, FG_pct: 0.331, FG3_pct: 0.218, FT_pct: 0.667 },
      2005: { G: 31, MIN_pg: 19.4, PTS_pg: 3.5, REB_pg: 1.5, AST_pg: 2.7, STL_pg: 1.3, BLK_pg: 0, TOV_pg: 1.6, FG_pct: 0.307, FG3_pct: 0.313, FT_pct: 0.741 },
      2006: { G: 29, MIN_pg: 21.2, PTS_pg: 5.4, REB_pg: 2, AST_pg: 2.8, STL_pg: 1.2, BLK_pg: 0.1, TOV_pg: 2.5, FG_pct: 0.370, FG3_pct: 0.383, FT_pct: 0.691 },
      2007: { G: 33, MIN_pg: 20.7, PTS_pg: 4.1, REB_pg: 2.1, AST_pg: 3.1, STL_pg: 1.4, BLK_pg: 0, TOV_pg: 1.6, FG_pct: 0.383, FG3_pct: 0.366, FT_pct: 0.771 },
      2008: { G: 31, MIN_pg: 18.7, PTS_pg: 3.5, REB_pg: 2.4, AST_pg: 1.7, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.268, FG3_pct: 0.200, FT_pct: 0.789 },
      2009: { G: 34, MIN_pg: 18.9, PTS_pg: 3.1, REB_pg: 1.8, AST_pg: 2.9, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.248, FG3_pct: 0.295, FT_pct: 0.673 },
      2010: { G: 33, MIN_pg: 11.8, PTS_pg: 1.9, REB_pg: 1, AST_pg: 1.4, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.300, FG3_pct: 0.273, FT_pct: 0.647 },
    },
  },
  'congran01w': {
    id: 'congran01w',
    name: 'Andrea Congreaves',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 27, G: 28, MP: 658, MP_pct: 0.588, PER: 16.8, TS_pct: 0.621, ThrPAr: 0.349, FTr: 0.444, ORB_pct: 7.8, TRB_pct: 12.6, AST_pct: 11.4, STL_pct: 1.3, BLK_pct: 0.6, TOV_pct: 17.1, USG_pct: 13.1, OWS: 2.3, DWS: 0.8, WS: 3.1, WS40: 0.191 },
      1998: { team: 'CHA', age: 28, G: 24, MP: 372, MP_pct: 0.31, PER: 15.4, TS_pct: 0.576, ThrPAr: 0.63, FTr: 0.259, ORB_pct: 6, TRB_pct: 11.8, AST_pct: 17, STL_pct: 1.6, BLK_pct: 1.1, TOV_pct: 20.3, USG_pct: 14.1, OWS: 0.9, DWS: 0.5, WS: 1.5, WS40: 0.161 },
      1999: { team: 'ORL', age: 29, G: 32, MP: 812, MP_pct: 0.629, PER: 11.9, TS_pct: 0.603, ThrPAr: 0.273, FTr: 0.353, ORB_pct: 6.4, TRB_pct: 8.1, AST_pct: 8, STL_pct: 1.7, BLK_pct: 0.8, TOV_pct: 22, USG_pct: 13.2, OWS: 1.5, DWS: 0.4, WS: 1.9, WS40: 0.094, MIN_pg: 18.5, PTS_pg: 9.3, REB_pg: 2.7, AST_pg: 1.4, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 1.6, FG_pct: 0.433, FG3_pct: 0.303, FT_pct: 0.667 },
    },
  },
  'consuca01w': {
    id: 'consuca01w',
    name: 'Cara Consuegra',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'UTA', age: 22, G: 15, MP: 50, MP_pct: 0.039, PER: -1.3, TS_pct: 0.148, ThrPAr: 0.4, FTr: 0.8, ORB_pct: 2.8, TRB_pct: 7.6, AST_pct: 31.9, STL_pct: 4.6, BLK_pct: 0, TOV_pct: 61.9, USG_pct: 17.4, OWS: -0.4, DWS: 0.1, WS: -0.4, WS40: -0.28 },
      2000: { G: 27, MIN_pg: 16, PTS_pg: 5.4, REB_pg: 1.7, AST_pg: 1.7, STL_pg: 1, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.405, FG3_pct: 0.321, FT_pct: 0.781 },
      2003: { G: 34, MIN_pg: 31.3, PTS_pg: 11.9, REB_pg: 3.1, AST_pg: 2.1, STL_pg: 1.5, BLK_pg: 0.4, TOV_pg: 1.6, FG_pct: 0.412, FG3_pct: 0.412, FT_pct: 0.725 },
      2004: { G: 34, MIN_pg: 33.9, PTS_pg: 14.4, REB_pg: 3.6, AST_pg: 3.1, STL_pg: 1.5, BLK_pg: 0.2, TOV_pg: 2, FG_pct: 0.417, FG3_pct: 0.387, FT_pct: 0.863 },
      2005: { G: 33, MIN_pg: 34.3, PTS_pg: 13.1, REB_pg: 3.5, AST_pg: 2.4, STL_pg: 1.2, BLK_pg: 0.2, TOV_pg: 2.5, FG_pct: 0.390, FG3_pct: 0.326, FT_pct: 0.850 },
      2006: { G: 34, MIN_pg: 29.3, PTS_pg: 10.2, REB_pg: 4.3, AST_pg: 2.2, STL_pg: 1.1, BLK_pg: 0.3, TOV_pg: 1.6, FG_pct: 0.393, FG3_pct: 0.378, FT_pct: 0.818 },
      2007: { G: 34, MIN_pg: 23.4, PTS_pg: 8.7, REB_pg: 3.3, AST_pg: 1.5, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.4, FG_pct: 0.418, FG3_pct: 0.410, FT_pct: 0.906 },
      2008: { G: 34, MIN_pg: 24.9, PTS_pg: 8.5, REB_pg: 3, AST_pg: 1.7, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.391, FG3_pct: 0.364, FT_pct: 0.763 },
      2009: { G: 7, MIN_pg: 16.1, PTS_pg: 1.4, REB_pg: 2.9, AST_pg: 1.4, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.278, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'coopeca01w': {
    id: 'coopeca01w',
    name: 'Camille Cooper',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'NYL', age: 22, G: 4, MP: 51, MP_pct: 0.04, PER: 28.1, TS_pct: 0.734, ThrPAr: 0, FTr: 1.083, ORB_pct: 18.8, TRB_pct: 14.5, AST_pct: 4, STL_pct: 0, BLK_pct: 3.7, TOV_pct: 14.5, USG_pct: 20.9, OWS: 0.4, DWS: 0, WS: 0.4, WS40: 0.336 },
      1998: { G: 9, MIN_pg: 10.2, PTS_pg: 3, REB_pg: 1, AST_pg: 1, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.303, FG3_pct: 0.188, FT_pct: 1.000 },
    },
  },
  'coopecy01w': {
    id: 'coopecy01w',
    name: 'Cynthia Cooper',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 34, G: 28, MP: 982, MP_pct: 0.869, PER: 32.2, TS_pct: 0.629, ThrPAr: 0.399, FTr: 0.49, ORB_pct: 4.3, TRB_pct: 7.5, AST_pct: 31.4, STL_pct: 3.4, BLK_pct: 0.5, TOV_pct: 18.1, USG_pct: 28.7, OWS: 8.1, DWS: 1.3, WS: 9.4, WS40: 0.385, MIN_pg: 35.1, PTS_pg: 22.2, REB_pg: 4.0, AST_pg: 4.7, STL_pg: 2.1, BLK_pg: 0.2, TOV_pg: 3.9, FG_pct: 0.470, FG3_pct: 0.414, FT_pct: 0.864 },
      1998: { team: 'HOU', age: 35, G: 30, MP: 1051, MP_pct: 0.865, PER: 31.1, TS_pct: 0.604, ThrPAr: 0.352, FTr: 0.541, ORB_pct: 3.1, TRB_pct: 6.8, AST_pct: 27, STL_pct: 2.6, BLK_pct: 0.9, TOV_pct: 14.4, USG_pct: 29.9, OWS: 8.1, DWS: 1.9, WS: 10, WS40: 0.382, MIN_pg: 35.0, PTS_pg: 22.7, REB_pg: 3.7, AST_pg: 4.4, STL_pg: 1.6, BLK_pg: 0.4, TOV_pg: 3.2, FG_pct: 0.446, FG3_pct: 0.400, FT_pct: 0.854 },
      1999: { team: 'HOU', age: 36, G: 31, MP: 1101, MP_pct: 0.857, PER: 29.5, TS_pct: 0.614, ThrPAr: 0.378, FTr: 0.5, ORB_pct: 2.1, TRB_pct: 5.2, AST_pct: 31.9, STL_pct: 2.2, BLK_pct: 0.8, TOV_pct: 15.7, USG_pct: 29.3, OWS: 7.7, DWS: 1.5, WS: 9.2, WS40: 0.335, MIN_pg: 35.5, PTS_pg: 22.1, REB_pg: 2.8, AST_pg: 5.2, STL_pg: 1.4, BLK_pg: 0.4, TOV_pg: 3.4, FG_pct: 0.463, FG3_pct: 0.335, FT_pct: 0.891 },
      2000: { team: 'HOU', age: 37, G: 31, MP: 1085, MP_pct: 0.838, PER: 23.4, TS_pct: 0.59, ThrPAr: 0.309, FTr: 0.429, ORB_pct: 2.3, TRB_pct: 5.3, AST_pct: 27.5, STL_pct: 2.1, BLK_pct: 0.5, TOV_pct: 17.5, USG_pct: 25.8, OWS: 5.2, DWS: 1.8, WS: 7, WS40: 0.259, MIN_pg: 35.0, PTS_pg: 17.7, REB_pg: 2.7, AST_pg: 5.0, STL_pg: 1.3, BLK_pg: 0.2, TOV_pg: 3.2, FG_pct: 0.459, FG3_pct: 0.355, FT_pct: 0.875 },
      2003: { team: 'HOU', age: 40, G: 4, MIN_pg: 36.0, PTS_pg: 16.0, REB_pg: 2.5, AST_pg: 5.5, STL_pg: 1.0, BLK_pg: 0.3, TOV_pg: 3.5, FG_pct: 0.421, FG3_pct: 0.389, FT_pct: 0.893 },
    },
  },
  'crawlsy01w': {
    id: 'crawlsy01w',
    name: 'Sylvia Crawley',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'POR', age: 27, G: 31, MP: 930, MP_pct: 0.713, PER: 14.6, TS_pct: 0.521, ThrPAr: 0.007, FTr: 0.342, ORB_pct: 9.4, TRB_pct: 13.7, AST_pct: 8.5, STL_pct: 1.8, BLK_pct: 2.4, TOV_pct: 20.4, USG_pct: 22.2, OWS: 0.4, DWS: 1.1, WS: 1.5, WS40: 0.063, MIN_pg: 25.6, PTS_pg: 7.1, REB_pg: 3.9, AST_pg: 1.2, STL_pg: 0.5, BLK_pg: 2, TOV_pg: 1.7, FG_pct: 0.423, FG3_pct: 0.000, FT_pct: 0.702 },
      2001: { team: 'POR', age: 28, G: 32, MP: 921, MP_pct: 0.706, PER: 15.6, TS_pct: 0.497, ThrPAr: 0.004, FTr: 0.288, ORB_pct: 8.4, TRB_pct: 13.7, AST_pct: 13.6, STL_pct: 1.2, BLK_pct: 2.4, TOV_pct: 16.9, USG_pct: 19.3, OWS: 1.2, DWS: 1, WS: 2.2, WS40: 0.097, MIN_pg: 6.5, PTS_pg: 1.9, REB_pg: 0.6, AST_pg: 0.2, STL_pg: 0.3, BLK_pg: 0.5, TOV_pg: 0.7, FG_pct: 0.368, FG3_pct: 0.000, FT_pct: 0.833 },
      2002: { G: 26, MIN_pg: 10, PTS_pg: 3.4, REB_pg: 1.3, AST_pg: 0.4, STL_pg: 0.2, BLK_pg: 0.5, TOV_pg: 0.8, FG_pct: 0.491, FG3_pct: 0.000, FT_pct: 0.783 },
    },
  },
  'crumpca01w': {
    id: 'crumpca01w',
    name: 'Cassandra Crumpton-Moorer',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 34, G: 2, MP: 11, MP_pct: 0.01, PER: 3, TS_pct: 0.25, ThrPAr: 0.25, FTr: 0, ORB_pct: 11.2, TRB_pct: 11.1, AST_pct: 17.1, STL_pct: 0, BLK_pct: 0, TOV_pct: 20, USG_pct: 20.5, OWS: 0, DWS: 0, WS: 0, WS40: -0.131 },
    },
  },
  'cunnibe01w': {
    id: 'cunnibe01w',
    name: 'Beth Cunningham',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'WAS', age: 25, G: 21, MP: 198, MP_pct: 0.155, PER: 5.5, TS_pct: 0.386, ThrPAr: 0.544, FTr: 0.279, ORB_pct: 2.8, TRB_pct: 7.3, AST_pct: 10.7, STL_pct: 0.6, BLK_pct: 0, TOV_pct: 13.6, USG_pct: 22.2, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.042, MIN_pg: 9.4, PTS_pg: 2.8, REB_pg: 1, AST_pg: 0.6, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.250, FG3_pct: 0.243, FT_pct: 0.842 },
    },
  },
  'daleygr01w': {
    id: 'daleygr01w',
    name: 'Grace Daley',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 22, G: 30, MP: 577, MP_pct: 0.449, PER: 11.2, TS_pct: 0.493, ThrPAr: 0.381, FTr: 0.442, ORB_pct: 7.6, TRB_pct: 8.7, AST_pct: 19.7, STL_pct: 1.2, BLK_pct: 0, TOV_pct: 22.2, USG_pct: 19.4, OWS: 0.3, DWS: 0.4, WS: 0.7, WS40: 0.048, MIN_pg: 19.2, PTS_pg: 5.8, REB_pg: 2.4, AST_pg: 1.9, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.7, FG_pct: 0.388, FG3_pct: 0.304, FT_pct: 0.646 },
      2001: { team: 'NYL', age: 23, G: 15, MP: 66, MP_pct: 0.052, PER: 20.7, TS_pct: 0.501, ThrPAr: 0.238, FTr: 0.429, ORB_pct: 6.2, TRB_pct: 8.2, AST_pct: 30.3, STL_pct: 7.1, BLK_pct: 1.4, TOV_pct: 21.9, USG_pct: 24.9, OWS: 0.1, DWS: 0.2, WS: 0.3, WS40: 0.157, MIN_pg: 4.4, PTS_pg: 1.7, REB_pg: 0.5, AST_pg: 0.7, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.476, FG3_pct: 0.000, FT_pct: 0.556 },
      2002: { G: 23, MIN_pg: 8, PTS_pg: 2.7, REB_pg: 1, AST_pg: 0.7, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.432, FG3_pct: 0.250, FT_pct: 0.617 },
      2003: { G: 3, MIN_pg: 9.3, PTS_pg: 0.7, REB_pg: 0.7, AST_pg: 1, STL_pg: 0, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.200, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'darlihe01w': {
    id: 'darlihe01w',
    name: 'Helen Darling',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'CLE', age: 21, G: 32, MP: 556, MP_pct: 0.428, PER: 10.5, TS_pct: 0.434, ThrPAr: 0.253, FTr: 0.433, ORB_pct: 6.1, TRB_pct: 8.2, AST_pct: 21.7, STL_pct: 3.9, BLK_pct: 0.8, TOV_pct: 27.3, USG_pct: 21.9, OWS: -0.8, DWS: 1, WS: 0.3, WS40: 0.019 },
      2001: { team: 'CLE', age: 22, G: 32, MP: 778, MP_pct: 0.605, PER: 13.4, TS_pct: 0.496, ThrPAr: 0.422, FTr: 0.434, ORB_pct: 3.3, TRB_pct: 6.8, AST_pct: 27.1, STL_pct: 2.7, BLK_pct: 0.5, TOV_pct: 26.2, USG_pct: 18.1, OWS: 0.7, DWS: 1.8, WS: 2.4, WS40: 0.124, MIN_pg: 20, PTS_pg: 7, REB_pg: 2.3, AST_pg: 1.8, STL_pg: 1.7, BLK_pg: 0.3, TOV_pg: 2, FG_pct: 0.362, FG3_pct: 0.316, FT_pct: 0.723 },
      2002: { G: 32, MIN_pg: 25.9, PTS_pg: 8.5, REB_pg: 4.2, AST_pg: 1.7, STL_pg: 1.5, BLK_pg: 0.4, TOV_pg: 1.31, FG_pct: 0.449, FG3_pct: 0.367, FT_pct: 0.866 },
      2003: { G: 28, MIN_pg: 30.1, PTS_pg: 12, REB_pg: 3.8, AST_pg: 2, STL_pg: 1.1, BLK_pg: 0.4, TOV_pg: 1, FG_pct: 0.438, FG3_pct: 0.382, FT_pct: 0.721 },
    },
  },
  'daviscl01w': {
    id: 'daviscl01w',
    name: 'Clarissa Davis-Wrightsil',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 32, G: 14, MP: 259, MP_pct: 0.202, PER: 18.3, TS_pct: 0.498, ThrPAr: 0.275, FTr: 0.2, ORB_pct: 7.3, TRB_pct: 9.3, AST_pct: 19.6, STL_pct: 2.6, BLK_pct: 1.3, TOV_pct: 14.4, USG_pct: 28.2, OWS: 0.4, DWS: 0.3, WS: 0.7, WS40: 0.106, MIN_pg: 20.3, PTS_pg: 5.3, REB_pg: 4.5, AST_pg: 1, STL_pg: 1.1, BLK_pg: 0.4, TOV_pg: 1.5, FG_pct: 0.330, FG3_pct: 0.167, FT_pct: 0.690 },
      1998: { G: 30, MIN_pg: 32.2, PTS_pg: 11.8, REB_pg: 10, AST_pg: 1.8, STL_pg: 1.7, BLK_pg: 0.7, TOV_pg: 2.2, FG_pct: 0.470, FG3_pct: 0.328, FT_pct: 0.707 },
    },
  },
  'deforan01w': {
    id: 'deforan01w',
    name: 'Anna DeForge',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 24, G: 27, MP: 433, MP_pct: 0.337, PER: 15.2, TS_pct: 0.518, ThrPAr: 0.444, FTr: 0.254, ORB_pct: 2.7, TRB_pct: 7.1, AST_pct: 19.5, STL_pct: 3.4, BLK_pct: 0.7, TOV_pct: 19.1, USG_pct: 18.2, OWS: 0.6, DWS: 0.4, WS: 1, WS40: 0.091, MIN_pg: 24.7, PTS_pg: 4.4, REB_pg: 4.4, AST_pg: 1.8, STL_pg: 1.2, BLK_pg: 0.1, TOV_pg: 2.2, FG_pct: 0.380, FG3_pct: 0.000, FT_pct: 0.756 },
      2001: { G: 4, MIN_pg: 1.5, PTS_pg: 0, REB_pg: 0.3, AST_pg: 0.3, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FT_pct: 0.000 },
    },
  },
  'dickeke01w': {
    id: 'dickeke01w',
    name: 'Keitha Dickerson',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 22, G: 32, MP: 791, MP_pct: 0.616, PER: 7.1, TS_pct: 0.439, ThrPAr: 0.014, FTr: 0.317, ORB_pct: 5.4, TRB_pct: 12.4, AST_pct: 14, STL_pct: 2.7, BLK_pct: 0.3, TOV_pct: 30.2, USG_pct: 14.5, OWS: -1.2, DWS: 1.4, WS: 0.2, WS40: 0.012 },
      2001: { team: 'UTA', age: 23, G: 4, MP: 6, MP_pct: 0.005, PER: -4.1, TS_pct: 0, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 10.6, AST_pct: 26.6, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 14.4, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.339 },
      1998: { G: 22, MIN_pg: 8.5, PTS_pg: 1.7, REB_pg: 1.2, AST_pg: 0.4, STL_pg: 0, BLK_pg: 0.3, TOV_pg: 0.9, FG_pct: 0.429, FT_pct: 0.571 },
    },
  },
  'dixonta01w': {
    id: 'dixonta01w',
    name: 'Tamecka Dixon',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 21, G: 27, MP: 715, MP_pct: 0.624, PER: 19.2, TS_pct: 0.55, ThrPAr: 0.206, FTr: 0.349, ORB_pct: 4, TRB_pct: 6.9, AST_pct: 14.4, STL_pct: 3.6, BLK_pct: 0.5, TOV_pct: 16.6, USG_pct: 21.6, OWS: 2.3, DWS: 1, WS: 3.3, WS40: 0.183, MIN_pg: 26.5, PTS_pg: 11.9, REB_pg: 3.0, AST_pg: 2.0, STL_pg: 1.8, BLK_pg: 0.2, FG_pct: 0.456, FG3_pct: 0.423, FT_pct: 0.773 },
      1998: { team: 'LAS', age: 22, G: 22, MP: 710, MP_pct: 0.589, PER: 18.2, TS_pct: 0.536, ThrPAr: 0.208, FTr: 0.399, ORB_pct: 2.2, TRB_pct: 4.7, AST_pct: 15.6, STL_pct: 1.8, BLK_pct: 0.9, TOV_pct: 14.6, USG_pct: 24.6, OWS: 2.3, DWS: 0.3, WS: 2.6, WS40: 0.144, MIN_pg: 32.3, PTS_pg: 16.2, REB_pg: 2.5, AST_pg: 2.5, STL_pg: 1.1, BLK_pg: 0.4, FG_pct: 0.438, FG3_pct: 0.356, FT_pct: 0.779 },
      1999: { team: 'LAS', age: 23, G: 32, MP: 563, MP_pct: 0.435, PER: 14.2, TS_pct: 0.477, ThrPAr: 0.241, FTr: 0.327, ORB_pct: 3.8, TRB_pct: 7.2, AST_pct: 17.1, STL_pct: 1.6, BLK_pct: 0.6, TOV_pct: 14.6, USG_pct: 21.7, OWS: 0.8, DWS: 0.4, WS: 1.2, WS40: 0.085, MIN_pg: 17.6, PTS_pg: 6.8, REB_pg: 2.1, AST_pg: 1.7, STL_pg: 0.5, BLK_pg: 0.1, FG_pct: 0.387, FG3_pct: 0.313, FT_pct: 0.738 },
      2000: { team: 'LAS', age: 24, G: 31, MP: 882, MP_pct: 0.684, PER: 16.6, TS_pct: 0.52, ThrPAr: 0.117, FTr: 0.265, ORB_pct: 5, TRB_pct: 7.4, AST_pct: 21, STL_pct: 2.5, BLK_pct: 0.9, TOV_pct: 15.6, USG_pct: 20.6, OWS: 1.9, DWS: 1.6, WS: 3.5, WS40: 0.159, MIN_pg: 28.5, PTS_pg: 10.9, REB_pg: 3.4, AST_pg: 3.1, STL_pg: 1.3, BLK_pg: 0.3, FG_pct: 0.454, FG3_pct: 0.353, FT_pct: 0.805 },
      2001: { team: 'LAS', age: 25, G: 29, MP: 925, MP_pct: 0.714, PER: 14.7, TS_pct: 0.476, ThrPAr: 0.107, FTr: 0.27, ORB_pct: 2.7, TRB_pct: 5.9, AST_pct: 21.9, STL_pct: 1.7, BLK_pct: 0.2, TOV_pct: 16.6, USG_pct: 21.9, OWS: 1.7, DWS: 0.4, WS: 2.2, WS40: 0.093, MIN_pg: 31.9, PTS_pg: 11.7, REB_pg: 2.9, AST_pg: 3.9, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.417, FG3_pct: 0.176, FT_pct: 0.791 },
      2002: { team: 'LAS', age: 26, G: 30, MIN_pg: 31.9, PTS_pg: 10.6, REB_pg: 3.1, AST_pg: 4.0, STL_pg: 0.9, BLK_pg: 0.2, FG_pct: 0.391, FG3_pct: 0.351, FT_pct: 0.831 },
      2003: { team: 'LAS', age: 27, G: 30, MIN_pg: 34.7, PTS_pg: 13.7, REB_pg: 4.2, AST_pg: 3.0, STL_pg: 1.2, BLK_pg: 0.3, FG_pct: 0.437, FG3_pct: 0.212, FT_pct: 0.883 },
      2004: { team: 'LAS', age: 28, G: 32, MIN_pg: 28.5, PTS_pg: 9.7,  REB_pg: 3.4, AST_pg: 3.5, STL_pg: 1.1, BLK_pg: 0.0, FG_pct: 0.442, FG3_pct: 0.455, FT_pct: 0.782 },
      2005: { team: 'LAS', age: 29, G: 30, MIN_pg: 20.2, PTS_pg: 5.3,  REB_pg: 2.2, AST_pg: 2.6, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.409, FG3_pct: 0.000, FT_pct: 0.850 },
      2006: { team: 'HOU', age: 30, G: 21, MIN_pg: 25.7, PTS_pg: 7.0,  REB_pg: 2.6, AST_pg: 2.3, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.404, FG3_pct: 0.111, FT_pct: 0.821 },
      2007: { team: 'HOU', age: 31, G: 18, MIN_pg: 27.2, PTS_pg: 12.0, REB_pg: 3.2, AST_pg: 3.2, STL_pg: 1.3, BLK_pg: 0.3, FG_pct: 0.439, FG3_pct: 0.294, FT_pct: 0.861 },
      2008: { team: 'HOU', age: 32, G: 24, MIN_pg: 26.4, PTS_pg: 9.0,  REB_pg: 3.2, AST_pg: 1.8, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.403, FG3_pct: 0.154, FT_pct: 0.857 },
    },
  },
  'domonna01w': {
    id: 'domonna01w',
    name: 'Nadine Domond',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: -1, G: 9, MP: 92, MP_pct: 0.076, PER: 8.4, TS_pct: 0.388, ThrPAr: 0.485, FTr: 0.121, ORB_pct: 8.1, TRB_pct: 6.2, AST_pct: 19.5, STL_pct: 4.2, BLK_pct: 0.9, TOV_pct: 24, USG_pct: 23.2, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.048, MIN_pg: 13.2, PTS_pg: 4.8, REB_pg: 0.8, AST_pg: 1.3, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.7, FG_pct: 0.297, FG3_pct: 0.286, FT_pct: 0.788 },
    },
  },
  'dossaci01w': {
    id: 'dossaci01w',
    name: 'Cintia dos Santos',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 25, G: 32, MP: 820, MP_pct: 0.631, PER: 11.8, TS_pct: 0.461, ThrPAr: 0.005, FTr: 0.257, ORB_pct: 5.6, TRB_pct: 10.1, AST_pct: 8.8, STL_pct: 1.1, BLK_pct: 6.6, TOV_pct: 17.9, USG_pct: 18.1, OWS: -0.1, DWS: 0.8, WS: 0.7, WS40: 0.036 },
      2001: { team: 'ORL', age: 26, G: 10, MP: 65, MP_pct: 0.05, PER: 5.4, TS_pct: 0.439, ThrPAr: 0, FTr: 0.316, ORB_pct: 2, TRB_pct: 6.1, AST_pct: 6.3, STL_pct: 2.6, BLK_pct: 7.1, TOV_pct: 24.4, USG_pct: 21, OWS: -0.1, DWS: 0.1, WS: -0.1, WS40: -0.036 },
      1998: { G: 23, MIN_pg: 7.2, PTS_pg: 1.5, REB_pg: 0.6, AST_pg: 0.6, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.500, FT_pct: 1.000 },
      1999: { G: 13, MIN_pg: 4.5, PTS_pg: 0.8, REB_pg: 0.4, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.2, FG_pct: 0.188, FG3_pct: 0.273, FT_pct: 1.000 },
    },
  },
  'douglka01w': {
    id: 'douglka01w',
    name: 'Katie Douglas',
    position: 'G-F',
    retired: true,
    seasons: {
      2001: { team: 'ORL', age: 22, G: 22, MP: 439, MP_pct: 0.34, PER: 15.8, TS_pct: 0.476, ThrPAr: 0.404, FTr: 0.333, ORB_pct: 4.6, TRB_pct: 7.7, AST_pct: 18.5, STL_pct: 4.8, BLK_pct: 1.5, TOV_pct: 21.4, USG_pct: 22.3, OWS: 0.2, DWS: 0.6, WS: 0.8, WS40: 0.071, MIN_pg: 12.8, PTS_pg: 6.5, REB_pg: 2.8, AST_pg: 0.3, STL_pg: 0, BLK_pg: 0.5, TOV_pg: 0.8, FG_pct: 0.667, FT_pct: 0.769 },
      2002: { G: 23, MIN_pg: 5.2, PTS_pg: 1.2, REB_pg: 0.7, AST_pg: 0.1, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.4, FG_pct: 0.393, FT_pct: 0.625 },
    },
  },
  'dydekma01w': {
    id: 'dydekma01w',
    name: 'Margo Dydek',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'UTA', age: 24, G: 30, MP: 839, MP_pct: 0.693, PER: 20.4, TS_pct: 0.538, ThrPAr: 0.023, FTr: 0.419, ORB_pct: 6, TRB_pct: 16.2, AST_pct: 13.5, STL_pct: 0.9, BLK_pct: 10.7, TOV_pct: 23.1, USG_pct: 25.4, OWS: 0.6, DWS: 1.2, WS: 1.8, WS40: 0.087, MIN_pg: 28.0, PTS_pg: 12.9, REB_pg: 7.8, AST_pg: 1.8, STL_pg: 0.5, BLK_pg: 3.8, FG_pct: 0.482, FG3_pct: 0.143, FT_pct: 0.732 },
      1999: { team: 'UTA', age: 25, G: 32, MP: 733, MP_pct: 0.564, PER: 25, TS_pct: 0.59, ThrPAr: 0.071, FTr: 0.47, ORB_pct: 6.7, TRB_pct: 17.8, AST_pct: 17.6, STL_pct: 1, BLK_pct: 9.2, TOV_pct: 21, USG_pct: 27.1, OWS: 2.2, DWS: 1, WS: 3.2, WS40: 0.174, MIN_pg: 22.9, PTS_pg: 12.6, REB_pg: 6.4, AST_pg: 1.8, STL_pg: 0.4, BLK_pg: 2.4, FG_pct: 0.498, FG3_pct: 0.350, FT_pct: 0.857 },
      2000: { team: 'UTA', age: 26, G: 32, MP: 775, MP_pct: 0.605, PER: 17.3, TS_pct: 0.523, ThrPAr: 0.059, FTr: 0.436, ORB_pct: 5.1, TRB_pct: 14.5, AST_pct: 12.3, STL_pct: 1.3, BLK_pct: 10.5, TOV_pct: 22.6, USG_pct: 21.5, OWS: 0.5, DWS: 1.2, WS: 1.7, WS40: 0.088, MIN_pg: 24.2, PTS_pg: 9.2, REB_pg: 5.5, AST_pg: 1.6, STL_pg: 0.6, BLK_pg: 3.0, FG_pct: 0.445, FG3_pct: 0.143, FT_pct: 0.796 },
      2001: { team: 'UTA', age: 27, G: 32, MP: 970, MP_pct: 0.749, PER: 19.2, TS_pct: 0.515, ThrPAr: 0.052, FTr: 0.375, ORB_pct: 4.2, TRB_pct: 15.9, AST_pct: 13.3, STL_pct: 1.5, BLK_pct: 9.8, TOV_pct: 21, USG_pct: 21.7, OWS: 0.7, DWS: 2.2, WS: 3, WS40: 0.123, MIN_pg: 30.3, PTS_pg: 10.9, REB_pg: 7.6, AST_pg: 2.0, STL_pg: 0.8, BLK_pg: 3.5, FG_pct: 0.440, FG3_pct: 0.400, FT_pct: 0.798 },
      2002: { team: 'UTA', age: 28, G: 30, MIN_pg: 29.2, PTS_pg: 13.1, REB_pg: 8.7, AST_pg: 2.4, STL_pg: 0.8, BLK_pg: 3.6, FG_pct: 0.436, FG3_pct: 0.250, FT_pct: 0.844 },
      2003: { team: 'SAN', age: 29, G: 34, MIN_pg: 27.2, PTS_pg: 11.9, REB_pg: 7.4, AST_pg: 1.7, STL_pg: 0.6, BLK_pg: 2.9, FG_pct: 0.451, FG3_pct: 0.000, FT_pct: 0.723 },
      2004: { team: 'SAN', age: 30, G: 34, MIN_pg: 20.1, PTS_pg: 6.6, REB_pg: 4.9, AST_pg: 1.8, STL_pg: 0.6, BLK_pg: 1.4, FG_pct: 0.433, FG3_pct: 0.500, FT_pct: 0.759 },
      2005: { team: 'CON', age: 31, G: 31, MIN_pg: 21.6, PTS_pg: 7.3, REB_pg: 6.3, AST_pg: 1.2, STL_pg: 0.3, BLK_pg: 2.3, FG_pct: 0.537, FG3_pct: 0.500, FT_pct: 0.769 },
      2006: { team: 'CON', age: 32, G: 34, MIN_pg: 21.9, PTS_pg: 9.4, REB_pg: 6.1, AST_pg: 1.2, STL_pg: 0.6, BLK_pg: 2.5, FG_pct: 0.494, FG3_pct: 0.250, FT_pct: 0.821 },
      2007: { team: 'CON', age: 33, G: 32, MIN_pg: 20.1, PTS_pg: 6.7, REB_pg: 6.5, AST_pg: 1.0, STL_pg: 0.4, BLK_pg: 2.1, FG_pct: 0.487, FG3_pct: 0.400, FT_pct: 0.789 },
      2008: { team: 'LAS', age: 34, G: 2, MIN_pg: 7.0, PTS_pg: 2.0, REB_pg: 1.5, AST_pg: 0.0, STL_pg: 0.0, BLK_pg: 0.0, FG_pct: 0.400 },
    },
  },
  'edwarmi01w': {
    id: 'edwarmi01w',
    name: 'Michelle Edwards',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 31, G: 20, MP: 622, MP_pct: 0.548, PER: 14.3, TS_pct: 0.488, ThrPAr: 0.153, FTr: 0.506, ORB_pct: 2.9, TRB_pct: 7.3, AST_pct: 27.7, STL_pct: 3, BLK_pct: 0.4, TOV_pct: 27, USG_pct: 21.4, OWS: 0, DWS: 0.7, WS: 0.8, WS40: 0.048 },
      1998: { team: 'CLE', age: 32, G: 23, MP: 533, MP_pct: 0.439, PER: 12.8, TS_pct: 0.481, ThrPAr: 0.209, FTr: 0.307, ORB_pct: 1.7, TRB_pct: 6.6, AST_pct: 22.8, STL_pct: 2.3, BLK_pct: 0.2, TOV_pct: 19.9, USG_pct: 20.9, OWS: 0.2, DWS: 0.5, WS: 0.8, WS40: 0.058 },
      1999: { team: 'CLE', age: 33, G: 31, MP: 745, MP_pct: 0.582, PER: 9.9, TS_pct: 0.431, ThrPAr: 0.282, FTr: 0.265, ORB_pct: 1.1, TRB_pct: 6.2, AST_pct: 22.9, STL_pct: 2, BLK_pct: 0.9, TOV_pct: 20.8, USG_pct: 22.5, OWS: -1.1, DWS: 0.6, WS: -0.4, WS40: -0.023, MIN_pg: 29.1, PTS_pg: 7.4, REB_pg: 5.4, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2.1, FG_pct: 0.364, FG3_pct: 0.275, FT_pct: 0.684 },
      2000: { team: 'SEA', age: 34, G: 20, MP: 455, MP_pct: 0.351, PER: 8.7, TS_pct: 0.414, ThrPAr: 0.224, FTr: 0.245, ORB_pct: 2, TRB_pct: 5.4, AST_pct: 21.8, STL_pct: 1.8, BLK_pct: 1, TOV_pct: 19.3, USG_pct: 22.3, OWS: -1, DWS: 0.2, WS: -0.8, WS40: -0.067, MIN_pg: 26.9, PTS_pg: 11.6, REB_pg: 3.8, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.3, FG_pct: 0.394, FG3_pct: 0.344, FT_pct: 0.767 },
      2001: { team: 'SEA', age: 35, G: 3, MP: 13, MP_pct: 0.01, PER: 16, TS_pct: 0.515, ThrPAr: 0, FTr: 0.667, ORB_pct: 0, TRB_pct: 10.4, AST_pct: 68.5, STL_pct: 4.7, BLK_pct: 0, TOV_pct: 43.6, USG_pct: 27.5, OWS: 0, DWS: 0, WS: 0, WS40: -0.001, MIN_pg: 19.5, PTS_pg: 6, REB_pg: 3.5, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.418, FG3_pct: 0.452, FT_pct: 0.714 },
      2002: { G: 4, MIN_pg: 14.8, PTS_pg: 4.8, REB_pg: 2.3, AST_pg: 0.8, STL_pg: 0.3, BLK_pg: 0.5, TOV_pg: 0.3, FG_pct: 0.278, FG3_pct: 0.000, FT_pct: 1.000 },
      2003: { G: 29, MIN_pg: 21.1, PTS_pg: 8.7, REB_pg: 4.3, AST_pg: 0.6, STL_pg: 1, BLK_pg: 0.1, TOV_pg: 1.4, FG_pct: 0.436, FG3_pct: 0.419, FT_pct: 0.805 },
    },
  },
  'edwarsi01w': {
    id: 'edwarsi01w',
    name: 'Simone Edwards',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 26, G: 29, MP: 645, MP_pct: 0.498, PER: 13.4, TS_pct: 0.497, ThrPAr: 0, FTr: 0.44, ORB_pct: 7.8, TRB_pct: 11.9, AST_pct: 8.8, STL_pct: 1.5, BLK_pct: 1.4, TOV_pct: 17.2, USG_pct: 21, OWS: 0.1, DWS: 0.5, WS: 0.6, WS40: 0.037 },
      2001: { team: 'SEA', age: 27, G: 32, MP: 810, MP_pct: 0.618, PER: 17.1, TS_pct: 0.523, ThrPAr: 0, FTr: 0.437, ORB_pct: 10.2, TRB_pct: 13.1, AST_pct: 7.8, STL_pct: 1.8, BLK_pct: 2.3, TOV_pct: 14, USG_pct: 16.9, OWS: 1.7, DWS: 0.9, WS: 2.6, WS40: 0.129 },
    },
  },
  'edwarto01w': {
    id: 'edwarto01w',
    name: 'Tonya Edwards',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 31, G: 32, MP: 1031, MP_pct: 0.796, PER: 15.6, TS_pct: 0.47, ThrPAr: 0.416, FTr: 0.212, ORB_pct: 1.8, TRB_pct: 7.3, AST_pct: 19.5, STL_pct: 1.6, BLK_pct: 1.3, TOV_pct: 11.9, USG_pct: 28, OWS: 1, DWS: 1, WS: 2.1, WS40: 0.081, MIN_pg: 32.2, PTS_pg: 14.8, REB_pg: 3.5, AST_pg: 2.6, STL_pg: 0.8, BLK_pg: 0.4, TOV_pg: 2.1, FG_pct: 0.357, FG3_pct: 0.344, FT_pct: 0.806 },
      2000: { team: 'PHO', age: 32, G: 32, MP: 926, MP_pct: 0.721, PER: 13.4, TS_pct: 0.494, ThrPAr: 0.383, FTr: 0.339, ORB_pct: 2.9, TRB_pct: 5.7, AST_pct: 12.4, STL_pct: 2.3, BLK_pct: 0.9, TOV_pct: 15.5, USG_pct: 22.3, OWS: 0.9, DWS: 1, WS: 1.9, WS40: 0.082, MIN_pg: 28.9, PTS_pg: 10.6, REB_pg: 2.4, AST_pg: 1.8, STL_pg: 1.1, BLK_pg: 0.3, TOV_pg: 2, FG_pct: 0.376, FG3_pct: 0.307, FT_pct: 0.782 },
      2001: { team: 'PHO', age: 33, G: 10, MP: 208, MP_pct: 0.161, PER: 13.4, TS_pct: 0.513, ThrPAr: 0.197, FTr: 0.662, ORB_pct: 3.1, TRB_pct: 6, AST_pct: 18.4, STL_pct: 1.4, BLK_pct: 0.4, TOV_pct: 19.4, USG_pct: 26.4, OWS: 0.3, DWS: 0.1, WS: 0.3, WS40: 0.067, MIN_pg: 16.9, PTS_pg: 4.5, REB_pg: 2, AST_pg: 1.4, STL_pg: 0.6, BLK_pg: 0.3, TOV_pg: 1.8, FG_pct: 0.340, FG3_pct: 0.227, FT_pct: 0.730 },
      2002: { G: 29, MIN_pg: 10.4, PTS_pg: 3.9, REB_pg: 1.4, AST_pg: 0.8, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.364, FG3_pct: 0.280, FT_pct: 0.717 },
    },
  },
  'enissh01w': {
    id: 'enissh01w',
    name: 'Shalonda Enis',
    position: 'F-C',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 24, G: 29, MP: 844, MP_pct: 0.652, PER: 9.5, TS_pct: 0.427, ThrPAr: 0.175, FTr: 0.25, ORB_pct: 8.6, TRB_pct: 12, AST_pct: 11.4, STL_pct: 1.6, BLK_pct: 0.4, TOV_pct: 19.2, USG_pct: 18, OWS: -0.4, DWS: 0.7, WS: 0.3, WS40: 0.013 },
      2000: { team: 'CHA', age: 25, G: 12, MP: 323, MP_pct: 0.249, PER: 16.9, TS_pct: 0.533, ThrPAr: 0.308, FTr: 0.577, ORB_pct: 8.7, TRB_pct: 9.4, AST_pct: 6.2, STL_pct: 1.8, BLK_pct: 0.3, TOV_pct: 10.9, USG_pct: 22.1, OWS: 1, DWS: -0.2, WS: 0.8, WS40: 0.1, MIN_pg: 9.5, PTS_pg: 3.2, REB_pg: 2.2, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.438, FG3_pct: 0.000, FT_pct: 0.651 },
      2001: { team: 'CHA', age: 26, G: 32, MP: 623, MP_pct: 0.479, PER: 13.3, TS_pct: 0.514, ThrPAr: 0.196, FTr: 0.399, ORB_pct: 11.4, TRB_pct: 12.7, AST_pct: 4.8, STL_pct: 1, BLK_pct: 0.7, TOV_pct: 16.2, USG_pct: 18.6, OWS: 1.2, DWS: 0.4, WS: 1.7, WS40: 0.107, MIN_pg: 8.2, PTS_pg: 3, REB_pg: 1.9, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0.3, TOV_pg: 0.6, FG_pct: 0.429, FG3_pct: 0.000, FT_pct: 0.857 },
      2002: { G: 31, MIN_pg: 11, PTS_pg: 2.8, REB_pg: 2.3, AST_pg: 0.3, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 1.1, FG_pct: 0.565, FG3_pct: 0.000, FT_pct: 0.720 },
    },
  },
  'erbsu01w': {
    id: 'erbsu01w',
    name: 'Summer Erb',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'CHA', age: 22, G: 29, MP: 275, MP_pct: 0.212, PER: 12.4, TS_pct: 0.5, ThrPAr: 0.014, FTr: 0.589, ORB_pct: 12.6, TRB_pct: 15.4, AST_pct: 7.1, STL_pct: 1.7, BLK_pct: 1.9, TOV_pct: 15.6, USG_pct: 19.3, OWS: 0.4, DWS: 0, WS: 0.4, WS40: 0.059 },
      2001: { team: 'CHA', age: 23, G: 18, MP: 148, MP_pct: 0.114, PER: 15.5, TS_pct: 0.527, ThrPAr: 0, FTr: 0.5, ORB_pct: 8, TRB_pct: 16.5, AST_pct: 6, STL_pct: 0.4, BLK_pct: 3, TOV_pct: 16.3, USG_pct: 21.6, OWS: 0.4, DWS: 0.2, WS: 0.6, WS40: 0.155, MIN_pg: 27.1, PTS_pg: 10.4, REB_pg: 2.5, AST_pg: 1.1, STL_pg: 1.1, BLK_pg: 0.4, TOV_pg: 1.5, FG_pct: 0.490, FG3_pct: 0.405, FT_pct: 0.815 },
      1999: { G: 26, MIN_pg: 10.8, PTS_pg: 3, REB_pg: 0.8, AST_pg: 0.8, STL_pg: 0.4, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.300, FG3_pct: 0.353, FT_pct: 0.742 },
    },
  },
  'fallotr01w': {
    id: 'fallotr01w',
    name: 'Trisha Fallon',
    position: 'G-F',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 26, G: 26, MP: 281, MP_pct: 0.217, PER: 9.8, TS_pct: 0.411, ThrPAr: 0.213, FTr: 0.388, ORB_pct: 4, TRB_pct: 5.2, AST_pct: 15.9, STL_pct: 2.3, BLK_pct: 2.1, TOV_pct: 14.6, USG_pct: 19.7, OWS: -0.1, DWS: 0.3, WS: 0.2, WS40: 0.024 },
      2001: { team: 'PHO', age: 28, G: 31, MP: 841, MP_pct: 0.652, PER: 16.9, TS_pct: 0.56, ThrPAr: 0.143, FTr: 0.251, ORB_pct: 5.4, TRB_pct: 6, AST_pct: 8.8, STL_pct: 2.4, BLK_pct: 1.2, TOV_pct: 14, USG_pct: 19.2, OWS: 2, DWS: 0.4, WS: 2.4, WS40: 0.116, MIN_pg: 18, PTS_pg: 4.2, REB_pg: 3.5, AST_pg: 0.5, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.469, FG3_pct: 0.000, FT_pct: 0.638 },
      2000: { G: 14, MIN_pg: 9.3, PTS_pg: 3.2, REB_pg: 2.3, AST_pg: 0.1, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.556 },
      2002: { G: 32, MIN_pg: 17.6, PTS_pg: 4.5, REB_pg: 2.9, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.3, TOV_pg: 1.2, FG_pct: 0.419, FG3_pct: 0.000, FT_pct: 0.738 },
    },
  },
  'farriba01w': {
    id: 'farriba01w',
    name: 'Barbara Farris',
    position: 'F-C',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 23, G: 14, MP: 130, MP_pct: 0.101, PER: 11.6, TS_pct: 0.537, ThrPAr: 0.033, FTr: 0.9, ORB_pct: 16.1, TRB_pct: 16.2, AST_pct: 2.7, STL_pct: 2.5, BLK_pct: 0.6, TOV_pct: 25.1, USG_pct: 19.6, OWS: 0, DWS: 0.1, WS: 0.2, WS40: 0.05, MIN_pg: 14.7, PTS_pg: 6.3, REB_pg: 2.7, AST_pg: 1, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.359, FG3_pct: 0.259, FT_pct: 0.833 },
      2001: { team: 'DET', age: 24, G: 31, MP: 559, MP_pct: 0.427, PER: 10.3, TS_pct: 0.522, ThrPAr: 0, FTr: 0.592, ORB_pct: 9.4, TRB_pct: 13.3, AST_pct: 5.6, STL_pct: 0.7, BLK_pct: 0.8, TOV_pct: 19.5, USG_pct: 13.6, OWS: 0.7, DWS: 0, WS: 0.6, WS40: 0.046, MIN_pg: 31.5, PTS_pg: 11.4, REB_pg: 4.8, AST_pg: 1.4, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 1.8, FG_pct: 0.375, FG3_pct: 0.327, FT_pct: 0.921 },
      1999: { G: 32, MIN_pg: 12.8, PTS_pg: 5.1, REB_pg: 1.8, AST_pg: 1, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.495, FG3_pct: 0.368, FT_pct: 0.684 },
    },
  },
  'feastal01w': {
    id: 'feastal01w',
    name: 'Allison Feaster',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'LAS', age: 22, G: 3, MP: 41, MP_pct: 0.034, PER: -0.3, TS_pct: 0.336, ThrPAr: 0.714, FTr: 0.143, ORB_pct: 2.9, TRB_pct: 2.9, AST_pct: 12.4, STL_pct: 2.6, BLK_pct: 0, TOV_pct: 21.2, USG_pct: 20.6, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.099 },
      1999: { team: 'LAS', age: 23, G: 32, MP: 410, MP_pct: 0.317, PER: 18.7, TS_pct: 0.632, ThrPAr: 0.553, FTr: 0.553, ORB_pct: 8.5, TRB_pct: 8.7, AST_pct: 13.9, STL_pct: 2, BLK_pct: 1.4, TOV_pct: 17.9, USG_pct: 17.4, OWS: 1.6, DWS: 0.3, WS: 1.9, WS40: 0.19 },
      2000: { team: 'LAS', age: 24, G: 32, MP: 469, MP_pct: 0.364, PER: 17.5, TS_pct: 0.508, ThrPAr: 0.509, FTr: 0.431, ORB_pct: 10, TRB_pct: 11.3, AST_pct: 13, STL_pct: 2.7, BLK_pct: 0.4, TOV_pct: 15, USG_pct: 23.6, OWS: 1.1, DWS: 1, WS: 2.1, WS40: 0.175 },
      2001: { team: 'CHA', age: 25, G: 32, MP: 1007, MP_pct: 0.775, PER: 15.7, TS_pct: 0.502, ThrPAr: 0.5, FTr: 0.188, ORB_pct: 8.1, TRB_pct: 10.6, AST_pct: 10.2, STL_pct: 1.8, BLK_pct: 0.9, TOV_pct: 14, USG_pct: 21.9, OWS: 2.5, DWS: 0.9, WS: 3.4, WS40: 0.135 },
    },
  },
  'ferdima01w': {
    id: 'ferdima01w',
    name: 'Marie Ferdinand-Harris',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'UTA', age: 22, G: 32, MP: 864, MP_pct: 0.667, PER: 18.5, TS_pct: 0.539, ThrPAr: 0.145, FTr: 0.39, ORB_pct: 3.7, TRB_pct: 6.3, AST_pct: 19.8, STL_pct: 2.7, BLK_pct: 0.4, TOV_pct: 15.6, USG_pct: 22.9, OWS: 2.2, DWS: 0.5, WS: 2.7, WS40: 0.126, MIN_pg: 27, PTS_pg: 11.4, REB_pg: 2.7, AST_pg: 2.5, STL_pg: 1.3, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.493, FG3_pct: 0.262, FT_pct: 0.611 },
      2002: { G: 32, MIN_pg: 33.3, PTS_pg: 15.3, REB_pg: 3.3, AST_pg: 2.8, STL_pg: 1.6, BLK_pg: 0.2, TOV_pg: 2.8, FG_pct: 0.474, FG3_pct: 0.147, FT_pct: 0.772 },
      2003: { G: 34, MIN_pg: 32.8, PTS_pg: 13.8, REB_pg: 3.7, AST_pg: 2.6, STL_pg: 1.7, BLK_pg: 0.2, TOV_pg: 2.5, FG_pct: 0.362, FG3_pct: 0.308, FT_pct: 0.789 },
    },
  },
  'ferrama01w': {
    id: 'ferrama01w',
    name: 'Marina Ferragut',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'NYL', age: 28, G: 23, MP: 154, MP_pct: 0.12, PER: 5.1, TS_pct: 0.464, ThrPAr: 0.189, FTr: 0.038, ORB_pct: 3.6, TRB_pct: 7.4, AST_pct: 5.6, STL_pct: 0, BLK_pct: 1.2, TOV_pct: 17, USG_pct: 21.3, OWS: -0.2, DWS: 0.2, WS: 0, WS40: -0.006 },
    },
  },
  'figgsuk01w': {
    id: 'figgsuk01w',
    name: 'Ukari Figgs',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 22, G: 22, MP: 330, MP_pct: 0.255, PER: 11.1, TS_pct: 0.513, ThrPAr: 0.573, FTr: 0.293, ORB_pct: 3, TRB_pct: 6.5, AST_pct: 16.8, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 25.1, USG_pct: 17.2, OWS: 0.1, DWS: 0.3, WS: 0.4, WS40: 0.054, MIN_pg: 15, PTS_pg: 4.3, REB_pg: 1.6, AST_pg: 1.5, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.366, FG3_pct: 0.298, FT_pct: 0.875 },
      2000: { team: 'LAS', age: 23, G: 32, MP: 803, MP_pct: 0.622, PER: 14.8, TS_pct: 0.592, ThrPAr: 0.536, FTr: 0.425, ORB_pct: 2.3, TRB_pct: 4.3, AST_pct: 27, STL_pct: 1.4, BLK_pct: 0.3, TOV_pct: 19.1, USG_pct: 13.2, OWS: 2.5, DWS: 1, WS: 3.4, WS40: 0.172, MIN_pg: 25.1, PTS_pg: 6.7, REB_pg: 1.7, AST_pg: 4, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 1.3, FG_pct: 0.431, FG3_pct: 0.354, FT_pct: 0.831 },
      2001: { team: 'LAS', age: 24, G: 32, MP: 930, MP_pct: 0.718, PER: 17.3, TS_pct: 0.622, ThrPAr: 0.654, FTr: 0.352, ORB_pct: 2, TRB_pct: 6.9, AST_pct: 21.7, STL_pct: 2.6, BLK_pct: 0.4, TOV_pct: 21, USG_pct: 13.3, OWS: 3.2, DWS: 0.9, WS: 4.1, WS40: 0.177, MIN_pg: 29.1, PTS_pg: 8, REB_pg: 3.1, AST_pg: 3.9, STL_pg: 1.3, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.425, FG3_pct: 0.462, FT_pct: 0.810 },
    },
  },
  'fijalis01w': {
    id: 'fijalis01w',
    name: 'Isabelle Fijalkowski',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 25, G: 28, MP: 803, MP_pct: 0.707, PER: 18.5, TS_pct: 0.57, ThrPAr: 0.016, FTr: 0.419, ORB_pct: 10.6, TRB_pct: 12.5, AST_pct: 17.5, STL_pct: 1.2, BLK_pct: 1.9, TOV_pct: 20, USG_pct: 21.2, OWS: 2.9, DWS: 0.7, WS: 3.6, WS40: 0.18, MIN_pg: 28.7, PTS_pg: 11.9, REB_pg: 5.6, AST_pg: 2.4, STL_pg: 0.6, BLK_pg: 0.6, TOV_pg: 2.6, FG_pct: 0.508, FG3_pct: 0.250, FT_pct: 0.786 },
      1998: { team: 'CLE', age: 26, G: 28, MP: 806, MP_pct: 0.663, PER: 20.9, TS_pct: 0.611, ThrPAr: 0.037, FTr: 0.397, ORB_pct: 10.8, TRB_pct: 16.1, AST_pct: 15, STL_pct: 1.1, BLK_pct: 2.8, TOV_pct: 20.5, USG_pct: 23.6, OWS: 2.8, DWS: 1.2, WS: 4, WS40: 0.2, MIN_pg: 28.8, PTS_pg: 13.7, REB_pg: 6.9, AST_pg: 2.1, STL_pg: 0.6, BLK_pg: 1, TOV_pg: 2.9, FG_pct: 0.547, FG3_pct: 0.400, FT_pct: 0.821 },
    },
  },
  'firsool01w': {
    id: 'firsool01w',
    name: 'Olga Firsova',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'NYL', age: 24, G: 9, MP: 19, MP_pct: 0.015, PER: 14.5, TS_pct: 0.492, ThrPAr: 0.1, FTr: 0.5, ORB_pct: 0, TRB_pct: 14.2, AST_pct: 13, STL_pct: 0, BLK_pct: 4.8, TOV_pct: 14.1, USG_pct: 37.8, OWS: 0, DWS: 0, WS: 0.1, WS40: 0.128, MIN_pg: 2.1, PTS_pg: 1.3, REB_pg: 0.4, AST_pg: 0.1, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.2, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.800 },
    },
  },
  'floremi01w': {
    id: 'floremi01w',
    name: 'Milena Flores',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIA', age: 22, G: 32, MP: 474, MP_pct: 0.366, PER: 7.1, TS_pct: 0.429, ThrPAr: 0.545, FTr: 0.375, ORB_pct: 1.6, TRB_pct: 3.3, AST_pct: 24.2, STL_pct: 3, BLK_pct: 0.6, TOV_pct: 26.9, USG_pct: 18.8, OWS: -0.9, DWS: 0.7, WS: -0.2, WS40: -0.017 },
    },
  },
  'folklkr01w': {
    id: 'folklkr01w',
    name: 'Kristin Folkl',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 23, G: 32, MP: 518, MP_pct: 0.4, PER: 15.3, TS_pct: 0.499, ThrPAr: 0.1, FTr: 0.279, ORB_pct: 10, TRB_pct: 15, AST_pct: 9.9, STL_pct: 1.6, BLK_pct: 2.3, TOV_pct: 12.8, USG_pct: 17.5, OWS: 0.8, DWS: 0.8, WS: 1.6, WS40: 0.121, MIN_pg: 16.2, PTS_pg: 4.9, REB_pg: 3.6, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 0.7, FG_pct: 0.479, FG3_pct: 0.143, FT_pct: 0.538 },
      2000: { team: 'MIN', age: 24, G: 32, MP: 845, MP_pct: 0.658, PER: 14.7, TS_pct: 0.521, ThrPAr: 0.099, FTr: 0.492, ORB_pct: 6.2, TRB_pct: 12.7, AST_pct: 15.9, STL_pct: 1.6, BLK_pct: 2.6, TOV_pct: 17.7, USG_pct: 16.6, OWS: 1.3, DWS: 1.3, WS: 2.6, WS40: 0.124, MIN_pg: 26.4, PTS_pg: 7.6, REB_pg: 4.8, AST_pg: 2.1, STL_pg: 0.7, BLK_pg: 0.7, TOV_pg: 1.6, FG_pct: 0.450, FG3_pct: 0.211, FT_pct: 0.702 },
      2001: { team: 'POR', age: 25, G: 32, MP: 862, MP_pct: 0.661, PER: 14.7, TS_pct: 0.49, ThrPAr: 0.072, FTr: 0.241, ORB_pct: 7, TRB_pct: 17.6, AST_pct: 10.9, STL_pct: 1.3, BLK_pct: 3.4, TOV_pct: 17.5, USG_pct: 12.7, OWS: 0.9, DWS: 1.6, WS: 2.5, WS40: 0.115, MIN_pg: 26.9, PTS_pg: 5.6, REB_pg: 7.7, AST_pg: 1.4, STL_pg: 0.6, BLK_pg: 1.1, TOV_pg: 1.2, FG_pct: 0.428, FG3_pct: 0.417, FT_pct: 0.825 },
      2002: { G: 32, MIN_pg: 18.8, PTS_pg: 4.8, REB_pg: 4.6, AST_pg: 1, STL_pg: 0.6, BLK_pg: 0.5, TOV_pg: 1, FG_pct: 0.492, FG3_pct: 0.000, FT_pct: 0.886 },
    },
  },
  'fordki01w': {
    id: 'fordki01w',
    name: 'Kisha Ford',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 22, G: 28, MP: 473, MP_pct: 0.417, PER: 8.6, TS_pct: 0.435, ThrPAr: 0.175, FTr: 0.386, ORB_pct: 7.3, TRB_pct: 6.2, AST_pct: 9.9, STL_pct: 3.2, BLK_pct: 0.9, TOV_pct: 22.2, USG_pct: 16.3, OWS: -0.2, DWS: 0.7, WS: 0.5, WS40: 0.046, MIN_pg: 16.9, PTS_pg: 4.1, REB_pg: 1.7, AST_pg: 0.9, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 1.4, FG_pct: 0.377, FG3_pct: 0.150, FT_pct: 0.614 },
      1998: { team: 'NYL', age: 23, G: 30, MP: 471, MP_pct: 0.389, PER: 13.2, TS_pct: 0.472, ThrPAr: 0.08, FTr: 0.29, ORB_pct: 6.3, TRB_pct: 5.2, AST_pct: 9.8, STL_pct: 3.8, BLK_pct: 0.4, TOV_pct: 9.3, USG_pct: 17.2, OWS: 0.9, DWS: 0.8, WS: 1.6, WS40: 0.139, MIN_pg: 15.7, PTS_pg: 4.9, REB_pg: 1.2, AST_pg: 0.8, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.435, FG3_pct: 0.182, FT_pct: 0.625 },
      1999: { team: 'ORL', age: 24, G: 8, MP: 45, MP_pct: 0.035, PER: 4.5, TS_pct: 0.34, ThrPAr: 0.2, FTr: 0.4, ORB_pct: 11.5, TRB_pct: 8.7, AST_pct: 0, STL_pct: 2.5, BLK_pct: 3.9, TOV_pct: 14.5, USG_pct: 7.3, OWS: 0, DWS: 0, WS: 0, WS40: 0.039, MIN_pg: 5.6, PTS_pg: 0.5, REB_pg: 0.8, AST_pg: 0, STL_pg: 0.3, BLK_pg: 0.3, TOV_pg: 0.1, FG_pct: 0.200, FG3_pct: 0.000, FT_pct: 1.000 },
      2000: { team: 'MIA', age: 25, G: 28, MP: 424, MP_pct: 0.327, PER: 9.5, TS_pct: 0.383, ThrPAr: 0.037, FTr: 0.583, ORB_pct: 9.6, TRB_pct: 10.1, AST_pct: 11.7, STL_pct: 4.6, BLK_pct: 0.2, TOV_pct: 16.6, USG_pct: 19.2, OWS: -0.5, DWS: 1, WS: 0.5, WS40: 0.043, MIN_pg: 15.1, PTS_pg: 3.6, REB_pg: 2.2, AST_pg: 0.8, STL_pg: 1.1, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.306, FG3_pct: 0.250, FT_pct: 0.574 },
      2001: { team: 'MIA', age: 26, G: 30, MP: 395, MP_pct: 0.3, PER: 8.9, TS_pct: 0.377, ThrPAr: 0.138, FTr: 0.4, ORB_pct: 6.6, TRB_pct: 11.3, AST_pct: 10.5, STL_pct: 2.7, BLK_pct: 1.3, TOV_pct: 16.1, USG_pct: 15, OWS: -0.3, DWS: 0.8, WS: 0.5, WS40: 0.055, MIN_pg: 13.2, PTS_pg: 2.4, REB_pg: 2.2, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.325, FG3_pct: 0.091, FT_pct: 0.563 },
    },
  },
  'fordst01w': {
    id: 'fordst01w',
    name: 'Stacey Ford',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'NYL', age: 32, G: 1, MP: 3, MP_pct: 0.002, PER: 43.2, TS_pct: 1, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 22.5, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 17.2, OWS: 0, DWS: 0, WS: 0, WS40: 0.41 },
    },
  },
  'fosteto01w': {
    id: 'fosteto01w',
    name: 'Toni Foster',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 25, G: 28, MP: 736, MP_pct: 0.648, PER: 18, TS_pct: 0.52, ThrPAr: 0.03, FTr: 0.403, ORB_pct: 10.2, TRB_pct: 14.4, AST_pct: 8.1, STL_pct: 3.9, BLK_pct: 2.5, TOV_pct: 18.3, USG_pct: 17.7, OWS: 1.4, DWS: 2.1, WS: 3.5, WS40: 0.191, MIN_pg: 26.3, PTS_pg: 8.8, REB_pg: 6.1, AST_pg: 1, STL_pg: 1.9, BLK_pg: 0.8, TOV_pg: 1.9, FG_pct: 0.468, FG3_pct: 0.167, FT_pct: 0.704 },
      1998: { team: 'PHO', age: 26, G: 16, MP: 218, MP_pct: 0.179, PER: 18.5, TS_pct: 0.54, ThrPAr: 0, FTr: 0.5, ORB_pct: 5.7, TRB_pct: 8.9, AST_pct: 16.8, STL_pct: 3.5, BLK_pct: 1.9, TOV_pct: 17, USG_pct: 18.5, OWS: 0.6, DWS: 0.5, WS: 1.1, WS40: 0.195, MIN_pg: 13.6, PTS_pg: 4.9, REB_pg: 1.9, AST_pg: 1.2, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 0.9, FG_pct: 0.467, FT_pct: 0.767 },
      1999: { team: 'PHO', age: 27, G: 10, MP: 42, MP_pct: 0.033, PER: 24.1, TS_pct: 0.657, ThrPAr: 0, FTr: 1.333, ORB_pct: 11.9, TRB_pct: 12.1, AST_pct: 5.6, STL_pct: 0, BLK_pct: 2, TOV_pct: 17.4, USG_pct: 26.2, OWS: 0.2, DWS: 0, WS: 0.3, WS40: 0.239, MIN_pg: 4.2, PTS_pg: 2.5, REB_pg: 0.8, AST_pg: 0.1, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.583, FT_pct: 0.688 },
    },
  },
  'francde01w': {
    id: 'francde01w',
    name: 'Desiree Francis',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'NYL', age: 24, G: 1, MP: 2, MP_pct: 0.002, PER: -21.1, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 25.3, OWS: 0, DWS: 0, WS: 0, WS40: -0.564, MIN_pg: 2, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'fresest01w': {
    id: 'fresest01w',
    name: 'Stacy Frese',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 23, G: 21, MP: 222, MP_pct: 0.173, PER: 12.5, TS_pct: 0.676, ThrPAr: 0.867, FTr: 1.2, ORB_pct: 2.4, TRB_pct: 5.2, AST_pct: 12.2, STL_pct: 1, BLK_pct: 0, TOV_pct: 23.4, USG_pct: 12.4, OWS: 0.7, DWS: -0.1, WS: 0.6, WS40: 0.115 },
    },
  },
  'frettla01w': {
    id: 'frettla01w',
    name: 'La\'Keshia Frett',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 24, G: 31, MP: 658, MP_pct: 0.508, PER: 14.9, TS_pct: 0.52, ThrPAr: 0, FTr: 0.265, ORB_pct: 9.1, TRB_pct: 8.8, AST_pct: 16.8, STL_pct: 0.7, BLK_pct: 0.6, TOV_pct: 12.6, USG_pct: 14.4, OWS: 1.9, DWS: 0.2, WS: 2.1, WS40: 0.129, MIN_pg: 21.2, PTS_pg: 6.1, REB_pg: 3, AST_pg: 2.1, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 0.8, FG_pct: 0.478, FG3_pct: 0.000, FT_pct: 0.791 },
      2000: { team: 'LAS', age: 25, G: 25, MP: 187, MP_pct: 0.145, PER: 5.6, TS_pct: 0.345, ThrPAr: 0.02, FTr: 0.314, ORB_pct: 5.6, TRB_pct: 8, AST_pct: 5.4, STL_pct: 2.1, BLK_pct: 2.7, TOV_pct: 18.3, USG_pct: 18, OWS: -0.5, DWS: 0.4, WS: -0.1, WS40: -0.027, MIN_pg: 7.5, PTS_pg: 1.6, REB_pg: 1, AST_pg: 0.2, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 0.5, FG_pct: 0.275, FG3_pct: 0.000, FT_pct: 0.750 },
      2001: { team: 'SAC', age: 26, G: 30, MP: 403, MP_pct: 0.309, PER: 10.6, TS_pct: 0.453, ThrPAr: 0, FTr: 0.278, ORB_pct: 7.2, TRB_pct: 8.5, AST_pct: 8.6, STL_pct: 1.4, BLK_pct: 1.2, TOV_pct: 18.5, USG_pct: 20.5, OWS: 0.1, DWS: 0.3, WS: 0.4, WS40: 0.042, MIN_pg: 13.4, PTS_pg: 4.3, REB_pg: 1.8, AST_pg: 0.6, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.389, FG3_pct: 0.000, FT_pct: 0.857 },
      2002: { G: 32, MIN_pg: 20.3, PTS_pg: 5.8, REB_pg: 3, AST_pg: 0.7, STL_pg: 0.2, BLK_pg: 0.6, TOV_pg: 0.8, FG_pct: 0.449, FG3_pct: 0.333, FT_pct: 0.824 },
      2003: { G: 24, MIN_pg: 6.3, PTS_pg: 1.5, REB_pg: 1, AST_pg: 0.5, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.362, FG3_pct: 0.500, FT_pct: 0.500 },
      2004: { G: 26, MIN_pg: 12.8, PTS_pg: 4.2, REB_pg: 1.8, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.473, FG3_pct: 0.000, FT_pct: 0.611 },
      2005: { G: 33, MIN_pg: 10.9, PTS_pg: 3, REB_pg: 1.2, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.477, FG3_pct: 0.000, FT_pct: 0.737 },
    },
  },
  'gaithka01w': {
    id: 'gaithka01w',
    name: 'Katryna Gaither',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 24, G: 9, MP: 54, MP_pct: 0.042, PER: 19, TS_pct: 0.614, ThrPAr: 0, FTr: 1.429, ORB_pct: 17.5, TRB_pct: 20.2, AST_pct: 11.7, STL_pct: 4, BLK_pct: 0, TOV_pct: 26, USG_pct: 13.1, OWS: 0.2, DWS: 0.1, WS: 0.3, WS40: 0.203, MIN_pg: 4, PTS_pg: 1, REB_pg: 0.5, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0.2, TOV_pg: 0.2, FG_pct: 0.375, FG3_pct: 0.000, FT_pct: 0.000 },
      2002: { G: 1, MIN_pg: 1, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'ganttr01w': {
    id: 'ganttr01w',
    name: 'Travesa Gant',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 25, G: 2, MP: 13, MP_pct: 0.011, PER: -13.4, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 14, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 66.7, USG_pct: 10.2, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.247 },
    },
  },
  'garnean01w': {
    id: 'garnean01w',
    name: 'Andrea Garner',
    position: 'F-C',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 21, G: 32, MP: 560, MP_pct: 0.432, PER: 8.3, TS_pct: 0.381, ThrPAr: 0.017, FTr: 0.328, ORB_pct: 10.2, TRB_pct: 12.6, AST_pct: 10, STL_pct: 2.9, BLK_pct: 1.7, TOV_pct: 24.5, USG_pct: 16.2, OWS: -1.3, DWS: 0.7, WS: -0.6, WS40: -0.042 },
    },
  },
  'gaydeco01w': {
    id: 'gaydeco01w',
    name: 'Cornelia Gayden',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 29, G: 3, MP: 7, MP_pct: 0.005, PER: 15.6, TS_pct: 0.5, ThrPAr: 0.5, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 28.7, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 14.1, OWS: 0, DWS: 0, WS: 0, WS40: 0.121 },
    },
  },
  'gaypi01w': {
    id: 'gaypi01w',
    name: 'Pietra Gay',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 22, G: 5, MP: 12, MP_pct: 0.011, PER: 2.8, TS_pct: 0.476, ThrPAr: 0, FTr: 2.5, ORB_pct: 0, TRB_pct: 16.5, AST_pct: 31.1, STL_pct: 4.7, BLK_pct: 0, TOV_pct: 48.8, USG_pct: 32, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.192 },
    },
  },
  'gessiki01w': {
    id: 'gessiki01w',
    name: 'Kim Gessig',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 26, G: 1, MP: 4, MP_pct: 0.003, PER: -19.6, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 15.1, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 100, USG_pct: 11.1, OWS: 0, DWS: 0, WS: 0, WS40: -0.305 },
    },
  },
  'gibsoke01w': {
    id: 'gibsoke01w',
    name: 'Kelley Gibson',
    position: 'F-G',
    retired: true,
    seasons: {
      2000: { team: 'HOU', age: 23, G: 17, MP: 76, MP_pct: 0.059, PER: 11, TS_pct: 0.533, ThrPAr: 0.368, FTr: 0.421, ORB_pct: 7.7, TRB_pct: 10.8, AST_pct: 4.4, STL_pct: 0.8, BLK_pct: 0, TOV_pct: 15.1, USG_pct: 17.3, OWS: 0.2, DWS: 0.1, WS: 0.3, WS40: 0.147 },
      2001: { team: 'HOU', age: 24, G: 28, MP: 288, MP_pct: 0.223, PER: 4.4, TS_pct: 0.33, ThrPAr: 0.368, FTr: 0.386, ORB_pct: 2.6, TRB_pct: 6.4, AST_pct: 8.5, STL_pct: 1.7, BLK_pct: 1.9, TOV_pct: 18.4, USG_pct: 14.2, OWS: -0.5, DWS: 0.3, WS: -0.2, WS40: -0.029 },
    },
  },
  'gilloje01w': {
    id: 'gilloje01w',
    name: 'Jennifer Gillom',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 33, G: 28, MP: 874, MP_pct: 0.77, PER: 19.3, TS_pct: 0.513, ThrPAr: 0.173, FTr: 0.322, ORB_pct: 6, TRB_pct: 10.6, AST_pct: 6.1, STL_pct: 2.3, BLK_pct: 1.5, TOV_pct: 11.9, USG_pct: 25.1, OWS: 2.7, DWS: 1.8, WS: 4.5, WS40: 0.204, MIN_pg: 31.2, PTS_pg: 15.7, REB_pg: 5.4, AST_pg: 0.8, STL_pg: 1.3, BLK_pg: 0.5, FG_pct: 0.434, FG3_pct: 0.308, FT_pct: 0.777 },
      1998: { team: 'PHO', age: 34, G: 30, MP: 962, MP_pct: 0.792, PER: 25.6, TS_pct: 0.54, ThrPAr: 0.167, FTr: 0.396, ORB_pct: 8.1, TRB_pct: 14.7, AST_pct: 10.6, STL_pct: 2.8, BLK_pct: 0.8, TOV_pct: 13.3, USG_pct: 31.8, OWS: 3.7, DWS: 2.3, WS: 6, WS40: 0.249, MIN_pg: 32.1, PTS_pg: 20.8, REB_pg: 7.3, AST_pg: 1.4, STL_pg: 1.7, BLK_pg: 0.3, FG_pct: 0.463, FG3_pct: 0.378, FT_pct: 0.703 },
      1999: { team: 'PHO', age: 35, G: 32, MP: 1095, MP_pct: 0.855, PER: 15.4, TS_pct: 0.479, ThrPAr: 0.168, FTr: 0.414, ORB_pct: 6.1, TRB_pct: 10.7, AST_pct: 11, STL_pct: 1.9, BLK_pct: 0.5, TOV_pct: 14.7, USG_pct: 25.9, OWS: 1.4, DWS: 1.2, WS: 2.6, WS40: 0.094, MIN_pg: 34.2, PTS_pg: 15.2, REB_pg: 5.8, AST_pg: 1.7, STL_pg: 1.2, BLK_pg: 0.2, FG_pct: 0.381, FG3_pct: 0.250, FT_pct: 0.797 },
      2000: { team: 'PHO', age: 36, G: 30, MP: 826, MP_pct: 0.643, PER: 18.2, TS_pct: 0.518, ThrPAr: 0.218, FTr: 0.335, ORB_pct: 5.3, TRB_pct: 9.7, AST_pct: 11.9, STL_pct: 1.5, BLK_pct: 3.2, TOV_pct: 14, USG_pct: 26, OWS: 1.6, DWS: 1.1, WS: 2.7, WS40: 0.133, MIN_pg: 27.5, PTS_pg: 12.5, REB_pg: 3.9, AST_pg: 1.5, STL_pg: 0.7, BLK_pg: 1.0, FG_pct: 0.440, FG3_pct: 0.275, FT_pct: 0.745 },
      2001: { team: 'PHO', age: 37, G: 32, MP: 858, MP_pct: 0.665, PER: 16, TS_pct: 0.497, ThrPAr: 0.197, FTr: 0.27, ORB_pct: 5.4, TRB_pct: 9.7, AST_pct: 9.7, STL_pct: 2.1, BLK_pct: 1.9, TOV_pct: 15.2, USG_pct: 26.4, OWS: 0.8, DWS: 0.8, WS: 1.6, WS40: 0.073, MIN_pg: 26.8, PTS_pg: 12.3, REB_pg: 4.0, AST_pg: 1.1, STL_pg: 1.0, BLK_pg: 0.6, FG_pct: 0.423, FG3_pct: 0.343, FT_pct: 0.740 },
      2002: { team: 'PHO', age: 38, G: 31, MIN_pg: 28.2, PTS_pg: 15.3, REB_pg: 3.7, AST_pg: 1.2, STL_pg: 0.9, BLK_pg: 0.7, FG_pct: 0.415, FG3_pct: 0.387, FT_pct: 0.802 },
      2003: { team: 'LAS', age: 39, G: 33, MIN_pg: 12.0, PTS_pg: 3.1, REB_pg: 1.7, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.1, FG_pct: 0.412, FG3_pct: 0.269, FT_pct: 0.762 },
    },
  },
  'gilmous01w': {
    id: 'gilmous01w',
    name: 'Usha Gilmore',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 21, G: 4, MP: 21, MP_pct: 0.016, PER: -8.2, TS_pct: 0.2, ThrPAr: 0.2, FTr: 0, ORB_pct: 20, TRB_pct: 16.2, AST_pct: 16.7, STL_pct: 0, BLK_pct: 0, TOV_pct: 44.4, USG_pct: 21.1, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.318 },
    },
  },
  'goodsad01w': {
    id: 'goodsad01w',
    name: 'Adrienne Goodson',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 32, G: 32, MP: 1068, MP_pct: 0.822, PER: 15.6, TS_pct: 0.492, ThrPAr: 0.124, FTr: 0.302, ORB_pct: 8.6, TRB_pct: 8.3, AST_pct: 17, STL_pct: 1.4, BLK_pct: 0.7, TOV_pct: 16.8, USG_pct: 25, OWS: 1.6, DWS: -0.5, WS: 1.1, WS40: 0.043, MIN_pg: 33.4, PTS_pg: 14.9, REB_pg: 4.3, AST_pg: 2.7, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 3.1, FG_pct: 0.426, FG3_pct: 0.245, FT_pct: 0.767 },
      2000: { team: 'UTA', age: 33, G: 29, MP: 929, MP_pct: 0.726, PER: 21.7, TS_pct: 0.525, ThrPAr: 0.07, FTr: 0.323, ORB_pct: 10, TRB_pct: 11.3, AST_pct: 16.3, STL_pct: 2.4, BLK_pct: 0.6, TOV_pct: 14.6, USG_pct: 27.4, OWS: 2.7, DWS: 0.4, WS: 3.2, WS40: 0.136, MIN_pg: 32, PTS_pg: 17.2, REB_pg: 5.7, AST_pg: 2.4, STL_pg: 1.4, BLK_pg: 0.2, TOV_pg: 2.8, FG_pct: 0.480, FG3_pct: 0.276, FT_pct: 0.687 },
      2001: { team: 'UTA', age: 34, G: 28, MP: 854, MP_pct: 0.659, PER: 15.7, TS_pct: 0.479, ThrPAr: 0.097, FTr: 0.279, ORB_pct: 10.8, TRB_pct: 11.3, AST_pct: 14.6, STL_pct: 1.8, BLK_pct: 0, TOV_pct: 17.3, USG_pct: 24.9, OWS: 0.9, DWS: 0.4, WS: 1.3, WS40: 0.063, MIN_pg: 30.5, PTS_pg: 12.3, REB_pg: 5.4, AST_pg: 2.1, STL_pg: 1, BLK_pg: 0, TOV_pg: 2.7, FG_pct: 0.433, FG3_pct: 0.161, FT_pct: 0.697 },
      2002: { G: 32, MIN_pg: 34.4, PTS_pg: 15.7, REB_pg: 5.7, AST_pg: 2.1, STL_pg: 1.4, BLK_pg: 0.2, TOV_pg: 3.2, FG_pct: 0.451, FG3_pct: 0.286, FT_pct: 0.745 },
      2003: { G: 33, MIN_pg: 29.4, PTS_pg: 11.2, REB_pg: 5.6, AST_pg: 2.2, STL_pg: 0.7, BLK_pg: 0.2, TOV_pg: 2.6, FG_pct: 0.395, FG3_pct: 0.222, FT_pct: 0.794 },
      2004: { G: 34, MIN_pg: 31.4, PTS_pg: 10.9, REB_pg: 6.9, AST_pg: 1.8, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.448, FG3_pct: 0.250, FT_pct: 0.824 },
      2005: { G: 33, MIN_pg: 13.9, PTS_pg: 4.8, REB_pg: 2.3, AST_pg: 0.7, STL_pg: 0.3, BLK_pg: 0.05, TOV_pg: 1.2, FG_pct: 0.413, FG3_pct: 0.600, FT_pct: 0.610 },
    },
  },
  'gordobr01w': {
    id: 'gordobr01w',
    name: 'Bridgette Gordon',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 30, G: 28, MP: 981, MP_pct: 0.868, PER: 16.9, TS_pct: 0.508, ThrPAr: 0.128, FTr: 0.343, ORB_pct: 8.3, TRB_pct: 8.7, AST_pct: 16.4, STL_pct: 2.1, BLK_pct: 0.7, TOV_pct: 18.8, USG_pct: 20.1, OWS: 2.5, DWS: -0.5, WS: 1.9, WS40: 0.079, MIN_pg: 35, PTS_pg: 13, REB_pg: 4.8, AST_pg: 2.8, STL_pg: 1.4, BLK_pg: 0.3, TOV_pg: 3, FG_pct: 0.433, FG3_pct: 0.275, FT_pct: 0.785 },
      1998: { team: 'SAC', age: 31, G: 22, MP: 253, MP_pct: 0.21, PER: 2.6, TS_pct: 0.407, ThrPAr: 0.127, FTr: 0.254, ORB_pct: 5.4, TRB_pct: 7.5, AST_pct: 6.9, STL_pct: 1.8, BLK_pct: 0, TOV_pct: 30, USG_pct: 18.5, OWS: -0.8, DWS: 0.1, WS: -0.7, WS40: -0.115, MIN_pg: 11.5, PTS_pg: 2.7, REB_pg: 1.3, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.391, FG3_pct: 0.000, FT_pct: 0.563 },
    },
  },
  'grahama01w': {
    id: 'grahama01w',
    name: 'Margo Graham',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 27, G: 10, MP: 49, MP_pct: 0.041, PER: 6.4, TS_pct: 0.439, ThrPAr: 0, FTr: 0.316, ORB_pct: 19, TRB_pct: 16.3, AST_pct: 4.7, STL_pct: 1.1, BLK_pct: 1.6, TOV_pct: 27, USG_pct: 26.8, OWS: -0.1, DWS: 0, WS: -0.2, WS40: -0.136 },
    },
  },
  'gravede01w': {
    id: 'gravede01w',
    name: 'Denique Graves',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 21, G: 22, MP: 86, MP_pct: 0.076, PER: -5.1, TS_pct: 0.262, ThrPAr: 0, FTr: 0.296, ORB_pct: 4.2, TRB_pct: 11, AST_pct: 0, STL_pct: 0, BLK_pct: 5.5, TOV_pct: 28.2, USG_pct: 22.1, OWS: -0.6, DWS: 0, WS: -0.6, WS40: -0.287 },
    },
  },
  'grginve01w': {
    id: 'grginve01w',
    name: 'Vedrana Grgin-Fonseca',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'LAS', age: 25, G: 18, MP: 183, MP_pct: 0.142, PER: 4, TS_pct: 0.34, ThrPAr: 0.274, FTr: 0.371, ORB_pct: 6.4, TRB_pct: 7.8, AST_pct: 11.4, STL_pct: 0.9, BLK_pct: 0.5, TOV_pct: 16.3, USG_pct: 22.3, OWS: -0.5, DWS: 0.2, WS: -0.3, WS40: -0.061 },
      2001: { team: 'LAS', age: 26, G: 24, MP: 223, MP_pct: 0.172, PER: 11.8, TS_pct: 0.499, ThrPAr: 0.292, FTr: 0.215, ORB_pct: 7.7, TRB_pct: 10, AST_pct: 9.2, STL_pct: 1, BLK_pct: 0.4, TOV_pct: 17.4, USG_pct: 18.3, OWS: 0.3, DWS: 0.1, WS: 0.4, WS40: 0.075 },
    },
  },
  'griffyo01w': {
    id: 'griffyo01w',
    name: 'Yolanda Griffith',
    position: 'C-F',
    retired: true,
    seasons: {
      1999: { team: 'SAC', age: 29, G: 29, MP: 979, MP_pct: 0.765, PER: 31.9, TS_pct: 0.576, ThrPAr: 0.003, FTr: 0.635, ORB_pct: 17.1, TRB_pct: 20.6, AST_pct: 10, STL_pct: 4, BLK_pct: 4.7, TOV_pct: 12.2, USG_pct: 24.4, OWS: 5.3, DWS: 2.8, WS: 8.1, WS40: 0.33, MIN_pg: 33.8, PTS_pg: 18.8, REB_pg: 11.3, AST_pg: 1.6, STL_pg: 2.5, BLK_pg: 1.9, FG_pct: 0.541, FG3_pct: 0.000, FT_pct: 0.617 },
      2000: { team: 'SAC', age: 30, G: 32, MP: 1026, MP_pct: 0.802, PER: 30.3, TS_pct: 0.586, ThrPAr: 0, FTr: 0.537, ORB_pct: 18.1, TRB_pct: 20.8, AST_pct: 9.2, STL_pct: 4.6, BLK_pct: 5.1, TOV_pct: 15.5, USG_pct: 24.1, OWS: 4.8, DWS: 3, WS: 7.8, WS40: 0.304, MIN_pg: 32.1, PTS_pg: 16.3, REB_pg: 10.3, AST_pg: 1.5, STL_pg: 2.6, BLK_pg: 1.9, FG_pct: 0.535, FG3_pct: 0.000, FT_pct: 0.706 },
      2001: { team: 'SAC', age: 31, G: 32, MP: 1077, MP_pct: 0.825, PER: 28.4, TS_pct: 0.576, ThrPAr: 0, FTr: 0.505, ORB_pct: 18.9, TRB_pct: 20.6, AST_pct: 10.8, STL_pct: 3.3, BLK_pct: 2.8, TOV_pct: 14.3, USG_pct: 23.2, OWS: 5.7, DWS: 2.7, WS: 8.4, WS40: 0.311, MIN_pg: 33.7, PTS_pg: 16.2, REB_pg: 11.2, AST_pg: 1.7, STL_pg: 2.0, BLK_pg: 1.2, FG_pct: 0.522, FG3_pct: 0.000, FT_pct: 0.720 },
      2002: { team: 'SAC', age: 32, G: 17, MIN_pg: 33.9, PTS_pg: 16.9, REB_pg: 8.7, AST_pg: 1.1, STL_pg: 0.9, BLK_pg: 0.8, FG_pct: 0.520, FG3_pct: 0.000, FT_pct: 0.803 },
      2003: { team: 'SAC', age: 33, G: 34, MIN_pg: 29.9, PTS_pg: 13.8, REB_pg: 7.3, AST_pg: 1.4, STL_pg: 1.7, BLK_pg: 1.1, FG_pct: 0.485, FG3_pct: 0.000, FT_pct: 0.774 },
      2004: { team: 'SAC', age: 34, G: 34, MIN_pg: 30.3, PTS_pg: 14.5, REB_pg: 7.2, AST_pg: 1.2, STL_pg: 2.2, BLK_pg: 1.2, FG_pct: 0.519, FG3_pct: 0.000, FT_pct: 0.853 },
      2005: { team: 'SAC', age: 35, G: 34, MIN_pg: 28.3, PTS_pg: 13.8, REB_pg: 6.6, AST_pg: 1.5, STL_pg: 1.2, BLK_pg: 0.9, FG_pct: 0.485, FG3_pct: 0.000, FT_pct: 0.707 },
      2006: { team: 'SAC', age: 36, G: 34, MIN_pg: 25.1, PTS_pg: 12.0, REB_pg: 6.4, AST_pg: 1.6, STL_pg: 1.3, BLK_pg: 0.5, FG_pct: 0.457, FG3_pct: 0.000, FT_pct: 0.751 },
      2007: { team: 'SAC', age: 37, G: 32, MIN_pg: 23.1, PTS_pg: 9.0,  REB_pg: 4.6, AST_pg: 1.5, STL_pg: 1.0, BLK_pg: 0.4, FG_pct: 0.502, FG3_pct: 0.000, FT_pct: 0.658 },
      2008: { team: 'SEA', age: 38, G: 30, MIN_pg: 21.9, PTS_pg: 7.2,  REB_pg: 6.3, AST_pg: 1.5, STL_pg: 1.4, BLK_pg: 0.6, FG_pct: 0.462, FG3_pct: 0.000, FT_pct: 0.648 },
      2009: { team: 'IND', age: 39, G: 3,  MIN_pg: 13.7, PTS_pg: 6.3,  REB_pg: 2.3, AST_pg: 0.0, STL_pg: 0.0, BLK_pg: 0.7, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.778 },
    },
  },
  'groomla01w': {
    id: 'groomla01w',
    name: 'Lady Grooms',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 26, G: 28, MP: 691, MP_pct: 0.612, PER: 6.9, TS_pct: 0.4, ThrPAr: 0.06, FTr: 0.329, ORB_pct: 5.3, TRB_pct: 7, AST_pct: 19.2, STL_pct: 1.8, BLK_pct: 0.2, TOV_pct: 29.2, USG_pct: 17.4, OWS: -1.3, DWS: -0.4, WS: -1.8, WS40: -0.102, MIN_pg: 24.7, PTS_pg: 5.5, REB_pg: 3, AST_pg: 2.4, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2.8, FG_pct: 0.347, FG3_pct: 0.100, FT_pct: 0.655 },
      1998: { team: 'SAC', age: 27, G: 30, MP: 792, MP_pct: 0.657, PER: 12.2, TS_pct: 0.548, ThrPAr: 0.039, FTr: 0.61, ORB_pct: 5.8, TRB_pct: 6.4, AST_pct: 11.8, STL_pct: 1.4, BLK_pct: 0.3, TOV_pct: 21, USG_pct: 14.6, OWS: 1.2, DWS: 0.1, WS: 1.3, WS40: 0.064, MIN_pg: 26.4, PTS_pg: 7.1, REB_pg: 2.7, AST_pg: 1.6, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.487, FG3_pct: 0.167, FT_pct: 0.670 },
      1999: { team: 'SAC', age: 28, G: 32, MP: 450, MP_pct: 0.352, PER: 9.6, TS_pct: 0.491, ThrPAr: 0.028, FTr: 0.875, ORB_pct: 6.1, TRB_pct: 7.4, AST_pct: 14.4, STL_pct: 1.3, BLK_pct: 0.4, TOV_pct: 26.5, USG_pct: 13.4, OWS: 0.2, DWS: 0.3, WS: 0.5, WS40: 0.046, MIN_pg: 14.1, PTS_pg: 3.1, REB_pg: 1.7, AST_pg: 1.2, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.357, FG3_pct: 0.000, FT_pct: 0.698 },
      2000: { team: 'SAC', age: 29, G: 30, MP: 401, MP_pct: 0.313, PER: 12.8, TS_pct: 0.54, ThrPAr: 0.011, FTr: 0.693, ORB_pct: 8.5, TRB_pct: 7.1, AST_pct: 5.5, STL_pct: 1.4, BLK_pct: 0.6, TOV_pct: 15.5, USG_pct: 15.8, OWS: 0.9, DWS: 0.2, WS: 1.1, WS40: 0.108, MIN_pg: 13.4, PTS_pg: 4.1, REB_pg: 1.5, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.443, FG3_pct: 0.000, FT_pct: 0.754 },
      2001: { team: 'SAC', age: 30, G: 31, MP: 543, MP_pct: 0.416, PER: 13.6, TS_pct: 0.505, ThrPAr: 0, FTr: 0.509, ORB_pct: 7.4, TRB_pct: 8.9, AST_pct: 12.7, STL_pct: 1.6, BLK_pct: 1.5, TOV_pct: 15.2, USG_pct: 14.4, OWS: 1.2, DWS: 0.5, WS: 1.8, WS40: 0.13, MIN_pg: 17.5, PTS_pg: 4.5, REB_pg: 2.5, AST_pg: 1.2, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 0.8, FG_pct: 0.430, FT_pct: 0.741 },
      2002: { G: 32, MIN_pg: 26.6, PTS_pg: 7.1, REB_pg: 3.1, AST_pg: 1.2, STL_pg: 0.7, BLK_pg: 0.3, TOV_pg: 1.4, FG_pct: 0.431, FG3_pct: 0.000, FT_pct: 0.855 },
      2003: { G: 34, MIN_pg: 13.8, PTS_pg: 3.3, REB_pg: 1.4, AST_pg: 0.9, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.402, FG3_pct: 0.000, FT_pct: 0.808 },
      2004: { G: 28, MIN_pg: 8.4, PTS_pg: 1.8, REB_pg: 0.6, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.1, FG_pct: 0.288, FT_pct: 0.917 },
    },
  },
  'grubigo01w': {
    id: 'grubigo01w',
    name: 'Gordana Grubin',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 26, G: 32, MP: 708, MP_pct: 0.547, PER: 16.8, TS_pct: 0.53, ThrPAr: 0.391, FTr: 0.286, ORB_pct: 3.2, TRB_pct: 6.3, AST_pct: 23, STL_pct: 1.8, BLK_pct: 0.2, TOV_pct: 16.5, USG_pct: 20.8, OWS: 1.8, DWS: 0.5, WS: 2.3, WS40: 0.131 },
      2000: { team: 'IND', age: 27, G: 29, MP: 720, MP_pct: 0.56, PER: 11.9, TS_pct: 0.466, ThrPAr: 0.381, FTr: 0.167, ORB_pct: 3.9, TRB_pct: 7.2, AST_pct: 17.7, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 19, USG_pct: 21.7, OWS: 0, DWS: 0.2, WS: 0.2, WS40: 0.009 },
      2001: { team: 'IND', age: 28, G: 27, MP: 481, MP_pct: 0.371, PER: 11.7, TS_pct: 0.462, ThrPAr: 0.347, FTr: 0.234, ORB_pct: 5.1, TRB_pct: 6.9, AST_pct: 14.9, STL_pct: 0.8, BLK_pct: 0, TOV_pct: 15.6, USG_pct: 22.8, OWS: 0.3, DWS: -0.3, WS: 0, WS40: 0.004 },
    },
  },
  'guytowa01w': {
    id: 'guytowa01w',
    name: 'Wanda Guyton',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 28, G: 25, MP: 668, MP_pct: 0.591, PER: 11.4, TS_pct: 0.5, ThrPAr: 0, FTr: 0.557, ORB_pct: 14.7, TRB_pct: 13.4, AST_pct: 3.4, STL_pct: 2.2, BLK_pct: 1, TOV_pct: 22.1, USG_pct: 13.7, OWS: 0.9, DWS: 0.7, WS: 1.7, WS40: 0.099, MIN_pg: 26.7, PTS_pg: 6.1, REB_pg: 5.4, AST_pg: 0.5, STL_pg: 1, BLK_pg: 0.3, TOV_pg: 1.7, FG_pct: 0.467, FT_pct: 0.559 },
      1998: { team: 'HOU', age: 29, G: 1, MP: 14, MP_pct: 0.012, PER: -10.3, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 4, BLK_pct: 6.1, TOV_pct: 66.7, USG_pct: 10.2, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.216, MIN_pg: 14, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 1, BLK_pg: 1, TOV_pg: 2, FG_pct: 0.000 },
      1999: { team: 'DET', age: 30, G: 11, MP: 98, MP_pct: 0.075, PER: 5.2, TS_pct: 0.437, ThrPAr: 0, FTr: 0.941, ORB_pct: 9.7, TRB_pct: 16.8, AST_pct: 3.6, STL_pct: 1.1, BLK_pct: 1.7, TOV_pct: 29.4, USG_pct: 16.2, OWS: -0.2, DWS: 0.2, WS: 0, WS40: 0.001, MIN_pg: 8.9, PTS_pg: 1.9, REB_pg: 2.4, AST_pg: 0.2, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.235, FT_pct: 0.813 },
    },
  },
  'hagiwmi01w': {
    id: 'hagiwmi01w',
    name: 'Mikiko Hagiwara',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 27, G: 14, MP: 174, MP_pct: 0.154, PER: 7.7, TS_pct: 0.433, ThrPAr: 0.702, FTr: 0.128, ORB_pct: 1.4, TRB_pct: 3.3, AST_pct: 10.7, STL_pct: 0.6, BLK_pct: 0.9, TOV_pct: 15.3, USG_pct: 15.1, OWS: 0.1, DWS: -0.2, WS: -0.1, WS40: -0.028, MIN_pg: 12.4, PTS_pg: 3.1, REB_pg: 0.6, AST_pg: 0.7, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.319, FG3_pct: 0.273, FT_pct: 0.667 },
      1998: { team: 'PHO', age: 28, G: 10, MP: 59, MP_pct: 0.049, PER: 7.4, TS_pct: 0.493, ThrPAr: 0.571, FTr: 0.143, ORB_pct: 0, TRB_pct: 2.2, AST_pct: 9.9, STL_pct: 0, BLK_pct: 0, TOV_pct: 18.3, USG_pct: 21.2, OWS: 0, DWS: 0, WS: 0, WS40: 0.014, MIN_pg: 5.9, PTS_pg: 2.2, REB_pg: 0.2, AST_pg: 0.3, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.381, FG3_pct: 0.333, FT_pct: 0.667 },
    },
  },
  'hallvi01w': {
    id: 'hallvi01w',
    name: 'Vicki Hall',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'CLE', age: 30, G: 32, MP: 577, MP_pct: 0.444, PER: 10, TS_pct: 0.434, ThrPAr: 0.266, FTr: 0.215, ORB_pct: 5.8, TRB_pct: 11.5, AST_pct: 8, STL_pct: 1.7, BLK_pct: 1.3, TOV_pct: 12.6, USG_pct: 17, OWS: 0.2, DWS: 0.9, WS: 1, WS40: 0.072 },
      2001: { team: 'IND', age: 31, G: 13, MP: 123, MP_pct: 0.095, PER: 10.1, TS_pct: 0.448, ThrPAr: 0.088, FTr: 0.412, ORB_pct: 5.6, TRB_pct: 8.9, AST_pct: 6.9, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 14.8, USG_pct: 19.3, OWS: 0, DWS: 0, WS: 0, WS40: -0.001 },
    },
  },
  'hamblan01w': {
    id: 'hamblan01w',
    name: 'Angie Hamblin',
    position: 'G-F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 21, G: 6, MP: 29, MP_pct: 0.024, PER: -3.3, TS_pct: 0.338, ThrPAr: 0.25, FTr: 0.25, ORB_pct: 8.2, TRB_pct: 14.3, AST_pct: 12, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 44.1, USG_pct: 24.8, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.259 },
    },
  },
  'hammobe01w': {
    id: 'hammobe01w',
    name: 'Becky Hammon',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'NYL', age: 22, G: 30, MP: 202, MP_pct: 0.155, PER: 12, TS_pct: 0.56, ThrPAr: 0.594, FTr: 0.266, ORB_pct: 1.3, TRB_pct: 6.4, AST_pct: 17.6, STL_pct: 1.7, BLK_pct: 0, TOV_pct: 25.1, USG_pct: 23.5, OWS: 0.1, DWS: 0.3, WS: 0.3, WS40: 0.069, MIN_pg: 6.7, PTS_pg: 2.7, REB_pg: 0.6, AST_pg: 0.6, STL_pg: 0.2, BLK_pg: 0.0, FG_pct: 0.422, FG3_pct: 0.289, FT_pct: 0.882 },
      2000: { team: 'NYL', age: 23, G: 32, MP: 835, MP_pct: 0.65, PER: 18.4, TS_pct: 0.622, ThrPAr: 0.56, FTr: 0.274, ORB_pct: 3.1, TRB_pct: 5.2, AST_pct: 14.7, STL_pct: 2.1, BLK_pct: 0.1, TOV_pct: 18, USG_pct: 20.9, OWS: 2.7, DWS: 1, WS: 3.7, WS40: 0.179, MIN_pg: 26.1, PTS_pg: 12.0, REB_pg: 2.0, AST_pg: 1.8, STL_pg: 0.9, BLK_pg: 0.0, FG_pct: 0.472, FG3_pct: 0.369, FT_pct: 0.884 },
      2001: { team: 'NYL', age: 24, G: 32, MP: 619, MP_pct: 0.484, PER: 18.8, TS_pct: 0.597, ThrPAr: 0.563, FTr: 0.259, ORB_pct: 2.2, TRB_pct: 5.7, AST_pct: 16.3, STL_pct: 2.6, BLK_pct: 0.2, TOV_pct: 17.9, USG_pct: 22.3, OWS: 1.8, DWS: 0.5, WS: 2.3, WS40: 0.148, MIN_pg: 19.3, PTS_pg: 8.2, REB_pg: 1.6, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 0.0, FG_pct: 0.457, FG3_pct: 0.378, FT_pct: 0.784 },
      2002: { team: 'NYL', age: 25, G: 32, MIN_pg: 20.6, PTS_pg: 8.0, REB_pg: 2.1, AST_pg: 1.7, STL_pg: 0.8, BLK_pg: 0.0, FG_pct: 0.442, FG3_pct: 0.386, FT_pct: 0.679 },
      2003: { team: 'NYL', age: 26, G: 11, MIN_pg: 23.4, PTS_pg: 14.7, REB_pg: 1.9, AST_pg: 1.6, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.575, FG3_pct: 0.469, FT_pct: 0.951 },
      2004: { team: 'NYL', age: 27, G: 34, MIN_pg: 33.2, PTS_pg: 13.5, REB_pg: 3.5, AST_pg: 4.4, STL_pg: 1.7, BLK_pg: 0.1, FG_pct: 0.432, FG3_pct: 0.335, FT_pct: 0.836 },
      2005: { team: 'NYL', age: 28, G: 34, MIN_pg: 34.7, PTS_pg: 13.9, REB_pg: 3.4, AST_pg: 4.3, STL_pg: 1.8, BLK_pg: 0.1, FG_pct: 0.432, FG3_pct: 0.365, FT_pct: 0.901 },
      2006: { team: 'NYL', age: 29, G: 22, MIN_pg: 30.8, PTS_pg: 14.7, REB_pg: 3.0, AST_pg: 3.7, STL_pg: 1.3, BLK_pg: 0.1, FG_pct: 0.425, FG3_pct: 0.343, FT_pct: 0.960 },
      2007: { team: 'SAN', age: 30, G: 28, MIN_pg: 33.4, PTS_pg: 18.8, REB_pg: 2.8, AST_pg: 5.0, STL_pg: 0.8, BLK_pg: 0.2, FG_pct: 0.445, FG3_pct: 0.404, FT_pct: 0.931 },
      2008: { team: 'SAN', age: 31, G: 33, MIN_pg: 33.4, PTS_pg: 17.6, REB_pg: 2.8, AST_pg: 4.9, STL_pg: 1.3, BLK_pg: 0.2, FG_pct: 0.390, FG3_pct: 0.350, FT_pct: 0.937 },
      2009: { team: 'SAN', age: 32, G: 31, MIN_pg: 33.8, PTS_pg: 19.5, REB_pg: 3.3, AST_pg: 5.0, STL_pg: 1.6, BLK_pg: 0.4, FG_pct: 0.447, FG3_pct: 0.369, FT_pct: 0.901 },
      2010: { team: 'SAN', age: 33, G: 32, MIN_pg: 33.6, PTS_pg: 15.1, REB_pg: 2.9, AST_pg: 5.4, STL_pg: 1.1, BLK_pg: 0.2, FG_pct: 0.442, FG3_pct: 0.390, FT_pct: 0.960 },
      2011: { team: 'SAN', age: 34, G: 33, MIN_pg: 31.8, PTS_pg: 15.9, REB_pg: 2.9, AST_pg: 5.8, STL_pg: 1.5, BLK_pg: 0.2, FG_pct: 0.440, FG3_pct: 0.389, FT_pct: 0.892 },
      2012: { team: 'SAN', age: 35, G: 33, MIN_pg: 30.2, PTS_pg: 14.7, REB_pg: 2.5, AST_pg: 5.3, STL_pg: 0.9, BLK_pg: 0.2, FG_pct: 0.441, FG3_pct: 0.435, FT_pct: 0.876 },
      2014: { team: 'SAN', age: 37, G: 32, MIN_pg: 24.5, PTS_pg: 9.1, REB_pg: 1.4, AST_pg: 4.2, STL_pg: 0.4, BLK_pg: 0.1, FG_pct: 0.417, FG3_pct: 0.398, FT_pct: 1.000 },
    },
  },
  'hamptky01w': {
    id: 'hamptky01w',
    name: 'Kym Hampton',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 34, G: 28, MP: 663, MP_pct: 0.584, PER: 20.7, TS_pct: 0.521, ThrPAr: 0.005, FTr: 0.543, ORB_pct: 9.6, TRB_pct: 15.1, AST_pct: 12.1, STL_pct: 3.2, BLK_pct: 2.4, TOV_pct: 15.8, USG_pct: 21, OWS: 1.8, DWS: 1.8, WS: 3.6, WS40: 0.219, MIN_pg: 23.7, PTS_pg: 9.8, REB_pg: 5.8, AST_pg: 1.4, STL_pg: 1.4, BLK_pg: 0.7, TOV_pg: 1.8, FG_pct: 0.474, FG3_pct: 0.000, FT_pct: 0.640 },
      1998: { team: 'NYL', age: 35, G: 30, MP: 745, MP_pct: 0.616, PER: 16.1, TS_pct: 0.517, ThrPAr: 0.005, FTr: 0.502, ORB_pct: 9.2, TRB_pct: 16, AST_pct: 7.1, STL_pct: 2.5, BLK_pct: 1.8, TOV_pct: 19, USG_pct: 20.7, OWS: 1.1, DWS: 1.7, WS: 2.8, WS40: 0.149, MIN_pg: 24.8, PTS_pg: 9.1, REB_pg: 6, AST_pg: 0.9, STL_pg: 1.1, BLK_pg: 0.5, TOV_pg: 2.1, FG_pct: 0.452, FG3_pct: 0.000, FT_pct: 0.716 },
      1999: { team: 'NYL', age: 36, G: 32, MP: 856, MP_pct: 0.656, PER: 14.1, TS_pct: 0.488, ThrPAr: 0.008, FTr: 0.35, ORB_pct: 9.3, TRB_pct: 14.2, AST_pct: 5.3, STL_pct: 1.5, BLK_pct: 2, TOV_pct: 14.5, USG_pct: 20.4, OWS: 1, DWS: 1.5, WS: 2.5, WS40: 0.118, MIN_pg: 26.8, PTS_pg: 9.2, REB_pg: 5.6, AST_pg: 0.7, STL_pg: 0.7, BLK_pg: 0.6, TOV_pg: 1.6, FG_pct: 0.431, FG3_pct: 0.500, FT_pct: 0.747 },
    },
  },
  'hamzoro01w': {
    id: 'hamzoro01w',
    name: 'Romana Hamzova',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 29, G: 15, MP: 43, MP_pct: 0.033, PER: 5.3, TS_pct: 0.257, ThrPAr: 0.273, FTr: 0.545, ORB_pct: 3.1, TRB_pct: 4.7, AST_pct: 19.6, STL_pct: 6.8, BLK_pct: 0, TOV_pct: 22.7, USG_pct: 20.2, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.12 },
    },
  },
  'harrido01w': {
    id: 'harrido01w',
    name: 'Donna Harrington',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 33, G: 8, MP: 67, MP_pct: 0.052, PER: -2.8, TS_pct: 0.385, ThrPAr: 0, FTr: 1.667, ORB_pct: 8.4, TRB_pct: 9.2, AST_pct: 12.3, STL_pct: 1.7, BLK_pct: 1.3, TOV_pct: 51.4, USG_pct: 15.7, OWS: -0.3, DWS: 0, WS: -0.3, WS40: -0.182 },
    },
  },
  'harrifr01w': {
    id: 'harrifr01w',
    name: 'Fran Harris',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 32, G: 25, MP: 369, MP_pct: 0.327, PER: 11.9, TS_pct: 0.431, ThrPAr: 0.224, FTr: 0.29, ORB_pct: 5.6, TRB_pct: 10, AST_pct: 13, STL_pct: 2.6, BLK_pct: 0.7, TOV_pct: 19.4, USG_pct: 19, OWS: 0.2, DWS: 0.5, WS: 0.7, WS40: 0.072, MIN_pg: 14.8, PTS_pg: 4.2, REB_pg: 2.2, AST_pg: 1, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.346, FG3_pct: 0.333, FT_pct: 0.710 },
      1998: { team: 'UTA', age: 33, G: 18, MP: 353, MP_pct: 0.292, PER: 8.8, TS_pct: 0.421, ThrPAr: 0.203, FTr: 0.152, ORB_pct: 4.9, TRB_pct: 6.6, AST_pct: 15.1, STL_pct: 2, BLK_pct: 0.2, TOV_pct: 16.8, USG_pct: 13.1, OWS: 0.1, DWS: -0.1, WS: 0, WS40: 0.002, MIN_pg: 19.6, PTS_pg: 3.9, REB_pg: 2.2, AST_pg: 1.7, STL_pg: 0.7, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.354, FG3_pct: 0.313, FT_pct: 0.833 },
    },
  },
  'harrili01w': {
    id: 'harrili01w',
    name: 'Lisa Harrison',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 28, G: 32, MP: 828, MP_pct: 0.647, PER: 12.4, TS_pct: 0.51, ThrPAr: 0.053, FTr: 0.259, ORB_pct: 7.1, TRB_pct: 10, AST_pct: 12.6, STL_pct: 1.6, BLK_pct: 0.5, TOV_pct: 15.6, USG_pct: 13, OWS: 1.2, DWS: 0.7, WS: 1.9, WS40: 0.094, MIN_pg: 20.8, PTS_pg: 4.5, REB_pg: 2, AST_pg: 3, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.4, FG_pct: 0.364, FG3_pct: 0.279, FT_pct: 0.808 },
      2000: { team: 'PHO', age: 29, G: 31, MP: 750, MP_pct: 0.584, PER: 16.2, TS_pct: 0.587, ThrPAr: 0.078, FTr: 0.24, ORB_pct: 7.2, TRB_pct: 11.1, AST_pct: 9.3, STL_pct: 2.4, BLK_pct: 0.5, TOV_pct: 11.4, USG_pct: 13.1, OWS: 2.2, DWS: 1.1, WS: 3.3, WS40: 0.178 },
      2001: { team: 'PHO', age: 30, G: 32, MP: 915, MP_pct: 0.709, PER: 12.9, TS_pct: 0.494, ThrPAr: 0.04, FTr: 0.265, ORB_pct: 5.5, TRB_pct: 9.9, AST_pct: 11.6, STL_pct: 2.4, BLK_pct: 0.1, TOV_pct: 16.4, USG_pct: 15.7, OWS: 1, DWS: 0.8, WS: 1.8, WS40: 0.079, MIN_pg: 18, PTS_pg: 5.3, REB_pg: 1, AST_pg: 2.8, STL_pg: 0.8, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.467, FG3_pct: 0.500, FT_pct: 1.000 },
      1998: { G: 30, MIN_pg: 11.8, PTS_pg: 2.3, REB_pg: 0.7, AST_pg: 1.7, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.365, FG3_pct: 0.344, FT_pct: 0.750 },
    },
  },
  'harrokr01w': {
    id: 'harrokr01w',
    name: 'Kristi Harrower',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'PHO', age: 23, G: 30, MP: 355, MP_pct: 0.292, PER: 10.3, TS_pct: 0.544, ThrPAr: 0.615, FTr: 0.538, ORB_pct: 0.7, TRB_pct: 3.8, AST_pct: 24.7, STL_pct: 2.3, BLK_pct: 0.7, TOV_pct: 32.5, USG_pct: 12.3, OWS: 0.3, DWS: 0.5, WS: 0.7, WS40: 0.083 },
      1999: { team: 'PHO', age: 24, G: 32, MP: 666, MP_pct: 0.52, PER: 13, TS_pct: 0.545, ThrPAr: 0.434, FTr: 0.737, ORB_pct: 1.7, TRB_pct: 6, AST_pct: 26.6, STL_pct: 2.1, BLK_pct: 0.5, TOV_pct: 25.6, USG_pct: 12.7, OWS: 1.1, DWS: 0.6, WS: 1.7, WS40: 0.1, MIN_pg: 21.2, PTS_pg: 4.9, REB_pg: 3.6, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 0.7, FG_pct: 0.479, FG3_pct: 0.143, FT_pct: 0.538 },
      2001: { team: 'MIN', age: 26, G: 4, MP: 72, MP_pct: 0.056, PER: 18.7, TS_pct: 0.626, ThrPAr: 0.4, FTr: 0.267, ORB_pct: 1.8, TRB_pct: 3.6, AST_pct: 36.3, STL_pct: 2.4, BLK_pct: 0, TOV_pct: 15.2, USG_pct: 13.5, OWS: 0.3, DWS: 0, WS: 0.4, WS40: 0.204 },
    },
  },
  'headde01w': {
    id: 'headde01w',
    name: 'Dena Head',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 26, G: 27, MP: 471, MP_pct: 0.417, PER: 11.2, TS_pct: 0.494, ThrPAr: 0.235, FTr: 0.331, ORB_pct: 5.2, TRB_pct: 7.7, AST_pct: 20.5, STL_pct: 1.6, BLK_pct: 1.3, TOV_pct: 28.1, USG_pct: 20.5, OWS: -0.1, DWS: -0.2, WS: -0.3, WS40: -0.027, MIN_pg: 17.4, PTS_pg: 5.7, REB_pg: 2.3, AST_pg: 1.7, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 2.3, FG_pct: 0.390, FG3_pct: 0.313, FT_pct: 0.844 },
      1998: { team: 'UTA', age: 27, G: 30, MP: 467, MP_pct: 0.386, PER: 10.4, TS_pct: 0.543, ThrPAr: 0.318, FTr: 0.388, ORB_pct: 3.7, TRB_pct: 6.7, AST_pct: 14, STL_pct: 3.4, BLK_pct: 0, TOV_pct: 30.7, USG_pct: 14, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.009, MIN_pg: 15.6, PTS_pg: 3.6, REB_pg: 1.7, AST_pg: 1.2, STL_pg: 1, BLK_pg: 0, TOV_pg: 1.5, FG_pct: 0.424, FG3_pct: 0.481, FT_pct: 0.697 },
      2000: { team: 'PHO', age: 29, G: 17, MP: 149, MP_pct: 0.116, PER: 7.7, TS_pct: 0.465, ThrPAr: 0.318, FTr: 0.727, ORB_pct: 4.7, TRB_pct: 8.3, AST_pct: 17.6, STL_pct: 1.6, BLK_pct: 0, TOV_pct: 27.5, USG_pct: 13.7, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.033, MIN_pg: 8.8, PTS_pg: 1.6, REB_pg: 1.1, AST_pg: 0.9, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.364, FG3_pct: 0.143, FT_pct: 0.625 },
    },
  },
  'hendene01w': {
    id: 'hendene01w',
    name: 'Nekeshia Henderson',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'HOU', age: 28, G: 23, MP: 179, MP_pct: 0.139, PER: 5.6, TS_pct: 0.316, ThrPAr: 0.579, FTr: 0.184, ORB_pct: 3.5, TRB_pct: 7.4, AST_pct: 23.2, STL_pct: 2, BLK_pct: 0, TOV_pct: 28, USG_pct: 15.9, OWS: -0.5, DWS: 0.2, WS: -0.3, WS40: -0.062 },
    },
  },
  'hendetr01w': {
    id: 'hendetr01w',
    name: 'Tracy Henderson',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 24, G: 27, MP: 308, MP_pct: 0.241, PER: 8.3, TS_pct: 0.356, ThrPAr: 0, FTr: 0.333, ORB_pct: 12.1, TRB_pct: 16.5, AST_pct: 5.7, STL_pct: 1.6, BLK_pct: 5.6, TOV_pct: 20, USG_pct: 19.6, OWS: -0.8, DWS: 0.5, WS: -0.3, WS40: -0.035, MIN_pg: 11.4, PTS_pg: 2.6, REB_pg: 2.9, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.7, TOV_pg: 0.9, FG_pct: 0.310, FG3_pct: 0.000, FT_pct: 0.586 },
    },
  },
  'henniso01w': {
    id: 'henniso01w',
    name: 'Sonja Henning',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'HOU', age: 29, G: 32, MP: 798, MP_pct: 0.621, PER: 11.1, TS_pct: 0.512, ThrPAr: 0.35, FTr: 0.154, ORB_pct: 3.8, TRB_pct: 6.6, AST_pct: 15.7, STL_pct: 2.4, BLK_pct: 0.7, TOV_pct: 18.8, USG_pct: 9.4, OWS: 1.2, DWS: 1.2, WS: 2.4, WS40: 0.12 },
      2000: { team: 'SEA', age: 30, G: 32, MP: 980, MP_pct: 0.757, PER: 10, TS_pct: 0.472, ThrPAr: 0.437, FTr: 0.404, ORB_pct: 3, TRB_pct: 6.3, AST_pct: 17.5, STL_pct: 3.7, BLK_pct: 0.3, TOV_pct: 23.3, USG_pct: 12.2, OWS: -0.2, DWS: 1.1, WS: 0.8, WS40: 0.035 },
      2001: { team: 'SEA', age: 31, G: 32, MP: 902, MP_pct: 0.689, PER: 8.6, TS_pct: 0.374, ThrPAr: 0.341, FTr: 0.271, ORB_pct: 1.9, TRB_pct: 5.3, AST_pct: 21.5, STL_pct: 3.5, BLK_pct: 0.6, TOV_pct: 22.9, USG_pct: 10.8, OWS: -0.6, DWS: 1, WS: 0.4, WS40: 0.016 },
    },
  },
  'herriam01w': {
    id: 'herriam01w',
    name: 'Amy Herrig',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 23, G: 25, MP: 341, MP_pct: 0.266, PER: 10.2, TS_pct: 0.513, ThrPAr: 0.013, FTr: 0.413, ORB_pct: 10.3, TRB_pct: 11.1, AST_pct: 10.4, STL_pct: 1.1, BLK_pct: 1.2, TOV_pct: 24.7, USG_pct: 15.8, OWS: 0.1, DWS: 0, WS: 0.2, WS40: 0.019 },
      2001: { team: 'UTA', age: 24, G: 32, MP: 448, MP_pct: 0.346, PER: 11.2, TS_pct: 0.534, ThrPAr: 0, FTr: 0.495, ORB_pct: 7.2, TRB_pct: 11.5, AST_pct: 5.9, STL_pct: 1, BLK_pct: 2.6, TOV_pct: 23.6, USG_pct: 16.2, OWS: 0.3, DWS: 0.3, WS: 0.6, WS40: 0.054 },
    },
  },
  'hibbeka01w': {
    id: 'hibbeka01w',
    name: 'Katrina Hibbert',
    position: 'G-F',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 22, G: 20, MP: 240, MP_pct: 0.185, PER: 7.7, TS_pct: 0.421, ThrPAr: 0.525, FTr: 0.153, ORB_pct: 4.4, TRB_pct: 9, AST_pct: 17.2, STL_pct: 1.7, BLK_pct: 0.4, TOV_pct: 21.3, USG_pct: 17.2, OWS: -0.3, DWS: 0.2, WS: -0.2, WS40: -0.03 },
    },
  },
  'hicksje01w': {
    id: 'hicksje01w',
    name: 'Jessie Hicks',
    position: 'C-F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 25, G: 26, MP: 263, MP_pct: 0.233, PER: 12.4, TS_pct: 0.477, ThrPAr: 0.013, FTr: 0.2, ORB_pct: 7.2, TRB_pct: 7.9, AST_pct: 8.5, STL_pct: 2.6, BLK_pct: 3.3, TOV_pct: 12.1, USG_pct: 16.8, OWS: 0.4, DWS: 0, WS: 0.4, WS40: 0.06, MIN_pg: 10.1, PTS_pg: 3.2, REB_pg: 1.4, AST_pg: 0.4, STL_pg: 0.5, BLK_pg: 0.4, TOV_pg: 0.5, FG_pct: 0.463, FG3_pct: 0.000, FT_pct: 0.563 },
      2000: { team: 'ORL', age: 28, G: 26, MP: 157, MP_pct: 0.121, PER: 6.5, TS_pct: 0.531, ThrPAr: 0, FTr: 1.261, ORB_pct: 10.9, TRB_pct: 11.1, AST_pct: 4.4, STL_pct: 0.7, BLK_pct: 3.8, TOV_pct: 32.2, USG_pct: 16.6, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.011, MIN_pg: 6, PTS_pg: 1.5, REB_pg: 1, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0.3, TOV_pg: 0.7, FG_pct: 0.484, FT_pct: 0.621 },
      2001: { team: 'ORL', age: 29, G: 32, MP: 456, MP_pct: 0.353, PER: 12, TS_pct: 0.442, ThrPAr: 0, FTr: 0.407, ORB_pct: 10.6, TRB_pct: 13.4, AST_pct: 10.6, STL_pct: 2.9, BLK_pct: 3.5, TOV_pct: 21.7, USG_pct: 25.5, OWS: -0.4, DWS: 0.5, WS: 0.1, WS40: 0.007, MIN_pg: 14.3, PTS_pg: 5.3, REB_pg: 2.9, AST_pg: 0.7, STL_pg: 0.7, BLK_pg: 0.5, TOV_pg: 1.7, FG_pct: 0.389, FT_pct: 0.652 },
    },
  },
  'hillec01w': {
    id: 'hillec01w',
    name: 'E.C. Hill',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'CHA', age: 28, G: 26, MP: 213, MP_pct: 0.164, PER: -1.1, TS_pct: 0.335, ThrPAr: 0.393, FTr: 0.089, ORB_pct: 5, TRB_pct: 7.3, AST_pct: 11.9, STL_pct: 1.3, BLK_pct: 0.4, TOV_pct: 30, USG_pct: 19.1, OWS: -1, DWS: -0.2, WS: -1.1, WS40: -0.213 },
      2001: { team: 'PHO', age: 29, G: 3, MP: 8, MP_pct: 0.006, PER: 2.6, TS_pct: 0, ThrPAr: 1, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 21, STL_pct: 7.1, BLK_pct: 0, TOV_pct: 0, USG_pct: 6, OWS: 0, DWS: 0, WS: 0, WS40: -0.012 },
    },
  },
  'hledeko01w': {
    id: 'hledeko01w',
    name: 'Korie Hlede',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 23, G: 27, MP: 912, MP_pct: 0.76, PER: 14.8, TS_pct: 0.489, ThrPAr: 0.214, FTr: 0.299, ORB_pct: 5.1, TRB_pct: 9.2, AST_pct: 16.2, STL_pct: 1.2, BLK_pct: 0.1, TOV_pct: 18.4, USG_pct: 23.8, OWS: 1.2, DWS: 1, WS: 2.2, WS40: 0.095, MIN_pg: 33.8, PTS_pg: 14.1, REB_pg: 5.2, AST_pg: 2.7, STL_pg: 0.8, BLK_pg: 0, TOV_pg: 3.3, FG_pct: 0.391, FG3_pct: 0.392, FT_pct: 0.806 },
      1999: { team: 'UTA', age: 24, G: 11, MP: 277, MP_pct: 0.213, PER: 19, TS_pct: 0.598, ThrPAr: 0.305, FTr: 0.347, ORB_pct: 3.3, TRB_pct: 6.9, AST_pct: 20.6, STL_pct: 1.6, BLK_pct: 0.3, TOV_pct: 16.7, USG_pct: 21.8, OWS: 1.1, DWS: -0.1, WS: 1, WS40: 0.146, MIN_pg: 21.9, PTS_pg: 10.6, REB_pg: 2.6, AST_pg: 1.6, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.408, FG3_pct: 0.372, FT_pct: 0.870 },
      2000: { team: 'UTA', age: 25, G: 31, MP: 867, MP_pct: 0.677, PER: 14.5, TS_pct: 0.536, ThrPAr: 0.223, FTr: 0.269, ORB_pct: 3.9, TRB_pct: 6.9, AST_pct: 19.9, STL_pct: 2.4, BLK_pct: 0.4, TOV_pct: 20.7, USG_pct: 19.4, OWS: 1.3, DWS: 0.2, WS: 1.6, WS40: 0.073, MIN_pg: 28, PTS_pg: 10.1, REB_pg: 3, AST_pg: 3, STL_pg: 1.2, BLK_pg: 0.1, TOV_pg: 2.5, FG_pct: 0.454, FG3_pct: 0.431, FT_pct: 0.729 },
      2001: { team: 'UTA', age: 26, G: 27, MP: 455, MP_pct: 0.351, PER: 12.1, TS_pct: 0.479, ThrPAr: 0.163, FTr: 0.27, ORB_pct: 4.6, TRB_pct: 5.6, AST_pct: 18.7, STL_pct: 3.2, BLK_pct: 0.2, TOV_pct: 21, USG_pct: 21.5, OWS: 0.2, DWS: 0.3, WS: 0.5, WS40: 0.042, MIN_pg: 16.9, PTS_pg: 5.6, REB_pg: 1.5, AST_pg: 1.6, STL_pg: 0.9, BLK_pg: 0, TOV_pg: 1.6, FG_pct: 0.390, FG3_pct: 0.348, FT_pct: 0.868 },
    },
  },
  'holdsch01w': {
    id: 'holdsch01w',
    name: 'Chamique Holdsclaw',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 21, G: 31, MP: 1061, MP_pct: 0.819, PER: 21.1, TS_pct: 0.497, ThrPAr: 0.063, FTr: 0.325, ORB_pct: 9.5, TRB_pct: 15, AST_pct: 17.6, STL_pct: 2, BLK_pct: 2.1, TOV_pct: 17, USG_pct: 29.1, OWS: 1.6, DWS: 1.5, WS: 3.1, WS40: 0.117, MIN_pg: 34.2, PTS_pg: 16.9, REB_pg: 7.9, AST_pg: 2.4, STL_pg: 1.2, BLK_pg: 0.9, FG_pct: 0.437, FG3_pct: 0.172, FT_pct: 0.773 },
      2000: { team: 'WAS', age: 22, G: 32, MP: 1131, MP_pct: 0.884, PER: 21.4, TS_pct: 0.505, ThrPAr: 0.078, FTr: 0.257, ORB_pct: 7.1, TRB_pct: 14.6, AST_pct: 15.9, STL_pct: 2.4, BLK_pct: 1.4, TOV_pct: 14.3, USG_pct: 28.5, OWS: 2.1, DWS: 1.4, WS: 3.5, WS40: 0.125, MIN_pg: 35.3, PTS_pg: 17.5, REB_pg: 7.5, AST_pg: 2.5, STL_pg: 1.5, BLK_pg: 0.6, FG_pct: 0.465, FG3_pct: 0.256, FT_pct: 0.680 },
      2001: { team: 'WAS', age: 23, G: 29, MP: 975, MP_pct: 0.75, PER: 21.8, TS_pct: 0.457, ThrPAr: 0.099, FTr: 0.317, ORB_pct: 8.8, TRB_pct: 16.1, AST_pct: 18, STL_pct: 2.7, BLK_pct: 1.2, TOV_pct: 15, USG_pct: 31.7, OWS: 0.7, DWS: 2, WS: 2.7, WS40: 0.112, MIN_pg: 33.6, PTS_pg: 16.8, REB_pg: 8.8, AST_pg: 2.3, STL_pg: 1.5, BLK_pg: 0.5, FG_pct: 0.400, FG3_pct: 0.239, FT_pct: 0.682 },
      2002: { team: 'WAS', age: 24, G: 20, MIN_pg: 31.7, PTS_pg: 19.9, REB_pg: 11.6, AST_pg: 2.3, STL_pg: 1.0, BLK_pg: 0.3, FG_pct: 0.452, FG3_pct: 0.393, FT_pct: 0.830 },
      2003: { team: 'WAS', age: 25, G: 27, MIN_pg: 35.1, PTS_pg: 20.5, REB_pg: 10.9, AST_pg: 3.3, STL_pg: 1.3, BLK_pg: 0.6, FG_pct: 0.425, FG3_pct: 0.171, FT_pct: 0.903 },
      2004: { team: 'WAS', age: 26, G: 23, MIN_pg: 34.8, PTS_pg: 19.0, REB_pg: 8.3, AST_pg: 2.4, STL_pg: 1.7, BLK_pg: 0.8, FG_pct: 0.402, FG3_pct: 0.412, FT_pct: 0.803 },
      2005: { team: 'LAS', age: 27, G: 33, MIN_pg: 35.8, PTS_pg: 17.0, REB_pg: 6.8, AST_pg: 3.2, STL_pg: 1.2, BLK_pg: 0.5, FG_pct: 0.480, FG3_pct: 0.231, FT_pct: 0.788 },
      2006: { team: 'LAS', age: 28, G: 25, MIN_pg: 29.5, PTS_pg: 15.0, REB_pg: 6.1, AST_pg: 2.2, STL_pg: 1.4, BLK_pg: 0.4, FG_pct: 0.470, FG3_pct: 0.200, FT_pct: 0.884 },
      2007: { team: 'LAS', age: 29, G: 5, MIN_pg: 30.0, PTS_pg: 15.8, REB_pg: 5.6, AST_pg: 3.0, STL_pg: 1.2, BLK_pg: 0.6, FG_pct: 0.492, FG3_pct: 0.667, FT_pct: 0.833 },
      2009: { team: 'ATL', age: 31, G: 25, MIN_pg: 28.3, PTS_pg: 13.9, REB_pg: 4.4, AST_pg: 2.2, STL_pg: 1.4, BLK_pg: 0.3, FG_pct: 0.414, FG3_pct: 0.200, FT_pct: 0.839 },
      2010: { team: 'SAN', age: 32, G: 29, MIN_pg: 29.0, PTS_pg: 13.6, REB_pg: 5.3, AST_pg: 2.0, STL_pg: 1.5, BLK_pg: 0.3, FG_pct: 0.494, FG3_pct: 0.355, FT_pct: 0.806 },
    },
  },
  'hollake01w': {
    id: 'hollake01w',
    name: 'Kedra Holland-Corn',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'SAC', age: 24, G: 32, MP: 1034, MP_pct: 0.808, PER: 13.1, TS_pct: 0.514, ThrPAr: 0.52, FTr: 0.336, ORB_pct: 2.8, TRB_pct: 4, AST_pct: 9.1, STL_pct: 3.3, BLK_pct: 0.8, TOV_pct: 16.3, USG_pct: 18.9, OWS: 1.6, DWS: 1.3, WS: 2.9, WS40: 0.112 },
      2000: { team: 'SAC', age: 25, G: 32, MP: 934, MP_pct: 0.73, PER: 13.9, TS_pct: 0.553, ThrPAr: 0.482, FTr: 0.261, ORB_pct: 3.8, TRB_pct: 4.8, AST_pct: 15.3, STL_pct: 2.6, BLK_pct: 0.5, TOV_pct: 20.8, USG_pct: 17.8, OWS: 1.5, DWS: 0.7, WS: 2.3, WS40: 0.097 },
      2001: { team: 'SAC', age: 26, G: 32, MP: 874, MP_pct: 0.67, PER: 17.4, TS_pct: 0.58, ThrPAr: 0.598, FTr: 0.239, ORB_pct: 4.8, TRB_pct: 5.3, AST_pct: 15.3, STL_pct: 3.7, BLK_pct: 0.5, TOV_pct: 19.2, USG_pct: 18.7, OWS: 2.3, DWS: 1.1, WS: 3.4, WS40: 0.157 },
    },
  },
  'holmejo01w': {
    id: 'holmejo01w',
    name: 'Joy Holmes-Harris',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 31, G: 29, MP: 271, MP_pct: 0.211, PER: 14.7, TS_pct: 0.547, ThrPAr: 0.157, FTr: 0.429, ORB_pct: 8.2, TRB_pct: 10.9, AST_pct: 9.3, STL_pct: 2.2, BLK_pct: 1.2, TOV_pct: 16.1, USG_pct: 16.7, OWS: 0.6, DWS: 0.2, WS: 0.8, WS40: 0.112 },
    },
  },
  'hopeky01w': {
    id: 'hopeky01w',
    name: 'Kym Hope',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 22, G: 3, MP: 4, MP_pct: 0.003, PER: 12.5, TS_pct: 0.532, ThrPAr: 0, FTr: 2, ORB_pct: 0, TRB_pct: 32.1, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 34.7, USG_pct: 33.1, OWS: 0, DWS: 0, WS: 0, WS40: -0.029 },
    },
  },
  'hopsosu01w': {
    id: 'hopsosu01w',
    name: 'Susie Hopson-Shelton',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 23, G: 6, MP: 29, MP_pct: 0.026, PER: 25.7, TS_pct: 0.673, ThrPAr: 0, FTr: 0.182, ORB_pct: 4.4, TRB_pct: 10.7, AST_pct: 8.6, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 14.4, USG_pct: 22.7, OWS: 0.1, DWS: 0, WS: 0.2, WS40: 0.245 },
    },
  },
  'howarje01w': {
    id: 'howarje01w',
    name: 'Jennifer Howard',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 24, G: 4, MP: 15, MP_pct: 0.012, PER: -25.6, TS_pct: 0, ThrPAr: 0.75, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 42.9, USG_pct: 22.6, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.633 },
    },
  },
  'ivanyda01w': {
    id: 'ivanyda01w',
    name: 'Dalma Ivanyi',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 23, G: 14, MP: 67, MP_pct: 0.052, PER: -1.2, TS_pct: 0.4, ThrPAr: 0.333, FTr: 0.333, ORB_pct: 5.8, TRB_pct: 4.8, AST_pct: 17.7, STL_pct: 3.2, BLK_pct: 0, TOV_pct: 44.4, USG_pct: 16.9, OWS: -0.3, DWS: 0, WS: -0.3, WS40: -0.166 },
      2000: { team: 'UTA', age: 24, G: 27, MP: 489, MP_pct: 0.382, PER: 6.9, TS_pct: 0.429, ThrPAr: 0.448, FTr: 0.292, ORB_pct: 3.3, TRB_pct: 7.1, AST_pct: 21.2, STL_pct: 2.8, BLK_pct: 0.5, TOV_pct: 31.6, USG_pct: 14.9, OWS: -0.6, DWS: 0.2, WS: -0.3, WS40: -0.028 },
    },
  },
  'iveyni01w': {
    id: 'iveyni01w',
    name: 'Niele Ivey',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'IND', age: 23, G: 32, MP: 708, MP_pct: 0.547, PER: 10.6, TS_pct: 0.529, ThrPAr: 0.686, FTr: 0.147, ORB_pct: 3.1, TRB_pct: 5.3, AST_pct: 18.5, STL_pct: 2.7, BLK_pct: 0.6, TOV_pct: 24.4, USG_pct: 10.2, OWS: 0.9, DWS: 0, WS: 0.9, WS40: 0.051, MIN_pg: 22.1, PTS_pg: 3.6, REB_pg: 1.7, AST_pg: 2.2, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.373, FG3_pct: 0.357, FT_pct: 0.933 },
      2002: { G: 31, MIN_pg: 14.2, PTS_pg: 2.8, REB_pg: 0.9, AST_pg: 1.3, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.352, FG3_pct: 0.380, FT_pct: 0.810 },
      2003: { G: 27, MIN_pg: 24.1, PTS_pg: 5, REB_pg: 1.2, AST_pg: 2.6, STL_pg: 1.1, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.388, FG3_pct: 0.393, FT_pct: 0.706 },
    },
  },
  'jacksan01w': {
    id: 'jacksan01w',
    name: 'Angela Jackson',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 22, G: 6, MP: 36, MP_pct: 0.03, PER: 13.8, TS_pct: 0.579, ThrPAr: 0, FTr: 1, ORB_pct: 9.7, TRB_pct: 6.8, AST_pct: 0, STL_pct: 1.4, BLK_pct: 4.3, TOV_pct: 0, USG_pct: 10.6, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.13 },
    },
  },
  'jacksla01w': {
    id: 'jacksla01w',
    name: 'Lauren Jackson',
    position: 'F-C',
    retired: true,
    seasons: {
      2001: { team: 'SEA', age: 20, G: 29, MP: 1001, MP_pct: 0.764, PER: 22.5, TS_pct: 0.471, ThrPAr: 0.318, FTr: 0.352, ORB_pct: 7, TRB_pct: 13, AST_pct: 11.7, STL_pct: 3.3, BLK_pct: 5.9, TOV_pct: 10.2, USG_pct: 27.1, OWS: 2, DWS: 2.1, WS: 4.1, WS40: 0.163, MIN_pg: 34.5, PTS_pg: 15.2, REB_pg: 6.7, AST_pg: 1.5, STL_pg: 1.9, BLK_pg: 2.2, FG_pct: 0.367, FG3_pct: 0.310, FT_pct: 0.727 },
      2002: { team: 'SEA', age: 21, G: 28, MIN_pg: 31.5, PTS_pg: 17.2, REB_pg: 6.8, AST_pg: 1.5, STL_pg: 1.1, BLK_pg: 2.9, FG_pct: 0.403, FG3_pct: 0.350, FT_pct: 0.756 },
      2003: { team: 'SEA', age: 22, G: 33, MIN_pg: 33.6, PTS_pg: 21.2, REB_pg: 9.3, AST_pg: 1.9, STL_pg: 1.2, BLK_pg: 1.9, FG_pct: 0.483, FG3_pct: 0.317, FT_pct: 0.825 },
      2004: { team: 'SEA', age: 23, G: 31, MIN_pg: 34.5, PTS_pg: 20.5, REB_pg: 6.7, AST_pg: 1.6, STL_pg: 1.0, BLK_pg: 2.0, FG_pct: 0.478, FG3_pct: 0.452, FT_pct: 0.811 },
      2005: { team: 'SEA', age: 24, G: 34, MIN_pg: 34.6, PTS_pg: 17.6, REB_pg: 9.2, AST_pg: 1.7, STL_pg: 1.1, BLK_pg: 2.0, FG_pct: 0.458, FG3_pct: 0.288, FT_pct: 0.834 },
      2006: { team: 'SEA', age: 25, G: 30, MIN_pg: 28.3, PTS_pg: 19.5, REB_pg: 7.7, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 1.7, FG_pct: 0.535, FG3_pct: 0.377, FT_pct: 0.899 },
      2007: { team: 'SEA', age: 26, G: 31, MIN_pg: 32.9, PTS_pg: 23.8, REB_pg: 9.7, AST_pg: 1.3, STL_pg: 1.0, BLK_pg: 2.0, FG_pct: 0.519, FG3_pct: 0.402, FT_pct: 0.883 },
      2008: { team: 'SEA', age: 27, G: 21, MIN_pg: 33.0, PTS_pg: 20.2, REB_pg: 7.0, AST_pg: 1.2, STL_pg: 1.5, BLK_pg: 1.6, FG_pct: 0.452, FG3_pct: 0.295, FT_pct: 0.934 },
      2009: { team: 'SEA', age: 28, G: 26, MIN_pg: 32.4, PTS_pg: 19.2, REB_pg: 7.0, AST_pg: 0.8, STL_pg: 1.5, BLK_pg: 1.7, FG_pct: 0.463, FG3_pct: 0.430, FT_pct: 0.797 },
      2010: { team: 'SEA', age: 29, G: 32, MIN_pg: 31.0, PTS_pg: 20.5, REB_pg: 8.3, AST_pg: 1.2, STL_pg: 0.9, BLK_pg: 1.2, FG_pct: 0.462, FG3_pct: 0.346, FT_pct: 0.910 },
      2011: { team: 'SEA', age: 30, G: 13, MIN_pg: 24.8, PTS_pg: 12.2, REB_pg: 4.9, AST_pg: 0.3, STL_pg: 1.0, BLK_pg: 0.8, FG_pct: 0.396, FG3_pct: 0.311, FT_pct: 0.884 },
      2012: { team: 'SEA', age: 31, G: 9,  MIN_pg: 24.8, PTS_pg: 12.2, REB_pg: 4.9, AST_pg: 0.3, STL_pg: 1.0, BLK_pg: 0.8, FG_pct: 0.425, FG3_pct: 0.311, FT_pct: 0.720 },
    },
  },
  'jacksta01w': {
    id: 'jacksta01w',
    name: 'Tammy Jackson',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 34, G: 28, MP: 545, MP_pct: 0.482, PER: 10.2, TS_pct: 0.449, ThrPAr: 0.009, FTr: 0.373, ORB_pct: 10, TRB_pct: 14, AST_pct: 4.1, STL_pct: 4.6, BLK_pct: 1.6, TOV_pct: 27.7, USG_pct: 15.2, OWS: -0.4, DWS: 1.3, WS: 0.9, WS40: 0.069, MIN_pg: 19.5, PTS_pg: 4.1, REB_pg: 4.1, AST_pg: 0.4, STL_pg: 1.6, BLK_pg: 0.4, TOV_pg: 1.8, FG_pct: 0.409, FG3_pct: 0.000, FT_pct: 0.610 },
      1998: { team: 'WAS', age: 35, G: 2, MP: 14, MP_pct: 0.012, PER: 11.3, TS_pct: 0.515, ThrPAr: 0, FTr: 0.667, ORB_pct: 8.3, TRB_pct: 17.6, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 12.3, OWS: 0, DWS: 0, WS: 0, WS40: 0.053, MIN_pg: 8.2, PTS_pg: 1.5, REB_pg: 1.3, AST_pg: 0.3, STL_pg: 0.2, BLK_pg: 0.3, TOV_pg: 0.6, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.667 },
      1999: { team: 'HOU', age: 36, G: 28, MP: 382, MP_pct: 0.297, PER: 10.9, TS_pct: 0.504, ThrPAr: 0.017, FTr: 0.603, ORB_pct: 16.4, TRB_pct: 15.6, AST_pct: 3.1, STL_pct: 2.3, BLK_pct: 4.4, TOV_pct: 26.2, USG_pct: 12.7, OWS: 0.3, DWS: 0.8, WS: 1.2, WS40: 0.123, MIN_pg: 13.6, PTS_pg: 2.6, REB_pg: 3.3, AST_pg: 0.3, STL_pg: 0.5, BLK_pg: 0.7, TOV_pg: 0.9, FG_pct: 0.414, FG3_pct: 1.000, FT_pct: 0.714 },
      2000: { team: 'HOU', age: 37, G: 29, MP: 339, MP_pct: 0.262, PER: 10, TS_pct: 0.577, ThrPAr: 0, FTr: 0.18, ORB_pct: 7.8, TRB_pct: 12.3, AST_pct: 5.5, STL_pct: 2, BLK_pct: 2.3, TOV_pct: 26.7, USG_pct: 13.1, OWS: 0.2, DWS: 0.8, WS: 1, WS40: 0.114, MIN_pg: 11.7, PTS_pg: 2.6, REB_pg: 2.1, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0.3, TOV_pg: 0.8, FG_pct: 0.574, FG3_pct: 0.000, FT_pct: 0.545 },
      2001: { team: 'HOU', age: 38, G: 32, MP: 442, MP_pct: 0.343, PER: 14.1, TS_pct: 0.502, ThrPAr: 0, FTr: 0.465, ORB_pct: 11.3, TRB_pct: 13, AST_pct: 9.9, STL_pct: 3, BLK_pct: 2.2, TOV_pct: 21.9, USG_pct: 15, OWS: 0.4, DWS: 0.9, WS: 1.2, WS40: 0.111, MIN_pg: 13.8, PTS_pg: 3.3, REB_pg: 2.8, AST_pg: 0.7, STL_pg: 0.7, BLK_pg: 0.3, TOV_pg: 0.9, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.450 },
    },
  },
  'jacksta02w': {
    id: 'jacksta02w',
    name: 'Tamicha Jackson',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 22, G: 17, MP: 267, MP_pct: 0.208, PER: 18.2, TS_pct: 0.478, ThrPAr: 0.302, FTr: 0.33, ORB_pct: 3.9, TRB_pct: 6.2, AST_pct: 25.8, STL_pct: 4.4, BLK_pct: 0, TOV_pct: 14.7, USG_pct: 24.3, OWS: 0.5, DWS: 0.3, WS: 0.8, WS40: 0.116, MIN_pg: 15.7, PTS_pg: 6.8, REB_pg: 1.5, AST_pg: 2.1, STL_pg: 1.3, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.387, FG3_pct: 0.250, FT_pct: 0.743 },
      2001: { team: 'POR', age: 23, G: 32, MP: 497, MP_pct: 0.381, PER: 7.9, TS_pct: 0.368, ThrPAr: 0.231, FTr: 0.136, ORB_pct: 2.5, TRB_pct: 5.5, AST_pct: 22.3, STL_pct: 3.2, BLK_pct: 0, TOV_pct: 20.1, USG_pct: 22.1, OWS: -1.3, DWS: 0.4, WS: -0.9, WS40: -0.069, MIN_pg: 15.5, PTS_pg: 4.1, REB_pg: 1.4, AST_pg: 1.6, STL_pg: 0.9, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.325, FG3_pct: 0.154, FT_pct: 0.696 },
    },
  },
  'jacksti01w': {
    id: 'jacksti01w',
    name: 'Tia Jackson',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 25, G: 26, MP: 320, MP_pct: 0.282, PER: 11, TS_pct: 0.44, ThrPAr: 0.11, FTr: 0.342, ORB_pct: 8.8, TRB_pct: 10.6, AST_pct: 16.1, STL_pct: 3.8, BLK_pct: 2.2, TOV_pct: 30.6, USG_pct: 17, OWS: -0.3, DWS: 0.8, WS: 0.5, WS40: 0.06 },
    },
  },
  'johnsad01w': {
    id: 'johnsad01w',
    name: 'Adrienne Johnson',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 23, G: 25, MP: 194, MP_pct: 0.171, PER: 4.6, TS_pct: 0.421, ThrPAr: 0.068, FTr: 0.153, ORB_pct: 5.6, TRB_pct: 7.3, AST_pct: 8.8, STL_pct: 1.4, BLK_pct: 0.4, TOV_pct: 30, USG_pct: 21.6, OWS: -0.6, DWS: 0.1, WS: -0.5, WS40: -0.105 },
      1998: { team: 'CLE', age: 24, G: 29, MP: 330, MP_pct: 0.272, PER: 14.2, TS_pct: 0.537, ThrPAr: 0.284, FTr: 0.155, ORB_pct: 7.6, TRB_pct: 9.8, AST_pct: 9.1, STL_pct: 1.2, BLK_pct: 1, TOV_pct: 16.2, USG_pct: 21.6, OWS: 0.5, DWS: 0.3, WS: 0.7, WS40: 0.091 },
      1999: { team: 'ORL', age: 25, G: 29, MP: 224, MP_pct: 0.174, PER: 9.1, TS_pct: 0.432, ThrPAr: 0.129, FTr: 0.145, ORB_pct: 7, TRB_pct: 8.2, AST_pct: 12.4, STL_pct: 1.3, BLK_pct: 0.8, TOV_pct: 17.5, USG_pct: 17.1, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.01 },
      2000: { team: 'ORL', age: 26, G: 32, MP: 1100, MP_pct: 0.846, PER: 15.3, TS_pct: 0.532, ThrPAr: 0.377, FTr: 0.097, ORB_pct: 3.6, TRB_pct: 5.5, AST_pct: 10.2, STL_pct: 1.3, BLK_pct: 0.2, TOV_pct: 12, USG_pct: 20.9, OWS: 2.5, DWS: 0.1, WS: 2.6, WS40: 0.094 },
    },
  },
  'johnsja01w': {
    id: 'johnsja01w',
    name: 'Jaclyn Johnson',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'ORL', age: 22, G: 17, MP: 139, MP_pct: 0.108, PER: 10.3, TS_pct: 0.643, ThrPAr: 0.28, FTr: 0.2, ORB_pct: 9.1, TRB_pct: 11, AST_pct: 13.1, STL_pct: 1.7, BLK_pct: 2, TOV_pct: 38.5, USG_pct: 15.2, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.02 },
      1999: { G: 31, MIN_pg: 9.5, PTS_pg: 1.5, REB_pg: 0.6, AST_pg: 1.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.300, FG3_pct: 0.261, FT_pct: 0.917 },
      2000: { G: 6, MIN_pg: 13, PTS_pg: 4.3, REB_pg: 0.7, AST_pg: 1.8, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 1.5, FG_pct: 0.529, FG3_pct: 0.400, FT_pct: 1.000 },
    },
  },
  'johnsla01w': {
    id: 'johnsla01w',
    name: 'LaTonya Johnson',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'UTA', age: 22, G: 28, MP: 490, MP_pct: 0.405, PER: 7.9, TS_pct: 0.472, ThrPAr: 0.338, FTr: 0.234, ORB_pct: 3.5, TRB_pct: 6.6, AST_pct: 7.8, STL_pct: 1.2, BLK_pct: 0.2, TOV_pct: 20.8, USG_pct: 18.8, OWS: -0.3, DWS: -0.2, WS: -0.6, WS40: -0.046 },
      1999: { team: 'UTA', age: 23, G: 31, MP: 718, MP_pct: 0.552, PER: 10.2, TS_pct: 0.491, ThrPAr: 0.453, FTr: 0.32, ORB_pct: 2.5, TRB_pct: 4.8, AST_pct: 12.5, STL_pct: 1.6, BLK_pct: 1, TOV_pct: 16.2, USG_pct: 15.7, OWS: 0.8, DWS: -0.3, WS: 0.5, WS40: 0.029 },
      2000: { team: 'UTA', age: 24, G: 29, MP: 481, MP_pct: 0.376, PER: 8.4, TS_pct: 0.487, ThrPAr: 0.279, FTr: 0.333, ORB_pct: 3.9, TRB_pct: 7, AST_pct: 9.6, STL_pct: 1.4, BLK_pct: 0.4, TOV_pct: 18.7, USG_pct: 17.4, OWS: 0.2, DWS: 0, WS: 0.2, WS40: 0.013 },
      2001: { team: 'UTA', age: 25, G: 26, MP: 228, MP_pct: 0.176, PER: 1.5, TS_pct: 0.351, ThrPAr: 0.462, FTr: 0.215, ORB_pct: 2.5, TRB_pct: 5.3, AST_pct: 5.6, STL_pct: 0.5, BLK_pct: 0.4, TOV_pct: 15.4, USG_pct: 18.1, OWS: -0.5, DWS: 0, WS: -0.5, WS40: -0.091 },
    },
  },
  'johnsle01w': {
    id: 'johnsle01w',
    name: 'Leslie Johnson',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 23, G: 7, MP: 15, MP_pct: 0.012, PER: -14.5, TS_pct: 0.5, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 4.1, AST_pct: 12.6, STL_pct: 0, BLK_pct: 0, TOV_pct: 66.7, USG_pct: 17.7, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.376 },
    },
  },
  'johnsni01w': {
    id: 'johnsni01w',
    name: 'Niesa Johnson',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 26, G: 31, MP: 296, MP_pct: 0.23, PER: 7.2, TS_pct: 0.425, ThrPAr: 0.46, FTr: 0.24, ORB_pct: 1.5, TRB_pct: 4.1, AST_pct: 25.6, STL_pct: 2, BLK_pct: 0.6, TOV_pct: 32.8, USG_pct: 14.2, OWS: -0.4, DWS: 0.1, WS: -0.2, WS40: -0.03 },
      2000: { team: 'CHA', age: 27, G: 6, MP: 78, MP_pct: 0.06, PER: 15.9, TS_pct: 0.662, ThrPAr: 0.294, FTr: 0.353, ORB_pct: 0, TRB_pct: 3.4, AST_pct: 27.6, STL_pct: 2.9, BLK_pct: 0, TOV_pct: 31.4, USG_pct: 17.9, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.049 },
    },
  },
  'johnspo01w': {
    id: 'johnspo01w',
    name: 'Pollyanna Johns Kimbrough',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 22, G: 24, MP: 180, MP_pct: 0.15, PER: 16.4, TS_pct: 0.541, ThrPAr: 0, FTr: 0.622, ORB_pct: 9.7, TRB_pct: 12.7, AST_pct: 6.1, STL_pct: 0.9, BLK_pct: 0.9, TOV_pct: 13.6, USG_pct: 17.1, OWS: 0.5, DWS: 0.2, WS: 0.7, WS40: 0.152, MIN_pg: 7.5, PTS_pg: 2.6, REB_pg: 1.5, AST_pg: 0.3, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.489, FT_pct: 0.643 },
      2000: { team: 'CLE', age: 24, G: 12, MP: 57, MP_pct: 0.044, PER: 8.7, TS_pct: 0.556, ThrPAr: 0, FTr: 1.2, ORB_pct: 17.2, TRB_pct: 17.7, AST_pct: 6.6, STL_pct: 0, BLK_pct: 1.6, TOV_pct: 34.4, USG_pct: 20.3, OWS: 0, DWS: 0.1, WS: 0, WS40: 0.008, MIN_pg: 4.8, PTS_pg: 1.4, REB_pg: 1.2, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.500, FT_pct: 0.583 },
      2001: { team: 'CLE', age: 25, G: 18, MP: 119, MP_pct: 0.093, PER: 9.5, TS_pct: 0.452, ThrPAr: 0, FTr: 0.333, ORB_pct: 14.5, TRB_pct: 18.1, AST_pct: 6.8, STL_pct: 0, BLK_pct: 1.6, TOV_pct: 24.4, USG_pct: 18.2, OWS: -0.1, DWS: 0.3, WS: 0.2, WS40: 0.059, MIN_pg: 6.6, PTS_pg: 2.6, REB_pg: 1.7, AST_pg: 0.2, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.444, FT_pct: 0.444 },
    },
  },
  'johnssh01w': {
    id: 'johnssh01w',
    name: 'Shannon Johnson',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 24, G: 32, MP: 1147, MP_pct: 0.889, PER: 18.3, TS_pct: 0.551, ThrPAr: 0.325, FTr: 0.453, ORB_pct: 5, TRB_pct: 8.6, AST_pct: 25.4, STL_pct: 2.7, BLK_pct: 0.9, TOV_pct: 23, USG_pct: 22, OWS: 2.3, DWS: 1.2, WS: 3.5, WS40: 0.121, MIN_pg: 35.8, PTS_pg: 14, REB_pg: 4.7, AST_pg: 4.4, STL_pg: 1.7, BLK_pg: 0.4, TOV_pg: 3.8, FG_pct: 0.447, FG3_pct: 0.364, FT_pct: 0.686 },
      2000: { team: 'ORL', age: 25, G: 32, MP: 1126, MP_pct: 0.866, PER: 17.9, TS_pct: 0.512, ThrPAr: 0.291, FTr: 0.466, ORB_pct: 6.2, TRB_pct: 9.2, AST_pct: 28.2, STL_pct: 3, BLK_pct: 0.5, TOV_pct: 21.5, USG_pct: 20.8, OWS: 2.2, DWS: 1.1, WS: 3.3, WS40: 0.119, MIN_pg: 35.2, PTS_pg: 11.9, REB_pg: 4.8, AST_pg: 5.3, STL_pg: 1.8, BLK_pg: 0.2, TOV_pg: 3.2, FG_pct: 0.395, FG3_pct: 0.333, FT_pct: 0.743 },
      2001: { team: 'ORL', age: 26, G: 26, MP: 785, MP_pct: 0.609, PER: 16.2, TS_pct: 0.514, ThrPAr: 0.424, FTr: 0.453, ORB_pct: 2.4, TRB_pct: 6.5, AST_pct: 18, STL_pct: 2.5, BLK_pct: 0.7, TOV_pct: 15.5, USG_pct: 21.1, OWS: 2.1, DWS: 0.3, WS: 2.4, WS40: 0.122, MIN_pg: 30.2, PTS_pg: 11.6, REB_pg: 3, AST_pg: 2.6, STL_pg: 1.3, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.367, FG3_pct: 0.365, FT_pct: 0.757 },
    },
  },
  'johnsti01w': {
    id: 'johnsti01w',
    name: 'Tiffani Johnson',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 22, G: 6, MP: 32, MP_pct: 0.027, PER: -2.4, TS_pct: 0.129, ThrPAr: 0, FTr: 0.667, ORB_pct: 11.6, TRB_pct: 19.8, AST_pct: 0, STL_pct: 3.5, BLK_pct: 0, TOV_pct: 27.9, USG_pct: 15.7, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.184, MIN_pg: 5.3, PTS_pg: 0.3, REB_pg: 1.7, AST_pg: 0, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.500 },
      2000: { team: 'HOU', age: 24, G: 31, MP: 687, MP_pct: 0.531, PER: 11.3, TS_pct: 0.537, ThrPAr: 0, FTr: 0.5, ORB_pct: 12.6, TRB_pct: 14.6, AST_pct: 2.4, STL_pct: 0.8, BLK_pct: 2, TOV_pct: 12.2, USG_pct: 10, OWS: 1.6, DWS: 1.3, WS: 2.9, WS40: 0.168, MIN_pg: 22.2, PTS_pg: 4.2, REB_pg: 4.7, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.5, TOV_pg: 0.5, FG_pct: 0.480, FG3_pct: 0.000, FT_pct: 0.700 },
      2001: { team: 'HOU', age: 25, G: 32, MP: 672, MP_pct: 0.521, PER: 10.8, TS_pct: 0.492, ThrPAr: 0, FTr: 0.203, ORB_pct: 8.2, TRB_pct: 13, AST_pct: 6.7, STL_pct: 1.1, BLK_pct: 2, TOV_pct: 21.8, USG_pct: 14.3, OWS: 0.3, DWS: 1, WS: 1.3, WS40: 0.077, MIN_pg: 21, PTS_pg: 4.6, REB_pg: 4.3, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 0.5, TOV_pg: 1.3, FG_pct: 0.449, FG3_pct: 0.000, FT_pct: 0.857 },
    },
  },
  'johnsvi01w': {
    id: 'johnsvi01w',
    name: 'Vickie Johnson',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 25, G: 26, MP: 789, MP_pct: 0.695, PER: 12.4, TS_pct: 0.434, ThrPAr: 0.078, FTr: 0.13, ORB_pct: 7.2, TRB_pct: 8.5, AST_pct: 17.2, STL_pct: 1.3, BLK_pct: 0.4, TOV_pct: 14.7, USG_pct: 19, OWS: 0.8, DWS: 0.9, WS: 1.7, WS40: 0.086, MIN_pg: 30.3, PTS_pg: 9.6, REB_pg: 4.2, AST_pg: 2.5, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.404, FG3_pct: 0.190, FT_pct: 0.771 },
      1998: { team: 'NYL', age: 26, G: 30, MP: 905, MP_pct: 0.748, PER: 18.7, TS_pct: 0.518, ThrPAr: 0.171, FTr: 0.251, ORB_pct: 6.3, TRB_pct: 8.3, AST_pct: 17.6, STL_pct: 1.9, BLK_pct: 0.7, TOV_pct: 11, USG_pct: 21.3, OWS: 3.1, DWS: 1.2, WS: 4.3, WS40: 0.189, MIN_pg: 30.2, PTS_pg: 12.5, REB_pg: 3.8, AST_pg: 2.5, STL_pg: 1.0, BLK_pg: 0.2, FG_pct: 0.446, FG3_pct: 0.375, FT_pct: 0.768 },
      1999: { team: 'NYL', age: 27, G: 32, MP: 1082, MP_pct: 0.829, PER: 17.9, TS_pct: 0.494, ThrPAr: 0.18, FTr: 0.218, ORB_pct: 5.2, TRB_pct: 8.9, AST_pct: 21.3, STL_pct: 2.4, BLK_pct: 0.1, TOV_pct: 13.3, USG_pct: 22.8, OWS: 2.5, DWS: 1.6, WS: 4.2, WS40: 0.154, MIN_pg: 33.8, PTS_pg: 13.3, REB_pg: 4.4, AST_pg: 3.3, STL_pg: 1.4, BLK_pg: 0.0, FG_pct: 0.419, FG3_pct: 0.352, FT_pct: 0.837 },
      2000: { team: 'NYL', age: 28, G: 31, MP: 1023, MP_pct: 0.796, PER: 17.2, TS_pct: 0.532, ThrPAr: 0.219, FTr: 0.235, ORB_pct: 5.4, TRB_pct: 9, AST_pct: 15.8, STL_pct: 1.3, BLK_pct: 0.4, TOV_pct: 13.8, USG_pct: 20.5, OWS: 2.6, DWS: 1.4, WS: 4, WS40: 0.156, MIN_pg: 33.0, PTS_pg: 12.3, REB_pg: 4.4, AST_pg: 2.5, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.441, FG3_pct: 0.380, FT_pct: 0.882 },
      2001: { team: 'NYL', age: 29, G: 32, MP: 939, MP_pct: 0.734, PER: 16.9, TS_pct: 0.495, ThrPAr: 0.252, FTr: 0.215, ORB_pct: 3.4, TRB_pct: 7.7, AST_pct: 18.3, STL_pct: 2.2, BLK_pct: 0.4, TOV_pct: 12.7, USG_pct: 22.4, OWS: 1.9, DWS: 0.8, WS: 2.8, WS40: 0.117, MIN_pg: 29.3, PTS_pg: 11.0, REB_pg: 3.3, AST_pg: 2.7, STL_pg: 1.1, BLK_pg: 0.1, FG_pct: 0.414, FG3_pct: 0.366, FT_pct: 0.757 },
      2002: { team: 'NYL', age: 30, G: 31, MIN_pg: 33.2, PTS_pg: 11.6, REB_pg: 3.5, AST_pg: 2.8, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.456, FG3_pct: 0.421, FT_pct: 0.803 },
      2003: { team: 'NYL', age: 31, G: 32, MIN_pg: 32.6, PTS_pg: 13.4, REB_pg: 3.0, AST_pg: 2.3, STL_pg: 0.9, BLK_pg: 0.2, FG_pct: 0.458, FG3_pct: 0.365, FT_pct: 0.859 },
      2004: { team: 'NYL', age: 32, G: 34, MIN_pg: 32.9, PTS_pg: 9.4, REB_pg: 3.6, AST_pg: 3.6, STL_pg: 0.7, BLK_pg: 0.1, FG_pct: 0.413, FG3_pct: 0.283, FT_pct: 0.886 },
      2005: { team: 'NYL', age: 33, G: 34, MIN_pg: 30.1, PTS_pg: 10.4, REB_pg: 3.5, AST_pg: 2.7, STL_pg: 0.7, BLK_pg: 0.1, FG_pct: 0.474, FG3_pct: 0.357, FT_pct: 0.774 },
      2006: { team: 'SAN', age: 34, G: 34, MIN_pg: 29.5, PTS_pg: 9.9, REB_pg: 4.9, AST_pg: 3.6, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.375, FG3_pct: 0.333, FT_pct: 0.844 },
      2007: { team: 'SAN', age: 35, G: 30, MIN_pg: 28.4, PTS_pg: 8.1, REB_pg: 4.8, AST_pg: 3.5, STL_pg: 1.1, BLK_pg: 0.3, FG_pct: 0.444, FG3_pct: 0.429, FT_pct: 0.821 },
      2008: { team: 'SAN', age: 36, G: 32, MIN_pg: 27.9, PTS_pg: 6.7, REB_pg: 5.3, AST_pg: 3.6, STL_pg: 0.8, BLK_pg: 0.2, FG_pct: 0.439, FG3_pct: 0.282, FT_pct: 0.778 },
      2009: { team: 'SAN', age: 37, G: 32, MIN_pg: 23.0, PTS_pg: 6.4, REB_pg: 3.4, AST_pg: 2.4, STL_pg: 0.5, BLK_pg: 0.1, FG_pct: 0.432, FG3_pct: 0.375, FT_pct: 0.852 },
    },
  },
  'jollyke01w': {
    id: 'jollyke01w',
    name: 'Kellie Jolly Harper',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 22, G: 1, MP: 4, MP_pct: 0.003, PER: -19.3, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 0, AST_pct: 41.8, STL_pct: 0, BLK_pct: 0, TOV_pct: 100, USG_pct: 24.3, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.716, MIN_pg: 4, PTS_pg: 0, REB_pg: 0, AST_pg: 1, STL_pg: 0, BLK_pg: 0, TOV_pg: 2, FG_pct: 0.000, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'jonesja01w': {
    id: 'jonesja01w',
    name: 'Jameka Jones',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIA', age: 21, G: 21, MP: 233, MP_pct: 0.18, PER: -0.2, TS_pct: 0.333, ThrPAr: 0.368, FTr: 0.168, ORB_pct: 5.5, TRB_pct: 6.5, AST_pct: 10.9, STL_pct: 2.1, BLK_pct: 0, TOV_pct: 19.7, USG_pct: 27.3, OWS: -1.1, DWS: 0.3, WS: -0.8, WS40: -0.144 },
    },
  },
  'jonesla01w': {
    id: 'jonesla01w',
    name: 'Larecha Jones',
    position: 'G-F',
    retired: true,
    seasons: {
      2000: { team: 'CHA', age: 22, G: 9, MP: 54, MP_pct: 0.042, PER: 7.7, TS_pct: 0.478, ThrPAr: 0.316, FTr: 0.105, ORB_pct: 0, TRB_pct: 6.2, AST_pct: 7.7, STL_pct: 0, BLK_pct: 1.6, TOV_pct: 16.8, USG_pct: 21.6, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.081 },
    },
  },
  'jonesme01w': {
    id: 'jonesme01w',
    name: 'Merlakia Jones',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 24, G: 28, MP: 589, MP_pct: 0.519, PER: 12.4, TS_pct: 0.451, ThrPAr: 0.052, FTr: 0.245, ORB_pct: 7.2, TRB_pct: 9, AST_pct: 8.8, STL_pct: 2.1, BLK_pct: 0.4, TOV_pct: 17.6, USG_pct: 24.4, OWS: 0.1, DWS: 0.5, WS: 0.6, WS40: 0.038, MIN_pg: 21.0, PTS_pg: 8.2, REB_pg: 2.9, AST_pg: 0.9, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.402, FG3_pct: 0.417, FT_pct: 0.714 },
      1998: { team: 'CLE', age: 25, G: 30, MP: 683, MP_pct: 0.562, PER: 16.1, TS_pct: 0.528, ThrPAr: 0.085, FTr: 0.345, ORB_pct: 6.1, TRB_pct: 9.4, AST_pct: 11.4, STL_pct: 2.5, BLK_pct: 0.4, TOV_pct: 16.1, USG_pct: 22.7, OWS: 1.3, DWS: 0.8, WS: 2.1, WS40: 0.122, MIN_pg: 22.8, PTS_pg: 9.5, REB_pg: 3.2, AST_pg: 1.3, STL_pg: 1.1, BLK_pg: 0.1, FG_pct: 0.464, FG3_pct: 0.350, FT_pct: 0.753 },
      1999: { team: 'CLE', age: 26, G: 32, MP: 853, MP_pct: 0.666, PER: 15.6, TS_pct: 0.483, ThrPAr: 0.055, FTr: 0.24, ORB_pct: 7.3, TRB_pct: 9.2, AST_pct: 13.8, STL_pct: 2.7, BLK_pct: 0.5, TOV_pct: 15.5, USG_pct: 24.2, OWS: 0.6, DWS: 0.9, WS: 1.5, WS40: 0.069, MIN_pg: 26.7, PTS_pg: 10.8, REB_pg: 3.8, AST_pg: 1.6, STL_pg: 1.3, BLK_pg: 0.2, FG_pct: 0.434, FG3_pct: 0.278, FT_pct: 0.769 },
      2000: { team: 'CLE', age: 27, G: 32, MP: 948, MP_pct: 0.729, PER: 15.4, TS_pct: 0.512, ThrPAr: 0.139, FTr: 0.146, ORB_pct: 7.7, TRB_pct: 10.5, AST_pct: 14.4, STL_pct: 1.8, BLK_pct: 0.2, TOV_pct: 14.9, USG_pct: 21.2, OWS: 1.7, DWS: 1.2, WS: 2.9, WS40: 0.121, MIN_pg: 29.6, PTS_pg: 11.0, REB_pg: 4.3, AST_pg: 2.0, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.474, FG3_pct: 0.311, FT_pct: 0.681 },
      2001: { team: 'CLE', age: 28, G: 30, MP: 998, MP_pct: 0.777, PER: 17.8, TS_pct: 0.489, ThrPAr: 0.09, FTr: 0.218, ORB_pct: 6.2, TRB_pct: 11.4, AST_pct: 10.5, STL_pct: 1.8, BLK_pct: 0.4, TOV_pct: 11.4, USG_pct: 24.6, OWS: 2.2, DWS: 2.3, WS: 4.5, WS40: 0.181, MIN_pg: 33.3, PTS_pg: 13.5, REB_pg: 5.5, AST_pg: 1.5, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.438, FG3_pct: 0.265, FT_pct: 0.793 },
      2002: { team: 'CLE', age: 29, G: 32, MIN_pg: 34.2, PTS_pg: 12.2, REB_pg: 5.5, AST_pg: 2.3, STL_pg: 1.4, BLK_pg: 0.1, FG_pct: 0.399, FG3_pct: 0.278, FT_pct: 0.785 },
      2003: { team: 'CLE', age: 30, G: 34, MIN_pg: 19.8, PTS_pg: 4.8, REB_pg: 2.9, AST_pg: 1.3, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.337, FG3_pct: 0.308, FT_pct: 0.718 },
      2004: { team: 'DET', age: 31, G: 33, MIN_pg: 15.7, PTS_pg: 5.5, REB_pg: 2.1, AST_pg: 0.6, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.371, FG3_pct: 0.267, FT_pct: 0.750 },
    },
  },
  'jordapa01w': {
    id: 'jordapa01w',
    name: 'Pauline Jordan',
    position: 'F-C',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 30, G: 18, MP: 247, MP_pct: 0.205, PER: 8.7, TS_pct: 0.402, ThrPAr: 0.016, FTr: 0.459, ORB_pct: 7, TRB_pct: 11.3, AST_pct: 12.4, STL_pct: 3.2, BLK_pct: 4.2, TOV_pct: 24.7, USG_pct: 18.4, OWS: -0.4, DWS: 0.4, WS: 0, WS40: -0.007 },
    },
  },
  'kausaan01w': {
    id: 'kausaan01w',
    name: 'Aneta Kausaite',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 27, G: 10, MP: 58, MP_pct: 0.048, PER: 7.5, TS_pct: 0.303, ThrPAr: 0.1, FTr: 0.35, ORB_pct: 16.4, TRB_pct: 11.2, AST_pct: 3.1, STL_pct: 2.8, BLK_pct: 0, TOV_pct: 11.5, USG_pct: 20.4, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.026 },
    },
  },
  'kingija01w': {
    id: 'kingija01w',
    name: 'Jae Kingi-Cross',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'DET', age: 25, G: 29, MP: 625, MP_pct: 0.477, PER: 14.5, TS_pct: 0.535, ThrPAr: 0.62, FTr: 0.254, ORB_pct: 4.1, TRB_pct: 6.9, AST_pct: 23.5, STL_pct: 2.9, BLK_pct: 1.1, TOV_pct: 25.1, USG_pct: 16.7, OWS: 0.8, DWS: 0.2, WS: 1, WS40: 0.061 },
    },
  },
  'korstil01w': {
    id: 'korstil01w',
    name: 'Ilona Korstine',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 21, G: 12, MP: 75, MP_pct: 0.058, PER: 6.7, TS_pct: 0.374, ThrPAr: 0.12, FTr: 0.28, ORB_pct: 10.3, TRB_pct: 9.6, AST_pct: 13.3, STL_pct: 2.3, BLK_pct: 0, TOV_pct: 24.3, USG_pct: 23.9, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.104, MIN_pg: 6.3, PTS_pg: 1.8, REB_pg: 0.9, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.280, FG3_pct: 0.333, FT_pct: 0.857 },
    },
  },
  'kossgr01w': {
    id: 'kossgr01w',
    name: 'Greta Koss',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 23, G: 13, MP: 268, MP_pct: 0.237, PER: 9.1, TS_pct: 0.61, ThrPAr: 0.103, FTr: 0.552, ORB_pct: 5, TRB_pct: 8, AST_pct: 7, STL_pct: 1.8, BLK_pct: 1.2, TOV_pct: 33.3, USG_pct: 9, OWS: 0.1, DWS: -0.1, WS: 0, WS40: 0.005 },
      2000: { G: 4, MIN_pg: 4.8, PTS_pg: 1.5, REB_pg: 0.5, AST_pg: 0.5, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.333, FG3_pct: 0.000, FT_pct: 1.000 },
      2001: { G: 3, MIN_pg: 7, PTS_pg: 0, REB_pg: 1.7, AST_pg: 1.3, STL_pg: 0, BLK_pg: 1, TOV_pg: 2.3, FG_pct: 0.250, FG3_pct: 0.000, FT_pct: 0.000 },
    },
  },
  'kostita01w': {
    id: 'kostita01w',
    name: 'Tanja Kostic',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'CLE', age: 25, G: 5, MP: 30, MP_pct: 0.025, PER: 4.1, TS_pct: 0.644, ThrPAr: 0, FTr: 0.667, ORB_pct: 4.9, TRB_pct: 4.5, AST_pct: 11.2, STL_pct: 0, BLK_pct: 0, TOV_pct: 43.6, USG_pct: 11, OWS: 0, DWS: 0, WS: 0, WS40: -0.032 },
      2000: { team: 'MIA', age: 27, G: 5, MP: 46, MP_pct: 0.036, PER: 0.3, TS_pct: 0.354, ThrPAr: 0, FTr: 0.222, ORB_pct: 8.3, TRB_pct: 7.5, AST_pct: 20, STL_pct: 2.6, BLK_pct: 0, TOV_pct: 41.5, USG_pct: 18.3, OWS: -0.2, DWS: 0.1, WS: -0.2, WS40: -0.158 },
    },
  },
  'kubikni01w': {
    id: 'kubikni01w',
    name: 'Nicole Kubik',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'PHO', age: 22, G: 4, MP: 19, MP_pct: 0.015, PER: 6.4, TS_pct: 0.63, ThrPAr: 0.333, FTr: 1.333, ORB_pct: 0, TRB_pct: 7.3, AST_pct: 18.4, STL_pct: 0, BLK_pct: 0, TOV_pct: 38.7, USG_pct: 20.8, OWS: 0, DWS: 0, WS: 0, WS40: 0.021, MIN_pg: 9, PTS_pg: 3, REB_pg: 2.5, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.400, FG3_pct: 0.000, FT_pct: 0.500 },
      2001: { team: 'PHO', age: 23, G: 3, MP: 21, MP_pct: 0.016, PER: 7.2, TS_pct: 0.25, ThrPAr: 0.25, FTr: 0, ORB_pct: 0, TRB_pct: 6.2, AST_pct: 43.5, STL_pct: 10.9, BLK_pct: 0, TOV_pct: 42.9, USG_pct: 16.1, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.036 },
      1999: { G: 17, MIN_pg: 6.5, PTS_pg: 1.9, REB_pg: 1.2, AST_pg: 0.1, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.8, FG_pct: 0.417, FG3_pct: 0.000, FT_pct: 0.800 },
    },
  },
  'kukloan01w': {
    id: 'kukloan01w',
    name: 'Andrea Kuklova',
    position: 'G-F',
    retired: true,
    seasons: {
      1998: { team: 'PHO', age: 26, G: 29, MP: 340, MP_pct: 0.28, PER: 8.6, TS_pct: 0.438, ThrPAr: 0.074, FTr: 0.379, ORB_pct: 7, TRB_pct: 7, AST_pct: 17, STL_pct: 2.9, BLK_pct: 1, TOV_pct: 26.5, USG_pct: 20.3, OWS: -0.5, DWS: 0.5, WS: 0.1, WS40: 0.007 },
      1999: { team: 'PHO', age: 27, G: 5, MP: 13, MP_pct: 0.01, PER: -17.3, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 25, USG_pct: 14.7, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.387 },
    },
  },
  'lacyve01w': {
    id: 'lacyve01w',
    name: 'Venus Lacy',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'NYL', age: 32, G: 17, MP: 111, MP_pct: 0.085, PER: 6.5, TS_pct: 0.523, ThrPAr: 0, FTr: 0.625, ORB_pct: 8.2, TRB_pct: 12.2, AST_pct: 1.7, STL_pct: 1.6, BLK_pct: 3.5, TOV_pct: 31.4, USG_pct: 19.9, OWS: -0.2, DWS: 0.2, WS: 0, WS40: 0.01, MIN_pg: 12, PTS_pg: 4.3, REB_pg: 2, AST_pg: 0, STL_pg: 0, BLK_pg: 0.7, TOV_pg: 0.3, FG_pct: 0.400, FG3_pct: 0.400, FT_pct: 0.833 },
      2000: { team: 'NYL', age: 33, G: 2, MP: 18, MP_pct: 0.014, PER: 9.1, TS_pct: 0.444, ThrPAr: 0, FTr: 0.8, ORB_pct: 7.6, TRB_pct: 18.7, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 22.8, USG_pct: 24.6, OWS: -0.1, DWS: 0, WS: 0, WS40: -0.038, MIN_pg: 10.8, PTS_pg: 2, REB_pg: 2, AST_pg: 0.2, STL_pg: 0.2, BLK_pg: 0.3, TOV_pg: 0.3, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.500 },
      1998: { G: 30, MIN_pg: 21.6, PTS_pg: 5.4, REB_pg: 4.7, AST_pg: 0.3, STL_pg: 0.8, BLK_pg: 0.7, TOV_pg: 0.9, FG_pct: 0.541, FG3_pct: 0.541, FT_pct: 0.690 },
    },
  },
  'lambmo01w': {
    id: 'lambmo01w',
    name: 'Monica Lamb',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'HOU', age: 33, G: 30, MP: 649, MP_pct: 0.534, PER: 15, TS_pct: 0.573, ThrPAr: 0, FTr: 0.344, ORB_pct: 12.5, TRB_pct: 14.1, AST_pct: 2.5, STL_pct: 2.1, BLK_pct: 2.7, TOV_pct: 16.1, USG_pct: 12.3, OWS: 1.8, DWS: 1.4, WS: 3.2, WS40: 0.198 },
      1999: { team: 'HOU', age: 34, G: 3, MP: 36, MP_pct: 0.028, PER: 14.9, TS_pct: 0.514, ThrPAr: 0, FTr: 0.6, ORB_pct: 11.6, TRB_pct: 10.9, AST_pct: 0, STL_pct: 0, BLK_pct: 4.7, TOV_pct: 7.3, USG_pct: 18.5, OWS: 0.1, DWS: 0, WS: 0.2, WS40: 0.186 },
      2000: { team: 'HOU', age: 35, G: 13, MP: 140, MP_pct: 0.108, PER: 8.6, TS_pct: 0.514, ThrPAr: 0, FTr: 0.6, ORB_pct: 5.2, TRB_pct: 12.7, AST_pct: 3.5, STL_pct: 0.8, BLK_pct: 2.4, TOV_pct: 13.7, USG_pct: 10.4, OWS: 0.1, DWS: 0.3, WS: 0.4, WS40: 0.126 },
      2001: { G: 32, MIN_pg: 19.2, PTS_pg: 4.3, REB_pg: 3.4, AST_pg: 1.1, STL_pg: 0.5, BLK_pg: 0.7, TOV_pg: 1.1, FG_pct: 0.367, FG3_pct: 0.388, FT_pct: 0.667 },
      2002: { G: 30, MIN_pg: 15.4, PTS_pg: 2.8, REB_pg: 1.8, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.3, TOV_pg: 1.2, FG_pct: 0.181, FG3_pct: 0.151, FT_pct: 0.603 },
      2003: { G: 32, MIN_pg: 22.9, PTS_pg: 5.1, REB_pg: 3.5, AST_pg: 1.3, STL_pg: 0.8, BLK_pg: 0.8, TOV_pg: 1.3, FG_pct: 0.385, FG3_pct: 0.329, FT_pct: 0.633 },
    },
  },
  'langeme01w': {
    id: 'langeme01w',
    name: 'MerleLynn Lange-Harris',
    position: 'F-C',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 30, G: 1, MP: 3, MP_pct: 0.002, PER: 6.2, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 42.4, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: null, USG_pct: 0, OWS: 0, DWS: 0, WS: 0, WS40: 0.197 },
    },
  },
  'larakr01w': {
    id: 'larakr01w',
    name: 'Krystyna Lara',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 29, G: 25, MP: 204, MP_pct: 0.157, PER: 3.5, TS_pct: 0.439, ThrPAr: 0.485, FTr: 0.088, ORB_pct: 0.6, TRB_pct: 4.1, AST_pct: 21, STL_pct: 2.7, BLK_pct: 0.9, TOV_pct: 33.8, USG_pct: 24, OWS: -0.8, DWS: 0, WS: -0.8, WS40: -0.158 },
    },
  },
  'lassiam01w': {
    id: 'lassiam01w',
    name: 'Amanda Lassiter',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'HOU', age: 22, G: 32, MP: 613, MP_pct: 0.475, PER: 11.4, TS_pct: 0.474, ThrPAr: 0.482, FTr: 0.108, ORB_pct: 5.5, TRB_pct: 11.3, AST_pct: 11.2, STL_pct: 1.6, BLK_pct: 3.1, TOV_pct: 19.4, USG_pct: 14.7, OWS: 0.3, DWS: 1.1, WS: 1.4, WS40: 0.09, MIN_pg: 14.5, PTS_pg: 4.9, REB_pg: 1.4, AST_pg: 1.7, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.367, FG3_pct: 0.303, FT_pct: 0.541 },
      2000: { G: 32, MIN_pg: 16.8, PTS_pg: 5.5, REB_pg: 1.8, AST_pg: 2.3, STL_pg: 1.2, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.377, FG3_pct: 0.333, FT_pct: 0.573 },
      2002: { G: 23, MIN_pg: 12.2, PTS_pg: 3.1, REB_pg: 1.2, AST_pg: 1.7, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.353, FG3_pct: 0.250, FT_pct: 0.759 },
    },
  },
  'lazicka01w': {
    id: 'lazicka01w',
    name: 'Katarina Lazic',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'NYL', age: 21, G: 8, MP: 55, MP_pct: 0.043, PER: 1.3, TS_pct: 0.407, ThrPAr: 0.1, FTr: 0.1, ORB_pct: 5, TRB_pct: 7.4, AST_pct: 10.8, STL_pct: 3.2, BLK_pct: 0, TOV_pct: 32.4, USG_pct: 28.9, OWS: -0.3, DWS: 0.1, WS: -0.3, WS40: -0.207 },
    },
  },
  'lennobe01w': {
    id: 'lennobe01w',
    name: 'Betty Lennox',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 23, G: 32, MP: 984, MP_pct: 0.766, PER: 21.6, TS_pct: 0.523, ThrPAr: 0.295, FTr: 0.223, ORB_pct: 7.4, TRB_pct: 12.6, AST_pct: 21.1, STL_pct: 3.1, BLK_pct: 0.9, TOV_pct: 15.8, USG_pct: 31, OWS: 1.9, DWS: 1.8, WS: 3.7, WS40: 0.152, MIN_pg: 30.8, PTS_pg: 16.9, REB_pg: 5.6, AST_pg: 2.6, STL_pg: 1.6, BLK_pg: 0.2, TOV_pg: 3, FG_pct: 0.427, FG3_pct: 0.396, FT_pct: 0.800 },
      2001: { team: 'MIN', age: 24, G: 11, MP: 241, MP_pct: 0.186, PER: 19.1, TS_pct: 0.509, ThrPAr: 0.473, FTr: 0.182, ORB_pct: 7, TRB_pct: 14.4, AST_pct: 19.1, STL_pct: 2.4, BLK_pct: 1.5, TOV_pct: 17.4, USG_pct: 29.3, OWS: 0.3, DWS: 0.4, WS: 0.7, WS40: 0.123, MIN_pg: 21.9, PTS_pg: 11, REB_pg: 4.9, AST_pg: 1.5, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 2.2, FG_pct: 0.373, FG3_pct: 0.385, FT_pct: 0.950 },
    },
  },
  'leslili01w': {
    id: 'leslili01w',
    name: 'Lisa Leslie',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 24, G: 28, MP: 902, MP_pct: 0.788, PER: 21.6, TS_pct: 0.49, ThrPAr: 0.124, FTr: 0.509, ORB_pct: 9, TRB_pct: 17.8, AST_pct: 15.9, STL_pct: 2.2, BLK_pct: 5.1, TOV_pct: 19.4, USG_pct: 27.7, OWS: 1.4, DWS: 2.2, WS: 3.5, WS40: 0.157, MIN_pg: 32.2, PTS_pg: 15.9, REB_pg: 9.5, AST_pg: 2.6, STL_pg: 1.4, BLK_pg: 2.1, FG_pct: 0.431, FG3_pct: 0.261, FT_pct: 0.598 },
      1998: { team: 'LAS', age: 25, G: 28, MP: 898, MP_pct: 0.745, PER: 28.5, TS_pct: 0.548, ThrPAr: 0.054, FTr: 0.418, ORB_pct: 10.3, TRB_pct: 18.9, AST_pct: 17.9, STL_pct: 2.5, BLK_pct: 5.3, TOV_pct: 16.9, USG_pct: 30, OWS: 3.6, DWS: 2.1, WS: 5.7, WS40: 0.255, MIN_pg: 32.1, PTS_pg: 19.6, REB_pg: 10.2, AST_pg: 2.5, STL_pg: 1.5, BLK_pg: 2.1, FG_pct: 0.478, FG3_pct: 0.391, FT_pct: 0.768 },
      1999: { team: 'LAS', age: 26, G: 32, MP: 930, MP_pct: 0.718, PER: 22.9, TS_pct: 0.546, ThrPAr: 0.134, FTr: 0.401, ORB_pct: 9.7, TRB_pct: 16.5, AST_pct: 12.2, STL_pct: 2.1, BLK_pct: 4.4, TOV_pct: 17, USG_pct: 27.2, OWS: 2.6, DWS: 1.9, WS: 4.4, WS40: 0.19, MIN_pg: 29.1, PTS_pg: 15.6, REB_pg: 7.8, AST_pg: 1.8, STL_pg: 1.1, BLK_pg: 1.5, FG_pct: 0.468, FG3_pct: 0.423, FT_pct: 0.731 },
      2000: { team: 'LAS', age: 27, G: 32, MP: 1028, MP_pct: 0.797, PER: 24.2, TS_pct: 0.548, ThrPAr: 0.074, FTr: 0.477, ORB_pct: 9.5, TRB_pct: 18.6, AST_pct: 12.3, STL_pct: 1.7, BLK_pct: 6, TOV_pct: 16.5, USG_pct: 28.7, OWS: 3, DWS: 3.2, WS: 6.1, WS40: 0.238, MIN_pg: 32.1, PTS_pg: 17.8, REB_pg: 9.6, AST_pg: 1.9, STL_pg: 1.0, BLK_pg: 2.3, FG_pct: 0.458, FG3_pct: 0.219, FT_pct: 0.824 },
      2001: { team: 'LAS', age: 28, G: 31, MP: 1033, MP_pct: 0.798, PER: 27.7, TS_pct: 0.549, ThrPAr: 0.128, FTr: 0.413, ORB_pct: 11.3, TRB_pct: 18.4, AST_pct: 14.3, STL_pct: 1.9, BLK_pct: 6.4, TOV_pct: 15.1, USG_pct: 29.8, OWS: 4.8, DWS: 2.2, WS: 7, WS40: 0.272, MIN_pg: 33.3, PTS_pg: 19.5, REB_pg: 9.6, AST_pg: 2.4, STL_pg: 1.1, BLK_pg: 2.3, FG_pct: 0.473, FG3_pct: 0.367, FT_pct: 0.736 },
      2002: { team: 'LAS', age: 29, G: 31, MIN_pg: 34.2, PTS_pg: 16.9, REB_pg: 10.4, AST_pg: 2.7, STL_pg: 1.5, BLK_pg: 2.9, FG_pct: 0.466, FG3_pct: 0.324, FT_pct: 0.727 },
      2003: { team: 'LAS', age: 30, G: 23, MIN_pg: 34.4, PTS_pg: 18.4, REB_pg: 10.0, AST_pg: 2.0, STL_pg: 1.3, BLK_pg: 2.7, FG_pct: 0.442, FG3_pct: 0.324, FT_pct: 0.617 },
      2004: { team: 'LAS', age: 31, G: 34, MIN_pg: 33.8, PTS_pg: 17.6, REB_pg: 9.9,  AST_pg: 2.6, STL_pg: 1.5, BLK_pg: 2.9, FG_pct: 0.494, FG3_pct: 0.273, FT_pct: 0.712 },
      2005: { team: 'LAS', age: 32, G: 34, MIN_pg: 32.2, PTS_pg: 15.2, REB_pg: 7.3,  AST_pg: 2.6, STL_pg: 2.0, BLK_pg: 2.1, FG_pct: 0.440, FG3_pct: 0.206, FT_pct: 0.586 },
      2006: { team: 'LAS', age: 33, G: 34, MIN_pg: 30.7, PTS_pg: 20.0, REB_pg: 9.5,  AST_pg: 3.2, STL_pg: 1.5, BLK_pg: 1.7, FG_pct: 0.511, FG3_pct: 0.400, FT_pct: 0.650 },
      2008: { team: 'LAS', age: 35, G: 33, MIN_pg: 32.1, PTS_pg: 15.1, REB_pg: 8.9,  AST_pg: 2.4, STL_pg: 1.5, BLK_pg: 2.9, FG_pct: 0.463, FG3_pct: 0.235, FT_pct: 0.661 },
      2009: { team: 'LAS', age: 36, G: 23, MIN_pg: 27.7, PTS_pg: 15.4, REB_pg: 6.6,  AST_pg: 2.1, STL_pg: 0.7, BLK_pg: 1.4, FG_pct: 0.518, FG3_pct: 0.167, FT_pct: 0.722 },
    },
  },
  'levanni01w': {
    id: 'levanni01w',
    name: 'Nicole Levandusky',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'LAS', age: 22, G: 13, MP: 67, MP_pct: 0.052, PER: 15.9, TS_pct: 0.446, ThrPAr: 0.773, FTr: 0.045, ORB_pct: 9.9, TRB_pct: 8.6, AST_pct: 17.3, STL_pct: 4.2, BLK_pct: 1.4, TOV_pct: 18.2, USG_pct: 19.4, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.111, MIN_pg: 5.2, PTS_pg: 1.5, REB_pg: 0.7, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.318, FG3_pct: 0.294, FT_pct: 1.000 },
    },
  },
  'levesni01w': {
    id: 'levesni01w',
    name: 'Nicole Levesque',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 25, G: 27, MP: 622, MP_pct: 0.555, PER: 6.8, TS_pct: 0.521, ThrPAr: 0.673, FTr: 0.153, ORB_pct: 1, TRB_pct: 4.7, AST_pct: 20.6, STL_pct: 1.9, BLK_pct: 0.4, TOV_pct: 40.4, USG_pct: 13.4, OWS: -0.6, DWS: 0.5, WS: -0.1, WS40: -0.007, MIN_pg: 23, PTS_pg: 4, REB_pg: 1.7, AST_pg: 2.8, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2.6, FG_pct: 0.367, FG3_pct: 0.348, FT_pct: 0.933 },
    },
  },
  'lewisty01w': {
    id: 'lewisty01w',
    name: 'Tynesha Lewis',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'HOU', age: 22, G: 29, MP: 419, MP_pct: 0.325, PER: 10.3, TS_pct: 0.488, ThrPAr: 0.217, FTr: 0.185, ORB_pct: 6.3, TRB_pct: 9.4, AST_pct: 7.4, STL_pct: 1.6, BLK_pct: 0.9, TOV_pct: 20.7, USG_pct: 15, OWS: 0.1, DWS: 0.5, WS: 0.6, WS40: 0.058, MIN_pg: 14.4, PTS_pg: 3.3, REB_pg: 2.1, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.424, FG3_pct: 0.400, FT_pct: 0.647 },
      2002: { G: 17, MIN_pg: 8.5, PTS_pg: 2, REB_pg: 1.1, AST_pg: 0.5, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.5, FG_pct: 0.433, FG3_pct: 0.375, FT_pct: 0.625 },
    },
  },
  'liebena01w': {
    id: 'liebena01w',
    name: 'Nancy Lieberman',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 38, G: 25, MP: 279, MP_pct: 0.246, PER: 6.6, TS_pct: 0.393, ThrPAr: 0.338, FTr: 0.13, ORB_pct: 2.5, TRB_pct: 7.1, AST_pct: 29.1, STL_pct: 2.9, BLK_pct: 0.6, TOV_pct: 32.4, USG_pct: 19.4, OWS: -0.7, DWS: 0.6, WS: -0.2, WS40: -0.024, MIN_pg: 11.2, PTS_pg: 2.6, REB_pg: 1.3, AST_pg: 1.6, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 1.6, FG_pct: 0.325, FG3_pct: 0.231, FT_pct: 0.800 },
    },
  },
  'lloydan01w': {
    id: 'lloydan01w',
    name: 'Andrea Lloyd Curry',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 33, G: 32, MP: 899, MP_pct: 0.694, PER: 12.1, TS_pct: 0.487, ThrPAr: 0.45, FTr: 0.225, ORB_pct: 5.3, TRB_pct: 10.3, AST_pct: 20.5, STL_pct: 2, BLK_pct: 1.3, TOV_pct: 22, USG_pct: 15.8, OWS: 0.5, DWS: 1.2, WS: 1.7, WS40: 0.074, MIN_pg: 28.1, PTS_pg: 6.7, REB_pg: 4.3, AST_pg: 2.8, STL_pg: 0.9, BLK_pg: 0.4, TOV_pg: 1.9, FG_pct: 0.375, FG3_pct: 0.333, FT_pct: 0.756 },
      2000: { team: 'MIN', age: 34, G: 14, MP: 333, MP_pct: 0.259, PER: 9.2, TS_pct: 0.497, ThrPAr: 0.471, FTr: 0.25, ORB_pct: 5.8, TRB_pct: 9, AST_pct: 12.7, STL_pct: 2.1, BLK_pct: 0.6, TOV_pct: 24.1, USG_pct: 14.8, OWS: 0, DWS: 0.4, WS: 0.4, WS40: 0.045, MIN_pg: 23.8, PTS_pg: 5.4, REB_pg: 3.1, AST_pg: 1.6, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.382, FG3_pct: 0.344, FT_pct: 0.706 },
    },
  },
  'lobore01w': {
    id: 'lobore01w',
    name: 'Rebecca Lobo',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 23, G: 28, MP: 939, MP_pct: 0.827, PER: 14.3, TS_pct: 0.435, ThrPAr: 0.178, FTr: 0.297, ORB_pct: 8.1, TRB_pct: 13.3, AST_pct: 11.7, STL_pct: 1.5, BLK_pct: 4.5, TOV_pct: 18, USG_pct: 23.4, OWS: 0, DWS: 2, WS: 1.9, WS40: 0.083, MIN_pg: 33.5, PTS_pg: 12.4, REB_pg: 7.3, AST_pg: 1.9, STL_pg: 0.9, BLK_pg: 1.8, TOV_pg: 3.1, FG_pct: 0.376, FG3_pct: 0.286, FT_pct: 0.610 },
      1998: { team: 'NYL', age: 24, G: 30, MP: 875, MP_pct: 0.723, PER: 18.4, TS_pct: 0.544, ThrPAr: 0.139, FTr: 0.331, ORB_pct: 10.3, TRB_pct: 15.6, AST_pct: 10.7, STL_pct: 1.1, BLK_pct: 3.3, TOV_pct: 17.2, USG_pct: 21, OWS: 2.2, DWS: 1.6, WS: 3.8, WS40: 0.173, MIN_pg: 29.2, PTS_pg: 11.7, REB_pg: 6.9, AST_pg: 1.5, STL_pg: 0.6, BLK_pg: 1.1, TOV_pg: 2.2, FG_pct: 0.484, FG3_pct: 0.308, FT_pct: 0.710 },
      1999: { team: 'NYL', age: 25, G: 1, MP: 1, MP_pct: 0.001, PER: -20.1, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 100, TRB_pct: 67.8, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 100, USG_pct: 49.6, OWS: 0, DWS: 0, WS: 0, WS40: -1.148, MIN_pg: 1, PTS_pg: 0, REB_pg: 0, AST_pg: 1, STL_pg: 0, BLK_pg: 0, FG_pct: 1.000, FG3_pct: 0.000, FT_pct: 0.000 },
      2001: { team: 'NYL', age: 27, G: 16, MP: 85, MP_pct: 0.066, PER: -0.2, TS_pct: 0.358, ThrPAr: 0.091, FTr: 0.182, ORB_pct: 3.2, TRB_pct: 11.1, AST_pct: 2.1, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 22.8, USG_pct: 18.6, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.11, MIN_pg: 5.3, PTS_pg: 1.1, REB_pg: 0.9, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.318, FG3_pct: 0.500, FT_pct: 0.500 },
    },
  },
  'lovelst01w': {
    id: 'lovelst01w',
    name: 'Stacey Lovelace',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 25, G: 23, MP: 324, MP_pct: 0.25, PER: 8.5, TS_pct: 0.424, ThrPAr: 0.087, FTr: 0.301, ORB_pct: 7.8, TRB_pct: 12.6, AST_pct: 12.2, STL_pct: 2.4, BLK_pct: 0.6, TOV_pct: 23.1, USG_pct: 24.1, OWS: -0.9, DWS: 0.4, WS: -0.5, WS40: -0.065, MIN_pg: 14.1, PTS_pg: 4.3, REB_pg: 2.5, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.350, FG3_pct: 0.222, FT_pct: 0.806 },
      2001: { team: 'SEA', age: 26, G: 22, MP: 211, MP_pct: 0.161, PER: 14.2, TS_pct: 0.484, ThrPAr: 0.366, FTr: 0.239, ORB_pct: 8.2, TRB_pct: 10.2, AST_pct: 10.7, STL_pct: 2.3, BLK_pct: 2.2, TOV_pct: 18.7, USG_pct: 23.8, OWS: 0, DWS: 0.2, WS: 0.3, WS40: 0.047, MIN_pg: 9.6, PTS_pg: 3.5, REB_pg: 1.5, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0.2, TOV_pg: 0.8, FG_pct: 0.380, FG3_pct: 0.385, FT_pct: 0.706 },
    },
  },
  'luckepa01w': {
    id: 'luckepa01w',
    name: 'Pat Luckey',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 26, G: 1, MP: 8, MP_pct: 0.006, PER: 7.8, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 8.2, AST_pct: 21, STL_pct: 0, BLK_pct: 10.7, TOV_pct: 0, USG_pct: 6, OWS: 0, DWS: 0, WS: 0, WS40: -0.036, MIN_pg: 3.6, PTS_pg: 1.3, REB_pg: 0.4, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.2, FG_pct: 0.300, FG3_pct: 0.154, FT_pct: 0.750 },
    },
  },
  'luzhe01w': {
    id: 'luzhe01w',
    name: 'Helen Luz',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'WAS', age: 28, G: 32, MP: 489, MP_pct: 0.376, PER: 16.2, TS_pct: 0.558, ThrPAr: 0.603, FTr: 0.184, ORB_pct: 2.4, TRB_pct: 4.6, AST_pct: 24.7, STL_pct: 3.4, BLK_pct: 0.9, TOV_pct: 22.6, USG_pct: 19.2, OWS: 0.9, DWS: 0.6, WS: 1.5, WS40: 0.12, MIN_pg: 15.3, PTS_pg: 5.1, REB_pg: 1.2, AST_pg: 1.7, STL_pg: 0.9, BLK_pg: 0.2, TOV_pg: 1.3, FG_pct: 0.404, FG3_pct: 0.390, FT_pct: 0.880 },
    },
  },
  'mabikmw01w': {
    id: 'mabikmw01w',
    name: 'Mwadi Mabika',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 20, G: 21, MP: 325, MP_pct: 0.284, PER: 14.2, TS_pct: 0.43, ThrPAr: 0.279, FTr: 0.176, ORB_pct: 8.7, TRB_pct: 10.1, AST_pct: 12.8, STL_pct: 3.7, BLK_pct: 1.4, TOV_pct: 15.6, USG_pct: 23.7, OWS: 0.1, DWS: 0.5, WS: 0.6, WS40: 0.078, MIN_pg: 15.5, PTS_pg: 6.0, REB_pg: 2.6, AST_pg: 1.0, STL_pg: 1.1, BLK_pg: 0.3, FG_pct: 0.390, FG3_pct: 0.184, FT_pct: 0.542 },
      1998: { team: 'LAS', age: 21, G: 29, MP: 710, MP_pct: 0.589, PER: 12.7, TS_pct: 0.429, ThrPAr: 0.416, FTr: 0.167, ORB_pct: 4.9, TRB_pct: 10.7, AST_pct: 11.5, STL_pct: 2.2, BLK_pct: 1, TOV_pct: 11.8, USG_pct: 19.7, OWS: 0.6, DWS: 0.8, WS: 1.4, WS40: 0.079, MIN_pg: 24.5, PTS_pg: 8.2, REB_pg: 4.4, AST_pg: 1.5, STL_pg: 1.0, BLK_pg: 0.3, FG_pct: 0.339, FG3_pct: 0.308, FT_pct: 0.698 },
      1999: { team: 'LAS', age: 22, G: 32, MP: 938, MP_pct: 0.724, PER: 16.7, TS_pct: 0.469, ThrPAr: 0.435, FTr: 0.232, ORB_pct: 5.6, TRB_pct: 10.1, AST_pct: 21.6, STL_pct: 2.5, BLK_pct: 1.3, TOV_pct: 13.5, USG_pct: 20.9, OWS: 1.8, DWS: 1.3, WS: 3.1, WS40: 0.131, MIN_pg: 29.3, PTS_pg: 10.8, REB_pg: 4.8, AST_pg: 3.5, STL_pg: 1.4, BLK_pg: 0.5, FG_pct: 0.372, FG3_pct: 0.281, FT_pct: 0.718 },
      2000: { team: 'LAS', age: 23, G: 32, MP: 940, MP_pct: 0.729, PER: 20.4, TS_pct: 0.527, ThrPAr: 0.475, FTr: 0.266, ORB_pct: 6.3, TRB_pct: 11.9, AST_pct: 19.7, STL_pct: 3.4, BLK_pct: 1.6, TOV_pct: 12, USG_pct: 21.4, OWS: 3, DWS: 2.5, WS: 5.5, WS40: 0.233, MIN_pg: 29.4, PTS_pg: 12.3, REB_pg: 5.6, AST_pg: 3.1, STL_pg: 1.8, BLK_pg: 0.6, FG_pct: 0.388, FG3_pct: 0.384, FT_pct: 0.820 },
      2001: { team: 'LAS', age: 24, G: 28, MP: 828, MP_pct: 0.639, PER: 19.3, TS_pct: 0.538, ThrPAr: 0.48, FTr: 0.309, ORB_pct: 3.5, TRB_pct: 10, AST_pct: 17.9, STL_pct: 2.7, BLK_pct: 1.2, TOV_pct: 13.1, USG_pct: 19.2, OWS: 3.2, DWS: 1.1, WS: 4.3, WS40: 0.209, MIN_pg: 29.6, PTS_pg: 11.2, REB_pg: 4.6, AST_pg: 3.1, STL_pg: 1.4, BLK_pg: 0.4, FG_pct: 0.387, FG3_pct: 0.382, FT_pct: 0.861 },
      2002: { team: 'LAS', age: 25, G: 32, MIN_pg: 32.8, PTS_pg: 16.8, REB_pg: 5.2, AST_pg: 2.9, STL_pg: 1.2, BLK_pg: 0.3, FG_pct: 0.423, FG3_pct: 0.366, FT_pct: 0.839 },
      2003: { team: 'LAS', age: 26, G: 32, MIN_pg: 32.6, PTS_pg: 13.8, REB_pg: 4.4, AST_pg: 2.6, STL_pg: 0.9, BLK_pg: 0.6, FG_pct: 0.407, FG3_pct: 0.264, FT_pct: 0.866 },
      2004: { team: 'LAS', age: 27, G: 31, MIN_pg: 31.1, PTS_pg: 14.4, REB_pg: 3.9, AST_pg: 2.4, STL_pg: 1.2, BLK_pg: 0.1, FG_pct: 0.415, FG3_pct: 0.404, FT_pct: 0.824 },
      2005: { team: 'LAS', age: 28, G: 17, MIN_pg: 21.6, PTS_pg: 5.8, REB_pg: 1.6, AST_pg: 1.7, STL_pg: 0.9, BLK_pg: 0.0, FG_pct: 0.320, FG3_pct: 0.224, FT_pct: 0.500 },
      2006: { team: 'LAS', age: 29, G: 32, MIN_pg: 21.2, PTS_pg: 8.5, REB_pg: 2.0, AST_pg: 1.5, STL_pg: 0.6, BLK_pg: 0.2, FG_pct: 0.377, FG3_pct: 0.333, FT_pct: 0.889 },
      2007: { team: 'LAS', age: 30, G: 33, MIN_pg: 23.1, PTS_pg: 8.1, REB_pg: 3.8, AST_pg: 2.2, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.364, FG3_pct: 0.310, FT_pct: 0.754 },
      2008: { team: 'HOU', age: 31, G: 20, MIN_pg: 16.4, PTS_pg: 4.6, REB_pg: 1.9, AST_pg: 0.9, STL_pg: 0.5, BLK_pg: 0.0, FG_pct: 0.303, FG3_pct: 0.274, FT_pct: 0.714 },
    },
  },
  'machacl01w': {
    id: 'machacl01w',
    name: 'Clarisse Machanguana',
    position: 'C-F',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 22, G: 28, MP: 245, MP_pct: 0.189, PER: 14, TS_pct: 0.571, ThrPAr: 0, FTr: 0.735, ORB_pct: 8.1, TRB_pct: 13.1, AST_pct: 6.2, STL_pct: 1.8, BLK_pct: 1, TOV_pct: 17.8, USG_pct: 14.7, OWS: 0.6, DWS: 0.3, WS: 0.9, WS40: 0.143, MIN_pg: 8.8, PTS_pg: 2.6, REB_pg: 1.9, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.490, FG3_pct: 0.000, FT_pct: 0.722 },
      2000: { team: 'LAS', age: 23, G: 31, MP: 421, MP_pct: 0.326, PER: 11.7, TS_pct: 0.585, ThrPAr: 0.012, FTr: 0.301, ORB_pct: 6.2, TRB_pct: 10.7, AST_pct: 7.7, STL_pct: 1.7, BLK_pct: 0.8, TOV_pct: 16.8, USG_pct: 12.7, OWS: 0.7, DWS: 0.8, WS: 1.5, WS40: 0.142, MIN_pg: 13.6, PTS_pg: 3.5, REB_pg: 2.3, AST_pg: 0.6, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.578, FG3_pct: 0.000, FT_pct: 0.560 },
      2001: { team: 'CHA', age: 24, G: 30, MP: 580, MP_pct: 0.446, PER: 12.7, TS_pct: 0.539, ThrPAr: 0, FTr: 0.452, ORB_pct: 8.7, TRB_pct: 14.6, AST_pct: 6.3, STL_pct: 1.7, BLK_pct: 2.4, TOV_pct: 21.3, USG_pct: 17.3, OWS: 0.7, DWS: 0.9, WS: 1.6, WS40: 0.108, MIN_pg: 19.3, PTS_pg: 5.4, REB_pg: 4, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.5, TOV_pg: 1.4, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.649 },
    },
  },
  'mahonsh01w': {
    id: 'mahonsh01w',
    name: 'Shea Mahoney',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'NYL', age: 22, G: 15, MP: 158, MP_pct: 0.123, PER: 5.3, TS_pct: 0.325, ThrPAr: 0.132, FTr: 0.211, ORB_pct: 8.7, TRB_pct: 12.8, AST_pct: 4.6, STL_pct: 0.8, BLK_pct: 0.6, TOV_pct: 10.7, USG_pct: 14.9, OWS: -0.2, DWS: 0.2, WS: 0, WS40: 0.001 },
    },
  },
  'malcona01w': {
    id: 'malcona01w',
    name: 'Nadine Malcolm',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'IND', age: 25, G: 31, MP: 705, MP_pct: 0.544, PER: 13.4, TS_pct: 0.537, ThrPAr: 0.264, FTr: 0.292, ORB_pct: 6, TRB_pct: 8.8, AST_pct: 8, STL_pct: 1.1, BLK_pct: 0.4, TOV_pct: 16.7, USG_pct: 20.5, OWS: 1.4, DWS: -0.2, WS: 1.2, WS40: 0.066 },
    },
  },
  'mannish01w': {
    id: 'mannish01w',
    name: 'Sharon Manning',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 28, G: 28, MP: 438, MP_pct: 0.391, PER: 15.5, TS_pct: 0.466, ThrPAr: 0, FTr: 0.4, ORB_pct: 12.3, TRB_pct: 13.9, AST_pct: 5.8, STL_pct: 3.1, BLK_pct: 1, TOV_pct: 16.5, USG_pct: 19.1, OWS: 0.3, DWS: 0.8, WS: 1.1, WS40: 0.102, MIN_pg: 15.6, PTS_pg: 4.9, REB_pg: 3.5, AST_pg: 0.5, STL_pg: 0.9, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.464, FT_pct: 0.420 },
      1998: { team: 'CHA', age: 29, G: 30, MP: 575, MP_pct: 0.479, PER: 15.8, TS_pct: 0.497, ThrPAr: 0.015, FTr: 0.493, ORB_pct: 12.9, TRB_pct: 17.8, AST_pct: 9.3, STL_pct: 3, BLK_pct: 1, TOV_pct: 20.9, USG_pct: 16.6, OWS: 0.7, DWS: 1.3, WS: 2, WS40: 0.141, MIN_pg: 19.2, PTS_pg: 5.4, REB_pg: 5.5, AST_pg: 1, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 1.4, FG_pct: 0.440, FG3_pct: 0.000, FT_pct: 0.667 },
      1999: { team: 'CHA', age: 30, G: 32, MP: 521, MP_pct: 0.405, PER: 14.9, TS_pct: 0.522, ThrPAr: 0.009, FTr: 0.407, ORB_pct: 10.2, TRB_pct: 14.8, AST_pct: 6.4, STL_pct: 3.2, BLK_pct: 0.7, TOV_pct: 16.8, USG_pct: 15.7, OWS: 0.6, DWS: 0.8, WS: 1.4, WS40: 0.109, MIN_pg: 16.3, PTS_pg: 4.3, REB_pg: 3.6, AST_pg: 0.5, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.504, FG3_pct: 1.000, FT_pct: 0.522 },
      2000: { team: 'MIA', age: 31, G: 24, MP: 403, MP_pct: 0.311, PER: 12.6, TS_pct: 0.498, ThrPAr: 0.022, FTr: 0.283, ORB_pct: 13, TRB_pct: 17.1, AST_pct: 10.8, STL_pct: 3.5, BLK_pct: 0.9, TOV_pct: 27.4, USG_pct: 17.7, OWS: -0.4, DWS: 1, WS: 0.7, WS40: 0.065, MIN_pg: 16.8, PTS_pg: 4.3, REB_pg: 4.2, AST_pg: 0.7, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 1.6, FG_pct: 0.478, FG3_pct: 0.500, FT_pct: 0.538 },
    },
  },
  'mapprh01w': {
    id: 'mapprh01w',
    name: 'Rhonda Mapp',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 27, G: 28, MP: 710, MP_pct: 0.634, PER: 20.9, TS_pct: 0.561, ThrPAr: 0.033, FTr: 0.434, ORB_pct: 9.5, TRB_pct: 13.5, AST_pct: 19.1, STL_pct: 1.6, BLK_pct: 1.4, TOV_pct: 19, USG_pct: 24, OWS: 2.7, DWS: 1, WS: 3.7, WS40: 0.209 },
      1998: { team: 'CHA', age: 28, G: 21, MP: 456, MP_pct: 0.38, PER: 19.7, TS_pct: 0.557, ThrPAr: 0.061, FTr: 0.366, ORB_pct: 9.5, TRB_pct: 12, AST_pct: 15, STL_pct: 1.5, BLK_pct: 1.4, TOV_pct: 17, USG_pct: 23.3, OWS: 1.4, DWS: 0.6, WS: 2, WS40: 0.179 },
      1999: { team: 'CHA', age: 29, G: 30, MP: 790, MP_pct: 0.615, PER: 17.5, TS_pct: 0.538, ThrPAr: 0.038, FTr: 0.288, ORB_pct: 8.7, TRB_pct: 16.5, AST_pct: 15.2, STL_pct: 1.9, BLK_pct: 1.4, TOV_pct: 18.4, USG_pct: 21.1, OWS: 1.3, DWS: 1.2, WS: 2.5, WS40: 0.126 },
      2000: { team: 'CHA', age: 30, G: 30, MP: 856, MP_pct: 0.661, PER: 19.6, TS_pct: 0.527, ThrPAr: 0.073, FTr: 0.293, ORB_pct: 9.4, TRB_pct: 16.1, AST_pct: 16.1, STL_pct: 2, BLK_pct: 2.4, TOV_pct: 14.8, USG_pct: 22.7, OWS: 2.1, DWS: 0.3, WS: 2.4, WS40: 0.113 },
      2001: { team: 'LAS', age: 31, G: 30, MP: 395, MP_pct: 0.305, PER: 12.5, TS_pct: 0.46, ThrPAr: 0.024, FTr: 0.26, ORB_pct: 11.4, TRB_pct: 12.8, AST_pct: 6.1, STL_pct: 2.3, BLK_pct: 1.4, TOV_pct: 15.4, USG_pct: 19.5, OWS: 0.5, DWS: 0.5, WS: 0.9, WS40: 0.094 },
    },
  },
  'marcimi01w': {
    id: 'marcimi01w',
    name: 'Michelle Marciniak',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'POR', age: 26, G: 32, MP: 537, MP_pct: 0.411, PER: 11.6, TS_pct: 0.473, ThrPAr: 0.351, FTr: 0.487, ORB_pct: 2.8, TRB_pct: 7.6, AST_pct: 28.6, STL_pct: 3.9, BLK_pct: 1, TOV_pct: 26.4, USG_pct: 22.6, OWS: -0.6, DWS: 0.8, WS: 0.2, WS40: 0.018 },
      2001: { team: 'SEA', age: 27, G: 27, MP: 392, MP_pct: 0.299, PER: 15.2, TS_pct: 0.425, ThrPAr: 0.237, FTr: 0.266, ORB_pct: 5.3, TRB_pct: 6.5, AST_pct: 30.3, STL_pct: 4.7, BLK_pct: 0.5, TOV_pct: 16.2, USG_pct: 24.6, OWS: -0.1, DWS: 0.6, WS: 0.5, WS40: 0.051 },
    },
  },
  'martima01w': {
    id: 'martima01w',
    name: 'Maylana Martin',
    position: 'C-F',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 22, G: 30, MP: 456, MP_pct: 0.355, PER: 11.1, TS_pct: 0.5, ThrPAr: 0.161, FTr: 0.271, ORB_pct: 7.5, TRB_pct: 10.2, AST_pct: 9.6, STL_pct: 2.1, BLK_pct: 2.9, TOV_pct: 18, USG_pct: 17.5, OWS: 0.2, DWS: 0.7, WS: 0.8, WS40: 0.075, MIN_pg: 17.4, PTS_pg: 3.6, REB_pg: 2.5, AST_pg: 2.1, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.394, FG3_pct: 0.333, FT_pct: 0.773 },
      2001: { team: 'MIN', age: 23, G: 31, MP: 494, MP_pct: 0.381, PER: 5.7, TS_pct: 0.407, ThrPAr: 0.175, FTr: 0.301, ORB_pct: 7.1, TRB_pct: 11.2, AST_pct: 8.6, STL_pct: 2, BLK_pct: 2.7, TOV_pct: 24.1, USG_pct: 15.3, OWS: -0.7, DWS: 0.6, WS: -0.1, WS40: -0.009, MIN_pg: 33, PTS_pg: 11.2, REB_pg: 3.1, AST_pg: 3.1, STL_pg: 1.5, BLK_pg: 0.2, TOV_pg: 2.5, FG_pct: 0.402, FG3_pct: 0.382, FT_pct: 0.755 },
      1999: { G: 18, MIN_pg: 14.2, PTS_pg: 2.6, REB_pg: 1.3, AST_pg: 1.8, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.515, FG3_pct: 0.111, FT_pct: 0.545 },
    },
  },
  'maxwean01w': {
    id: 'maxwean01w',
    name: 'Anita Maxwell',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 23, G: 9, MP: 63, MP_pct: 0.056, PER: 11.2, TS_pct: 0.345, ThrPAr: 0, FTr: 0.333, ORB_pct: 4.3, TRB_pct: 12.3, AST_pct: 24.8, STL_pct: 3.5, BLK_pct: 0, TOV_pct: 17.9, USG_pct: 24.8, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.021, MIN_pg: 7.2, PTS_pg: 1.7, REB_pg: 0.9, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.364, FG3_pct: 0.000, FT_pct: 0.500 },
    },
  },
  'maxwemo01w': {
    id: 'maxwemo01w',
    name: 'Monica Maxwell',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 22, G: 20, MP: 141, MP_pct: 0.109, PER: 4.7, TS_pct: 0.315, ThrPAr: 0.66, FTr: 0.18, ORB_pct: 2.9, TRB_pct: 10.1, AST_pct: 14, STL_pct: 2, BLK_pct: 0.6, TOV_pct: 16.9, USG_pct: 22.4, OWS: -0.5, DWS: 0.2, WS: -0.3, WS40: -0.098 },
      2000: { team: 'IND', age: 23, G: 32, MP: 1029, MP_pct: 0.801, PER: 15.1, TS_pct: 0.535, ThrPAr: 0.547, FTr: 0.204, ORB_pct: 5.4, TRB_pct: 10.6, AST_pct: 11.9, STL_pct: 2.7, BLK_pct: 1.3, TOV_pct: 17.1, USG_pct: 17.9, OWS: 1.7, DWS: 0.8, WS: 2.5, WS40: 0.099 },
      2001: { team: 'IND', age: 24, G: 15, MP: 238, MP_pct: 0.184, PER: 5.8, TS_pct: 0.403, ThrPAr: 0.585, FTr: 0.226, ORB_pct: 6.9, TRB_pct: 10.9, AST_pct: 11.3, STL_pct: 1.2, BLK_pct: 1.1, TOV_pct: 27.4, USG_pct: 17, OWS: -0.4, DWS: 0, WS: -0.4, WS40: -0.075 },
    },
  },
  'mccaiti01w': {
    id: 'mccaiti01w',
    name: 'Tiffany McCain',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 22, G: 25, MP: 214, MP_pct: 0.165, PER: 5.7, TS_pct: 0.448, ThrPAr: 0.449, FTr: 0.367, ORB_pct: 1.2, TRB_pct: 3.4, AST_pct: 4.1, STL_pct: 0.8, BLK_pct: 0.4, TOV_pct: 13.7, USG_pct: 15.2, OWS: 0, DWS: 0, WS: 0, WS40: -0.004 },
      2001: { team: 'ORL', age: 23, G: 32, MP: 442, MP_pct: 0.343, PER: 6, TS_pct: 0.429, ThrPAr: 0.615, FTr: 0.083, ORB_pct: 2, TRB_pct: 5.7, AST_pct: 15.8, STL_pct: 1.3, BLK_pct: 1.7, TOV_pct: 23.1, USG_pct: 15.9, OWS: -0.3, DWS: 0, WS: -0.3, WS40: -0.026 },
    },
  },
  'mccarst01w': {
    id: 'mccarst01w',
    name: 'Stephanie White',
    position: 'G-F',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 22, G: 30, MP: 563, MP_pct: 0.438, PER: 12.8, TS_pct: 0.55, ThrPAr: 0.5, FTr: 0.254, ORB_pct: 4.1, TRB_pct: 5.9, AST_pct: 17.7, STL_pct: 2, BLK_pct: 0.3, TOV_pct: 20.8, USG_pct: 16.6, OWS: 0.9, DWS: 0.3, WS: 1.1, WS40: 0.08, MIN_pg: 14.2, PTS_pg: 2.6, REB_pg: 1.3, AST_pg: 1.8, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 1.1, FG_pct: 0.515, FG3_pct: 0.111, FT_pct: 0.545 },
      2000: { team: 'IND', age: 23, G: 32, MP: 635, MP_pct: 0.494, PER: 16.5, TS_pct: 0.564, ThrPAr: 0.422, FTr: 0.518, ORB_pct: 3.1, TRB_pct: 6.4, AST_pct: 17.4, STL_pct: 2.8, BLK_pct: 0.8, TOV_pct: 18.7, USG_pct: 19.5, OWS: 1.6, DWS: 0.3, WS: 1.9, WS40: 0.118 },
      2001: { team: 'IND', age: 24, G: 30, MP: 504, MP_pct: 0.389, PER: 17.2, TS_pct: 0.524, ThrPAr: 0.416, FTr: 0.401, ORB_pct: 3.5, TRB_pct: 7.4, AST_pct: 23.7, STL_pct: 3, BLK_pct: 2.3, TOV_pct: 19.1, USG_pct: 19.9, OWS: 1.1, DWS: 0.3, WS: 1.4, WS40: 0.111 },
    },
  },
  'mcconsu01w': {
    id: 'mcconsu01w',
    name: 'Suzie McConnell Serio',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'CLE', age: 31, G: 28, MP: 882, MP_pct: 0.726, PER: 15.2, TS_pct: 0.58, ThrPAr: 0.403, FTr: 0.398, ORB_pct: 1.3, TRB_pct: 4.7, AST_pct: 35.3, STL_pct: 3, BLK_pct: 0.5, TOV_pct: 33.5, USG_pct: 17, OWS: 1.1, DWS: 0.9, WS: 2.1, WS40: 0.093, MIN_pg: 31.5, PTS_pg: 8.6, REB_pg: 2.2, AST_pg: 6.4, STL_pg: 1.8, BLK_pg: 0.2, FG_pct: 0.455, FG3_pct: 0.408, FT_pct: 0.729 },
      1999: { team: 'CLE', age: 32, G: 18, MP: 511, MP_pct: 0.399, PER: 8.6, TS_pct: 0.508, ThrPAr: 0.612, FTr: 0.194, ORB_pct: 1, TRB_pct: 5.4, AST_pct: 28.2, STL_pct: 1.1, BLK_pct: 0.3, TOV_pct: 33.7, USG_pct: 15.2, OWS: -0.4, DWS: 0.2, WS: -0.2, WS40: -0.013, MIN_pg: 28.4, PTS_pg: 6.0, REB_pg: 2.4, AST_pg: 4.2, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.367, FG3_pct: 0.333, FT_pct: 0.842 },
      2000: { team: 'CLE', age: 33, G: 32, MP: 705, MP_pct: 0.542, PER: 12.2, TS_pct: 0.573, ThrPAr: 0.693, FTr: 0.179, ORB_pct: 1.8, TRB_pct: 5.1, AST_pct: 31.3, STL_pct: 1.3, BLK_pct: 0.1, TOV_pct: 31.4, USG_pct: 15.5, OWS: 0.8, DWS: 0.6, WS: 1.3, WS40: 0.076, MIN_pg: 22.0, PTS_pg: 5.4, REB_pg: 1.6, AST_pg: 3.7, STL_pg: 0.5, BLK_pg: 0.0, FG_pct: 0.414, FG3_pct: 0.392, FT_pct: 0.760 },
    },
  },
  'mccrani01w': {
    id: 'mccrani01w',
    name: 'Nikki McCray',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 26, G: 29, MP: 969, MP_pct: 0.804, PER: 16.3, TS_pct: 0.492, ThrPAr: 0.16, FTr: 0.313, ORB_pct: 4.1, TRB_pct: 5.4, AST_pct: 23.2, STL_pct: 2.3, BLK_pct: 0.2, TOV_pct: 19.4, USG_pct: 29.5, OWS: 0.8, DWS: -0.7, WS: 0.1, WS40: 0.004, MIN_pg: 33.4, PTS_pg: 17.7, REB_pg: 2.9, AST_pg: 3.1, STL_pg: 1.5, BLK_pg: 0.1, FG_pct: 0.419, FG3_pct: 0.319, FT_pct: 0.748 },
      1999: { team: 'WAS', age: 27, G: 32, MP: 1043, MP_pct: 0.805, PER: 18.7, TS_pct: 0.534, ThrPAr: 0.336, FTr: 0.352, ORB_pct: 4.6, TRB_pct: 5.3, AST_pct: 18.6, STL_pct: 1.9, BLK_pct: 0.1, TOV_pct: 16.9, USG_pct: 29.4, OWS: 2.6, DWS: 0.3, WS: 2.9, WS40: 0.111, MIN_pg: 32.6, PTS_pg: 17.5, REB_pg: 2.7, AST_pg: 2.4, STL_pg: 1.1, BLK_pg: 0.0, FG_pct: 0.424, FG3_pct: 0.301, FT_pct: 0.806 },
      2000: { team: 'WAS', age: 28, G: 32, MP: 1046, MP_pct: 0.817, PER: 18.1, TS_pct: 0.553, ThrPAr: 0.392, FTr: 0.382, ORB_pct: 3, TRB_pct: 3.7, AST_pct: 16.6, STL_pct: 2.5, BLK_pct: 0.4, TOV_pct: 16.5, USG_pct: 25.6, OWS: 2.8, DWS: 0.3, WS: 3.1, WS40: 0.117, MIN_pg: 32.7, PTS_pg: 15.5, REB_pg: 1.8, AST_pg: 2.7, STL_pg: 1.4, BLK_pg: 0.2, FG_pct: 0.434, FG3_pct: 0.331, FT_pct: 0.769 },
      2001: { team: 'WAS', age: 29, G: 32, MP: 828, MP_pct: 0.637, PER: 14.2, TS_pct: 0.507, ThrPAr: 0.328, FTr: 0.441, ORB_pct: 3.2, TRB_pct: 4.1, AST_pct: 13.4, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 17.4, USG_pct: 25, OWS: 1, DWS: 0.3, WS: 1.4, WS40: 0.067, MIN_pg: 25.9, PTS_pg: 11.0, REB_pg: 1.8, AST_pg: 1.5, STL_pg: 0.8, BLK_pg: 0.0, FG_pct: 0.410, FG3_pct: 0.232, FT_pct: 0.711 },
      2002: { team: 'IND', age: 30, G: 32, MIN_pg: 33.1, PTS_pg: 11.5, REB_pg: 3.0, AST_pg: 2.2, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.415, FG3_pct: 0.318, FT_pct: 0.816 },
      2003: { team: 'IND', age: 31, G: 34, MIN_pg: 21.6, PTS_pg: 3.9, REB_pg: 1.5, AST_pg: 1.4, STL_pg: 1.1, BLK_pg: 0.1, FG_pct: 0.377, FG3_pct: 0.219, FT_pct: 0.833 },
      2004: { team: 'PHO', age: 32, G: 27, MIN_pg: 13.7, PTS_pg: 2.6, REB_pg: 1.1, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.0, FG_pct: 0.448, FG3_pct: 0.455, FT_pct: 0.571 },
      2005: { team: 'SAN', age: 33, G: 23, MIN_pg: 13.1, PTS_pg: 1.7, REB_pg: 0.9, AST_pg: 0.7, STL_pg: 0.5, BLK_pg: 0.0, FG_pct: 0.242, FG3_pct: 0.050, FT_pct: 0.636 },
      2006: { team: 'CHI', age: 34, G: 11, MIN_pg: 7.5, PTS_pg: 2.0, REB_pg: 0.5, AST_pg: 0.5, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.364, FG3_pct: 0.200, FT_pct: 0.714 },
    },
  },
  'mccrini01w': {
    id: 'mccrini01w',
    name: 'Nicky McCrimmon',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'LAS', age: 28, G: 32, MP: 488, MP_pct: 0.378, PER: 11.1, TS_pct: 0.607, ThrPAr: 0.429, FTr: 0.182, ORB_pct: 2.4, TRB_pct: 4.1, AST_pct: 22.7, STL_pct: 3.3, BLK_pct: 1.4, TOV_pct: 36.6, USG_pct: 12.7, OWS: 0, DWS: 0.9, WS: 1, WS40: 0.08 },
      2001: { team: 'LAS', age: 29, G: 28, MP: 350, MP_pct: 0.27, PER: 12.8, TS_pct: 0.484, ThrPAr: 0.19, FTr: 0.111, ORB_pct: 1.1, TRB_pct: 2.2, AST_pct: 28.7, STL_pct: 3.4, BLK_pct: 0, TOV_pct: 25, USG_pct: 11.9, OWS: 0.5, DWS: 0.2, WS: 0.8, WS40: 0.087 },
    },
  },
  'mcculda01w': {
    id: 'mcculda01w',
    name: 'Danielle McCulley',
    position: 'C-F',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 25, G: 29, MP: 456, MP_pct: 0.355, PER: 15.6, TS_pct: 0.484, ThrPAr: 0.111, FTr: 0.412, ORB_pct: 13.8, TRB_pct: 12.3, AST_pct: 8.7, STL_pct: 2, BLK_pct: 4.1, TOV_pct: 17, USG_pct: 23.5, OWS: 0.5, DWS: 0.3, WS: 0.7, WS40: 0.064 },
      2001: { team: 'IND', age: 26, G: 8, MP: 90, MP_pct: 0.069, PER: 12.4, TS_pct: 0.54, ThrPAr: 0.111, FTr: 1, ORB_pct: 6.1, TRB_pct: 12.9, AST_pct: 10.4, STL_pct: 0, BLK_pct: 1.9, TOV_pct: 21.3, USG_pct: 18.4, OWS: 0.2, DWS: 0, WS: 0.2, WS40: 0.088 },
    },
  },
  'mcgeepa01w': {
    id: 'mcgeepa01w',
    name: 'Pamela McGee',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 34, G: 27, MP: 691, MP_pct: 0.612, PER: 14.5, TS_pct: 0.525, ThrPAr: 0.032, FTr: 0.505, ORB_pct: 9.5, TRB_pct: 10.9, AST_pct: 6.1, STL_pct: 2.1, BLK_pct: 1.6, TOV_pct: 21.2, USG_pct: 22.3, OWS: 1.2, DWS: -0.1, WS: 1, WS40: 0.06, MIN_pg: 7.2, PTS_pg: 1.2, REB_pg: 1, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.250, FT_pct: 0.500 },
      1998: { team: 'LAS', age: 35, G: 30, MP: 570, MP_pct: 0.473, PER: 13.3, TS_pct: 0.475, ThrPAr: 0.022, FTr: 0.383, ORB_pct: 13.1, TRB_pct: 15.2, AST_pct: 4.4, STL_pct: 2.1, BLK_pct: 3.3, TOV_pct: 20.2, USG_pct: 21, OWS: 0.2, DWS: 0.8, WS: 1, WS40: 0.069, MIN_pg: 17.8, PTS_pg: 3.3, REB_pg: 2.9, AST_pg: 0.3, STL_pg: 0.9, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.451, FG3_pct: 0.500, FT_pct: 0.805 },
      1999: { G: 23, MIN_pg: 5, PTS_pg: 1.1, REB_pg: 0.6, AST_pg: 0, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.476, FG3_pct: 0.000, FT_pct: 0.500 },
    },
  },
  'mcgheca01w': {
    id: 'mcgheca01w',
    name: 'Carla McGhee',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 31, G: 30, MP: 234, MP_pct: 0.181, PER: 5.7, TS_pct: 0.41, ThrPAr: 0, FTr: 0.383, ORB_pct: 12.2, TRB_pct: 12.9, AST_pct: 6.2, STL_pct: 1.9, BLK_pct: 1.1, TOV_pct: 28.6, USG_pct: 15.8, OWS: -0.4, DWS: 0.2, WS: -0.1, WS40: -0.024 },
      2000: { team: 'ORL', age: 32, G: 32, MP: 408, MP_pct: 0.314, PER: 8.9, TS_pct: 0.434, ThrPAr: 0.036, FTr: 0.47, ORB_pct: 8.7, TRB_pct: 10.5, AST_pct: 9.9, STL_pct: 3, BLK_pct: 1.1, TOV_pct: 23.6, USG_pct: 15.8, OWS: -0.3, DWS: 0.4, WS: 0.2, WS40: 0.016, MIN_pg: 13.2, PTS_pg: 4.5, REB_pg: 1.5, AST_pg: 0.3, STL_pg: 0.2, BLK_pg: 0.3, TOV_pg: 1.4, FG_pct: 0.594, FG3_pct: 0.667, FT_pct: 0.750 },
      2001: { team: 'ORL', age: 33, G: 17, MP: 71, MP_pct: 0.055, PER: -2.9, TS_pct: 0.272, ThrPAr: 0, FTr: 0.167, ORB_pct: 5.4, TRB_pct: 9.3, AST_pct: 0, STL_pct: 0.8, BLK_pct: 1.3, TOV_pct: 18.9, USG_pct: 21.3, OWS: -0.4, DWS: 0, WS: -0.4, WS40: -0.21 },
    },
  },
  'mcwilta01w': {
    id: 'mcwilta01w',
    name: 'Taj McWilliams-Franklin',
    position: 'F-C',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 28, G: 32, MP: 1042, MP_pct: 0.808, PER: 21.3, TS_pct: 0.551, ThrPAr: 0.141, FTr: 0.442, ORB_pct: 10.1, TRB_pct: 15, AST_pct: 10.5, STL_pct: 3.1, BLK_pct: 3.2, TOV_pct: 17.4, USG_pct: 21.3, OWS: 2.6, DWS: 1.9, WS: 4.6, WS40: 0.175, MIN_pg: 32.6, PTS_pg: 13.1, REB_pg: 7.5, AST_pg: 1.6, STL_pg: 1.8, BLK_pg: 1.2, TOV_pg: 2.5, FG_pct: 0.480, FG3_pct: 0.444, FT_pct: 0.667 },
      2000: { team: 'ORL', age: 29, G: 32, MP: 1098, MP_pct: 0.845, PER: 21.8, TS_pct: 0.571, ThrPAr: 0.052, FTr: 0.37, ORB_pct: 10.8, TRB_pct: 14.9, AST_pct: 10.2, STL_pct: 3.1, BLK_pct: 2.4, TOV_pct: 17.8, USG_pct: 21, OWS: 3, DWS: 1.8, WS: 4.7, WS40: 0.173, MIN_pg: 34.3, PTS_pg: 13.7, REB_pg: 7.6, AST_pg: 1.7, STL_pg: 1.8, BLK_pg: 1, TOV_pg: 2.5, FG_pct: 0.524, FG3_pct: 0.294, FT_pct: 0.713 },
      2001: { team: 'ORL', age: 30, G: 32, MP: 1059, MP_pct: 0.821, PER: 22.2, TS_pct: 0.527, ThrPAr: 0.03, FTr: 0.353, ORB_pct: 13.7, TRB_pct: 15.2, AST_pct: 14.6, STL_pct: 2.8, BLK_pct: 4.4, TOV_pct: 17.3, USG_pct: 20.8, OWS: 3.1, DWS: 1.2, WS: 4.4, WS40: 0.165, MIN_pg: 33.1, PTS_pg: 12.6, REB_pg: 7.6, AST_pg: 2.2, STL_pg: 1.6, BLK_pg: 1.6, TOV_pg: 2.5, FG_pct: 0.474, FG3_pct: 0.200, FT_pct: 0.744 },
    },
  },
  'melvich01w': {
    id: 'melvich01w',
    name: 'Chasity Melvin',
    position: 'C-F',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 23, G: 32, MP: 709, MP_pct: 0.554, PER: 15.8, TS_pct: 0.496, ThrPAr: 0.005, FTr: 0.45, ORB_pct: 10, TRB_pct: 11.6, AST_pct: 11.5, STL_pct: 1.6, BLK_pct: 2.7, TOV_pct: 13.9, USG_pct: 20.7, OWS: 1.2, DWS: 0.7, WS: 1.9, WS40: 0.108, MIN_pg: 22.2, PTS_pg: 8.1, REB_pg: 4, AST_pg: 1.2, STL_pg: 0.6, BLK_pg: 0.7, TOV_pg: 1.3, FG_pct: 0.438, FG3_pct: 1.000, FT_pct: 0.694 },
      2000: { team: 'CLE', age: 24, G: 32, MP: 904, MP_pct: 0.695, PER: 18.9, TS_pct: 0.534, ThrPAr: 0.024, FTr: 0.474, ORB_pct: 10.7, TRB_pct: 13.7, AST_pct: 14.3, STL_pct: 1.9, BLK_pct: 1.9, TOV_pct: 15.1, USG_pct: 22.6, OWS: 2.7, DWS: 1.4, WS: 4.1, WS40: 0.183, MIN_pg: 28.3, PTS_pg: 11.7, REB_pg: 5.4, AST_pg: 1.9, STL_pg: 0.9, BLK_pg: 0.6, TOV_pg: 1.9, FG_pct: 0.471, FG3_pct: 0.143, FT_pct: 0.730 },
      2001: { team: 'CLE', age: 25, G: 27, MP: 754, MP_pct: 0.587, PER: 19.5, TS_pct: 0.526, ThrPAr: 0.009, FTr: 0.4, ORB_pct: 12.6, TRB_pct: 14.2, AST_pct: 14.5, STL_pct: 2, BLK_pct: 2.1, TOV_pct: 15.1, USG_pct: 20.8, OWS: 2.3, DWS: 1.9, WS: 4.2, WS40: 0.225, MIN_pg: 27.9, PTS_pg: 9.9, REB_pg: 5.7, AST_pg: 1.9, STL_pg: 0.9, BLK_pg: 0.6, TOV_pg: 1.7, FG_pct: 0.474, FG3_pct: 1.000, FT_pct: 0.698 },
    },
  },
  'milleco01w': {
    id: 'milleco01w',
    name: 'Coco Miller',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'WAS', age: 22, G: 20, MP: 137, MP_pct: 0.105, PER: 5.2, TS_pct: 0.379, ThrPAr: 0.15, FTr: 0.275, ORB_pct: 4.3, TRB_pct: 4, AST_pct: 12.3, STL_pct: 2.6, BLK_pct: 0, TOV_pct: 22.5, USG_pct: 20.9, OWS: -0.4, DWS: 0.1, WS: -0.3, WS40: -0.089, MIN_pg: 6.9, PTS_pg: 1.7, REB_pg: 0.5, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.325, FG3_pct: 0.333, FT_pct: 0.545 },
    },
  },
  'milleke01w': {
    id: 'milleke01w',
    name: 'Kelly Miller',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'CHA', age: 22, G: 26, MP: 225, MP_pct: 0.173, PER: 12.9, TS_pct: 0.465, ThrPAr: 0.333, FTr: 0.088, ORB_pct: 7.3, TRB_pct: 8.7, AST_pct: 13.1, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 13.2, USG_pct: 15.8, OWS: 0.4, DWS: 0.2, WS: 0.6, WS40: 0.099 },
    },
  },
  'millsta01w': {
    id: 'millsta01w',
    name: 'Tausha Mills',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'WAS', age: 24, G: 31, MP: 295, MP_pct: 0.23, PER: 15, TS_pct: 0.51, ThrPAr: 0, FTr: 0.486, ORB_pct: 18.6, TRB_pct: 18.7, AST_pct: 6.2, STL_pct: 2, BLK_pct: 2.3, TOV_pct: 22.5, USG_pct: 27.7, OWS: 0.1, DWS: 0.3, WS: 0.5, WS40: 0.065, MIN_pg: 9.5, PTS_pg: 4.2, REB_pg: 2.6, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.3, TOV_pg: 1.2, FG_pct: 0.438, FG3_pct: 0.000, FT_pct: 0.745 },
      2001: { team: 'WAS', age: 25, G: 30, MP: 319, MP_pct: 0.245, PER: 8.3, TS_pct: 0.387, ThrPAr: 0.014, FTr: 0.449, ORB_pct: 14.9, TRB_pct: 20.2, AST_pct: 3.8, STL_pct: 2.6, BLK_pct: 1.1, TOV_pct: 23.2, USG_pct: 16.7, OWS: -0.5, DWS: 0.7, WS: 0.2, WS40: 0.03, MIN_pg: 10.6, PTS_pg: 2.1, REB_pg: 3.5, AST_pg: 0.2, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.333, FG3_pct: 0.000, FT_pct: 0.581 },
    },
  },
  'miltode01w': {
    id: 'miltode01w',
    name: 'DeLisha Milton-Jones',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'LAS', age: 24, G: 32, MP: 835, MP_pct: 0.645, PER: 18.3, TS_pct: 0.581, ThrPAr: 0.004, FTr: 0.364, ORB_pct: 9, TRB_pct: 13, AST_pct: 11.1, STL_pct: 3.1, BLK_pct: 1.7, TOV_pct: 20.6, USG_pct: 18.9, OWS: 1.9, DWS: 1.4, WS: 3.4, WS40: 0.16, MIN_pg: 26.1, PTS_pg: 9.9, REB_pg: 5.5, AST_pg: 1.6, STL_pg: 1.5, BLK_pg: 0.5, TOV_pg: 2.2, FG_pct: 0.530, FG3_pct: 0.000, FT_pct: 0.791 },
      2000: { team: 'LAS', age: 25, G: 32, MP: 983, MP_pct: 0.762, PER: 18.1, TS_pct: 0.559, ThrPAr: 0.027, FTr: 0.348, ORB_pct: 7.3, TRB_pct: 12.3, AST_pct: 13.4, STL_pct: 2.5, BLK_pct: 2.5, TOV_pct: 16.5, USG_pct: 19.5, OWS: 2.3, DWS: 2.4, WS: 4.7, WS40: 0.191, MIN_pg: 30.7, PTS_pg: 11.8, REB_pg: 6.1, AST_pg: 2.1, STL_pg: 1.4, BLK_pg: 0.9, TOV_pg: 2, FG_pct: 0.512, FG3_pct: 0.250, FT_pct: 0.745 },
      2001: { team: 'LAS', age: 26, G: 32, MP: 938, MP_pct: 0.724, PER: 18.1, TS_pct: 0.51, ThrPAr: 0.118, FTr: 0.213, ORB_pct: 10, TRB_pct: 11.5, AST_pct: 12.8, STL_pct: 3, BLK_pct: 2.9, TOV_pct: 15.2, USG_pct: 19.3, OWS: 2.5, DWS: 1.4, WS: 3.9, WS40: 0.166, MIN_pg: 29.3, PTS_pg: 10.3, REB_pg: 5.3, AST_pg: 2.1, STL_pg: 1.5, BLK_pg: 0.9, TOV_pg: 1.8, FG_pct: 0.453, FG3_pct: 0.343, FT_pct: 0.794 },
    },
  },
  'moisead01w': {
    id: 'moisead01w',
    name: 'Adriana Moises',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 22, G: 7, MP: 123, MP_pct: 0.095, PER: 12.9, TS_pct: 0.497, ThrPAr: 0.333, FTr: 0.333, ORB_pct: 4.2, TRB_pct: 8.5, AST_pct: 28.7, STL_pct: 2.8, BLK_pct: 0, TOV_pct: 27.9, USG_pct: 22.5, OWS: -0.1, DWS: 0.1, WS: 0.1, WS40: 0.019 },
    },
  },
  'moorepe01w': {
    id: 'moorepe01w',
    name: 'Penny Moore',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 28, G: 28, MP: 539, MP_pct: 0.481, PER: 7.4, TS_pct: 0.391, ThrPAr: 0.157, FTr: 0.195, ORB_pct: 3.6, TRB_pct: 8.3, AST_pct: 9.7, STL_pct: 1.6, BLK_pct: 1.7, TOV_pct: 20.3, USG_pct: 19.1, OWS: -0.9, DWS: 0.6, WS: -0.3, WS40: -0.025 },
      1998: { team: 'WAS', age: 29, G: 29, MP: 756, MP_pct: 0.627, PER: 11.4, TS_pct: 0.409, ThrPAr: 0.339, FTr: 0.17, ORB_pct: 5.4, TRB_pct: 8.8, AST_pct: 12.8, STL_pct: 3, BLK_pct: 2.1, TOV_pct: 17.3, USG_pct: 20.7, OWS: -0.7, DWS: 0, WS: -0.7, WS40: -0.039 },
      1999: { team: 'WAS', age: 30, G: 4, MP: 19, MP_pct: 0.015, PER: -8.2, TS_pct: 0.333, ThrPAr: 0, FTr: 0, ORB_pct: 7.2, TRB_pct: 3.4, AST_pct: 0, STL_pct: 0, BLK_pct: 4.3, TOV_pct: 57.1, USG_pct: 17.9, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.356 },
    },
  },
  'mooreyo01w': {
    id: 'mooreyo01w',
    name: 'Yolanda Moore',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 22, G: 13, MP: 93, MP_pct: 0.082, PER: 0.7, TS_pct: 0.316, ThrPAr: 0, FTr: 0.6, ORB_pct: 8.4, TRB_pct: 9.2, AST_pct: 1.9, STL_pct: 0.6, BLK_pct: 0, TOV_pct: 21.7, USG_pct: 16.3, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.091 },
      1998: { team: 'HOU', age: 23, G: 30, MP: 533, MP_pct: 0.439, PER: 10.9, TS_pct: 0.55, ThrPAr: 0.028, FTr: 0.577, ORB_pct: 7.9, TRB_pct: 10.4, AST_pct: 3.2, STL_pct: 2.7, BLK_pct: 0, TOV_pct: 18.3, USG_pct: 9.8, OWS: 1, DWS: 1.1, WS: 2, WS40: 0.153 },
      1999: { team: 'ORL', age: 24, G: 23, MP: 114, MP_pct: 0.088, PER: 2.2, TS_pct: 0.495, ThrPAr: 0.048, FTr: 0.571, ORB_pct: 4.6, TRB_pct: 7.5, AST_pct: 1.7, STL_pct: 2, BLK_pct: 0, TOV_pct: 33.1, USG_pct: 16.6, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.075 },
    },
  },
  'mosleju01w': {
    id: 'mosleju01w',
    name: 'Judy Mosley-McAfee',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 29, G: 12, MP: 265, MP_pct: 0.235, PER: 8.4, TS_pct: 0.52, ThrPAr: 0, FTr: 0.229, ORB_pct: 11, TRB_pct: 11.2, AST_pct: 7, STL_pct: 1.6, BLK_pct: 0.6, TOV_pct: 32.1, USG_pct: 13.1, OWS: 0, DWS: -0.1, WS: -0.1, WS40: -0.019 },
    },
  },
  'moweje01w': {
    id: 'moweje01w',
    name: 'Jenny Mowe',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'POR', age: 23, G: 5, MP: 17, MP_pct: 0.013, PER: 12.8, TS_pct: 1, ThrPAr: 0, FTr: 0, ORB_pct: 7.2, TRB_pct: 11, AST_pct: 0, STL_pct: 0, BLK_pct: 5, TOV_pct: 40, USG_pct: 14.4, OWS: 0, DWS: 0, WS: 0, WS40: 0.06 },
    },
  },
  'mulitna01w': {
    id: 'mulitna01w',
    name: 'Naomi Mulitauaopele',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 24, G: 22, MP: 291, MP_pct: 0.227, PER: 10.4, TS_pct: 0.636, ThrPAr: 0.043, FTr: 0.29, ORB_pct: 5.6, TRB_pct: 7.5, AST_pct: 3.9, STL_pct: 0.8, BLK_pct: 1.7, TOV_pct: 27.8, USG_pct: 17, OWS: 0.2, DWS: 0, WS: 0.1, WS40: 0.016, MIN_pg: 6.7, PTS_pg: 3.1, REB_pg: 0.7, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.449, FG3_pct: 0.341, FT_pct: 0.500 },
      1997: { G: 12, MIN_pg: 7, PTS_pg: 3.1, REB_pg: 0.7, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.410, FG3_pct: 0.455 },
    },
  },
  'nagyan01w': {
    id: 'nagyan01w',
    name: 'Andrea Nagy',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 27, G: 32, MP: 947, MP_pct: 0.731, PER: 8.7, TS_pct: 0.513, ThrPAr: 0.25, FTr: 0.447, ORB_pct: 1.6, TRB_pct: 5.3, AST_pct: 29.1, STL_pct: 1.9, BLK_pct: 0.3, TOV_pct: 34.4, USG_pct: 12.4, OWS: 0.1, DWS: 0.5, WS: 0.6, WS40: 0.024, MIN_pg: 29.6, PTS_pg: 5.1, REB_pg: 2.4, AST_pg: 4.6, STL_pg: 0.97, BLK_pg: 0.09, TOV_pg: 2.59, FG_pct: 0.409, FG3_pct: 0.273, FT_pct: 0.763 },
      2000: { team: 'WAS', age: 28, G: 23, MP: 694, MP_pct: 0.542, PER: 9.8, TS_pct: 0.536, ThrPAr: 0.494, FTr: 0.329, ORB_pct: 2, TRB_pct: 6.3, AST_pct: 28.1, STL_pct: 1.4, BLK_pct: 1, TOV_pct: 37.8, USG_pct: 10.4, OWS: 0.4, DWS: 0.2, WS: 0.6, WS40: 0.033, MIN_pg: 30.2, PTS_pg: 4.2, REB_pg: 2.7, AST_pg: 5.1, STL_pg: 0.74, BLK_pg: 0.35, TOV_pg: 2.39, FG_pct: 0.392, FG3_pct: 0.359, FT_pct: 0.808 },
      2001: { team: 'NYL', age: 29, G: 23, MP: 213, MP_pct: 0.166, PER: 3.2, TS_pct: 0.519, ThrPAr: 0.387, FTr: 0.129, ORB_pct: 0, TRB_pct: 2.8, AST_pct: 19.1, STL_pct: 0.6, BLK_pct: 1.3, TOV_pct: 41.2, USG_pct: 13.5, OWS: -0.3, DWS: 0, WS: -0.3, WS40: -0.062, MIN_pg: 9.3, PTS_pg: 1.5, REB_pg: 0.4, AST_pg: 1, STL_pg: 0.09, BLK_pg: 0.13, TOV_pg: 1, FG_pct: 0.419, FG3_pct: 0.500, FT_pct: 0.500 },
    },
  },
  'ndiayas01w': {
    id: 'ndiayas01w',
    name: 'Astou Ndiaye-Diatta',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 25, G: 31, MP: 438, MP_pct: 0.337, PER: 14.4, TS_pct: 0.463, ThrPAr: 0.006, FTr: 0.244, ORB_pct: 6.8, TRB_pct: 14.3, AST_pct: 8.7, STL_pct: 1.4, BLK_pct: 3.4, TOV_pct: 15.3, USG_pct: 22.2, OWS: -0.1, DWS: 0.7, WS: 0.7, WS40: 0.06 },
      2000: { team: 'DET', age: 26, G: 32, MP: 868, MP_pct: 0.675, PER: 15.5, TS_pct: 0.487, ThrPAr: 0.018, FTr: 0.153, ORB_pct: 9.8, TRB_pct: 14.2, AST_pct: 9.3, STL_pct: 1.4, BLK_pct: 2, TOV_pct: 15.3, USG_pct: 22, OWS: 0.7, DWS: 0.6, WS: 1.4, WS40: 0.063 },
      2001: { team: 'DET', age: 27, G: 32, MP: 913, MP_pct: 0.697, PER: 17.7, TS_pct: 0.502, ThrPAr: 0.044, FTr: 0.223, ORB_pct: 8.4, TRB_pct: 12.7, AST_pct: 12.8, STL_pct: 1.4, BLK_pct: 2.7, TOV_pct: 16.3, USG_pct: 24.2, OWS: 1.4, DWS: 0.3, WS: 1.7, WS40: 0.075 },
    },
  },
  'nemcoev01w': {
    id: 'nemcoev01w',
    name: 'Eva Nemcova',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 24, G: 28, MP: 944, MP_pct: 0.832, PER: 18.6, TS_pct: 0.584, ThrPAr: 0.291, FTr: 0.284, ORB_pct: 3.3, TRB_pct: 7.5, AST_pct: 14.4, STL_pct: 2.3, BLK_pct: 0.7, TOV_pct: 19.2, USG_pct: 20.1, OWS: 2.9, DWS: 0.9, WS: 3.8, WS40: 0.161, MIN_pg: 33.7, PTS_pg: 13.7, REB_pg: 3.9, AST_pg: 2.4, STL_pg: 1.4, BLK_pg: 0.3, FG_pct: 0.473, FG3_pct: 0.435, FT_pct: 0.855 },
      1998: { team: 'CLE', age: 25, G: 30, MP: 972, MP_pct: 0.8, PER: 16.1, TS_pct: 0.57, ThrPAr: 0.22, FTr: 0.266, ORB_pct: 4.3, TRB_pct: 7.7, AST_pct: 13.1, STL_pct: 1.8, BLK_pct: 1.8, TOV_pct: 16.9, USG_pct: 18.8, OWS: 2.4, DWS: 1, WS: 3.4, WS40: 0.138, MIN_pg: 32.4, PTS_pg: 12.0, REB_pg: 3.7, AST_pg: 2.2, STL_pg: 1.1, BLK_pg: 0.7, FG_pct: 0.468, FG3_pct: 0.452, FT_pct: 0.893 },
      1999: { team: 'CLE', age: 26, G: 31, MP: 925, MP_pct: 0.723, PER: 14.7, TS_pct: 0.531, ThrPAr: 0.314, FTr: 0.213, ORB_pct: 3.9, TRB_pct: 8, AST_pct: 11.6, STL_pct: 1.9, BLK_pct: 2, TOV_pct: 20, USG_pct: 21.2, OWS: 0.6, DWS: 0.9, WS: 1.5, WS40: 0.066, MIN_pg: 29.8, PTS_pg: 11.1, REB_pg: 3.7, AST_pg: 1.6, STL_pg: 1.0, BLK_pg: 0.7, FG_pct: 0.419, FG3_pct: 0.366, FT_pct: 0.984 },
      2000: { team: 'CLE', age: 27, G: 14, MP: 443, MP_pct: 0.341, PER: 16.2, TS_pct: 0.53, ThrPAr: 0.433, FTr: 0.146, ORB_pct: 2.8, TRB_pct: 6.7, AST_pct: 11, STL_pct: 2, BLK_pct: 1.7, TOV_pct: 13.4, USG_pct: 22.6, OWS: 0.9, DWS: 0.6, WS: 1.5, WS40: 0.136, MIN_pg: 31.6, PTS_pg: 13.2, REB_pg: 2.9, AST_pg: 1.6, STL_pg: 1.1, BLK_pg: 0.6, FG_pct: 0.409, FG3_pct: 0.408, FT_pct: 0.917 },
      2001: { team: 'CLE', age: 28, G: 8, MP: 113, MP_pct: 0.088, PER: 10.7, TS_pct: 0.409, ThrPAr: 0.395, FTr: 0.211, ORB_pct: 1.3, TRB_pct: 6.1, AST_pct: 14.8, STL_pct: 1.1, BLK_pct: 4.3, TOV_pct: 12.6, USG_pct: 22.2, OWS: 0, DWS: 0.2, WS: 0.2, WS40: 0.07, MIN_pg: 14.1, PTS_pg: 4.3, REB_pg: 1.3, AST_pg: 1.0, STL_pg: 0.3, BLK_pg: 0.6, FG_pct: 0.342, FG3_pct: 0.200, FT_pct: 0.625 },
    },
  },
  'nevescl01w': {
    id: 'nevescl01w',
    name: 'Claudia Neves',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 24, G: 30, MP: 306, MP_pct: 0.235, PER: 6.5, TS_pct: 0.368, ThrPAr: 0.632, FTr: 0.2, ORB_pct: 3.1, TRB_pct: 4.7, AST_pct: 18, STL_pct: 2.9, BLK_pct: 0, TOV_pct: 18.2, USG_pct: 19.2, OWS: -0.6, DWS: 0.3, WS: -0.3, WS40: -0.035 },
      2000: { team: 'DET', age: 25, G: 30, MP: 636, MP_pct: 0.495, PER: 10.3, TS_pct: 0.499, ThrPAr: 0.554, FTr: 0.181, ORB_pct: 1.6, TRB_pct: 3.6, AST_pct: 16.1, STL_pct: 2.6, BLK_pct: 0.1, TOV_pct: 23.5, USG_pct: 16.8, OWS: 0, DWS: 0.2, WS: 0.2, WS40: 0.012 },
      2001: { team: 'DET', age: 26, G: 22, MP: 407, MP_pct: 0.311, PER: 10.5, TS_pct: 0.487, ThrPAr: 0.553, FTr: 0.085, ORB_pct: 0.9, TRB_pct: 4.8, AST_pct: 16.5, STL_pct: 3, BLK_pct: 0, TOV_pct: 22.3, USG_pct: 15.2, OWS: 0.1, DWS: 0.1, WS: 0.1, WS40: 0.014 },
    },
  },
  'nichoti01w': {
    id: 'nichoti01w',
    name: 'Tina Nicholson',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 23, G: 24, MP: 273, MP_pct: 0.241, PER: 7.6, TS_pct: 0.519, ThrPAr: 0.545, FTr: 0.114, ORB_pct: 1, TRB_pct: 2.4, AST_pct: 26.9, STL_pct: 2, BLK_pct: 0.3, TOV_pct: 37.7, USG_pct: 12.7, OWS: 0, DWS: 0.1, WS: 0, WS40: 0.007, MIN_pg: 11.4, PTS_pg: 2, REB_pg: 0.4, AST_pg: 1.8, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.409, FG3_pct: 0.375, FT_pct: 0.600 },
    },
  },
  'nikolmi01w': {
    id: 'nikolmi01w',
    name: 'Mila Nikolich',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'HOU', age: 28, G: 7, MP: 29, MP_pct: 0.023, PER: 7.1, TS_pct: 0.421, ThrPAr: 0.364, FTr: 0.182, ORB_pct: 14.4, TRB_pct: 11.3, AST_pct: 6.7, STL_pct: 0, BLK_pct: 0, TOV_pct: 20.2, USG_pct: 25, OWS: 0, DWS: 0, WS: 0, WS40: -0.033 },
      2000: { G: 30, MIN_pg: 15.2, PTS_pg: 4.4, REB_pg: 2.2, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 0.4, TOV_pg: 1, FG_pct: 0.458, FG3_pct: 0.263, FT_pct: 0.594 },
      2001: { G: 31, MIN_pg: 15.9, PTS_pg: 3.1, REB_pg: 2.8, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.5, TOV_pg: 1.2, FG_pct: 0.340, FG3_pct: 0.333, FT_pct: 0.613 },
    },
  },
  'nolande01w': {
    id: 'nolande01w',
    name: 'Deanna Nolan',
    position: 'G-F',
    retired: true,
    seasons: {
      2001: { team: 'DET', age: 21, G: 27, MP: 545, MP_pct: 0.416, PER: 11.7, TS_pct: 0.442, ThrPAr: 0.376, FTr: 0.273, ORB_pct: 3.7, TRB_pct: 6.6, AST_pct: 11.6, STL_pct: 1.8, BLK_pct: 1, TOV_pct: 13.9, USG_pct: 22.9, OWS: 0.2, DWS: 0, WS: 0.2, WS40: 0.012, MIN_pg: 20.2, PTS_pg: 7.1, REB_pg: 2, AST_pg: 1.1, STL_pg: 0.6, BLK_pg: 0.2, TOV_pg: 1.3, FG_pct: 0.330, FG3_pct: 0.288, FT_pct: 0.811 },
      2002: { G: 32, MIN_pg: 25.1, PTS_pg: 8.7, REB_pg: 2.7, AST_pg: 1.9, STL_pg: 0.8, BLK_pg: 0.4, TOV_pg: 1.9, FG_pct: 0.415, FG3_pct: 0.368, FT_pct: 0.806 },
      2003: { G: 32, MIN_pg: 29.8, PTS_pg: 12.4, REB_pg: 3.3, AST_pg: 2.6, STL_pg: 1.3, BLK_pg: 0.4, TOV_pg: 2.2, FG_pct: 0.436, FG3_pct: 0.421, FT_pct: 0.792 },
    },
  },
  'nygaava01w': {
    id: 'nygaava01w',
    name: 'Vanessa Nygaard',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'CLE', age: 24, G: 4, MP: 20, MP_pct: 0.016, PER: 8.5, TS_pct: 0.75, ThrPAr: 1, FTr: 0, ORB_pct: 6.7, TRB_pct: 9.7, AST_pct: 9.1, STL_pct: 5.6, BLK_pct: 0, TOV_pct: 50, USG_pct: 9.7, OWS: 0, DWS: 0, WS: 0, WS40: 0.054, MIN_pg: 5, PTS_pg: 0.8, REB_pg: 0.8, AST_pg: 0.5, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 0.5, FG_pct: 0.500, FG3_pct: 0.500, FT_pct: 0.000 },
      2000: { team: 'POR', age: 25, G: 32, MP: 843, MP_pct: 0.646, PER: 12, TS_pct: 0.543, ThrPAr: 0.431, FTr: 0.258, ORB_pct: 8.1, TRB_pct: 9.9, AST_pct: 7.5, STL_pct: 1.1, BLK_pct: 0.6, TOV_pct: 14, USG_pct: 15.4, OWS: 1.6, DWS: 0.4, WS: 2, WS40: 0.097, MIN_pg: 26.3, PTS_pg: 7.9, REB_pg: 3.8, AST_pg: 0.9, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 1.2, FG_pct: 0.435, FG3_pct: 0.333, FT_pct: 0.759 },
      2001: { team: 'POR', age: 26, G: 31, MP: 259, MP_pct: 0.198, PER: 9.5, TS_pct: 0.518, ThrPAr: 0.681, FTr: 0.042, ORB_pct: 6.2, TRB_pct: 8.4, AST_pct: 8.5, STL_pct: 1.3, BLK_pct: 0.7, TOV_pct: 16, USG_pct: 16.5, OWS: 0.3, DWS: 0.1, WS: 0.4, WS40: 0.061, MIN_pg: 8.4, PTS_pg: 2.5, REB_pg: 1.1, AST_pg: 0.3, STL_pg: 0.2, BLK_pg: 0.1, TOV_pg: 0.5, FG_pct: 0.389, FG3_pct: 0.388, FT_pct: 0.333 },
    },
  },
  'owenhe01w': {
    id: 'owenhe01w',
    name: 'Heather Owen',
    position: 'F-C',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 23, G: 17, MP: 235, MP_pct: 0.181, PER: 4.4, TS_pct: 0.513, ThrPAr: 0, FTr: 0.92, ORB_pct: 6.4, TRB_pct: 10.4, AST_pct: 5.5, STL_pct: 0.5, BLK_pct: 1.4, TOV_pct: 29.9, USG_pct: 10.4, OWS: -0.1, DWS: 0.1, WS: 0.1, WS40: 0.013, MIN_pg: 4.1, PTS_pg: 1.4, REB_pg: 0.7, AST_pg: 0.1, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.364, FG3_pct: 0.250, FT_pct: 0.500 },
      2000: { team: 'WAS', age: 24, G: 11, MP: 60, MP_pct: 0.047, PER: -2.3, TS_pct: 0.25, ThrPAr: 0, FTr: 0, ORB_pct: 4.7, TRB_pct: 10.3, AST_pct: 5.3, STL_pct: 0, BLK_pct: 0, TOV_pct: 42.9, USG_pct: 5.8, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.07 },
    },
  },
  'owenssh01w': {
    id: 'owenssh01w',
    name: 'Shantia Owens',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'MIA', age: 22, G: 31, MP: 605, MP_pct: 0.467, PER: 6.1, TS_pct: 0.423, ThrPAr: 0, FTr: 0.412, ORB_pct: 9.9, TRB_pct: 11, AST_pct: 8.4, STL_pct: 1.1, BLK_pct: 4.1, TOV_pct: 25.9, USG_pct: 17.3, OWS: -1.2, DWS: 1, WS: -0.3, WS40: -0.019 },
    },
  },
  'pagemu01w': {
    id: 'pagemu01w',
    name: 'Murriel Page',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 22, G: 30, MP: 955, MP_pct: 0.793, PER: 12.1, TS_pct: 0.507, ThrPAr: 0.009, FTr: 0.3, ORB_pct: 9.8, TRB_pct: 13.4, AST_pct: 8.6, STL_pct: 1, BLK_pct: 1.1, TOV_pct: 18.8, USG_pct: 14, OWS: 1.1, DWS: -0.5, WS: 0.6, WS40: 0.024, MIN_pg: 31.8, PTS_pg: 8.3, REB_pg: 6.9, AST_pg: 1.3, STL_pg: 0.6, BLK_pg: 0.4, TOV_pg: 1.9, FG_pct: 0.479, FG3_pct: 0.000, FT_pct: 0.631 },
      1999: { team: 'WAS', age: 23, G: 32, MP: 916, MP_pct: 0.707, PER: 17.4, TS_pct: 0.614, ThrPAr: 0, FTr: 0.568, ORB_pct: 10.1, TRB_pct: 15, AST_pct: 6.5, STL_pct: 1.5, BLK_pct: 2.7, TOV_pct: 17.6, USG_pct: 14.7, OWS: 2.5, DWS: 1.2, WS: 3.7, WS40: 0.162, MIN_pg: 28.6, PTS_pg: 8.8, REB_pg: 6.7, AST_pg: 0.9, STL_pg: 0.8, BLK_pg: 0.9, TOV_pg: 1.5, FG_pct: 0.574, FG3_pct: 0.000, FT_pct: 0.683 },
      2000: { team: 'WAS', age: 24, G: 32, MP: 1046, MP_pct: 0.817, PER: 16.9, TS_pct: 0.598, ThrPAr: 0, FTr: 0.414, ORB_pct: 10.6, TRB_pct: 13.7, AST_pct: 11.7, STL_pct: 1.3, BLK_pct: 2.6, TOV_pct: 19.4, USG_pct: 15.5, OWS: 2.5, DWS: 0.8, WS: 3.3, WS40: 0.127, MIN_pg: 32.7, PTS_pg: 9.8, REB_pg: 6.5, AST_pg: 2, STL_pg: 0.7, BLK_pg: 1, TOV_pg: 2, FG_pct: 0.590, FG3_pct: 0.000, FT_pct: 0.565 },
      2001: { team: 'WAS', age: 25, G: 32, MP: 989, MP_pct: 0.761, PER: 12.5, TS_pct: 0.456, ThrPAr: 0.074, FTr: 0.156, ORB_pct: 8.9, TRB_pct: 11, AST_pct: 11.9, STL_pct: 1.8, BLK_pct: 3.1, TOV_pct: 19.6, USG_pct: 15.3, OWS: 0.2, DWS: 1.2, WS: 1.4, WS40: 0.058, MIN_pg: 30.9, PTS_pg: 7, REB_pg: 5.5, AST_pg: 1.7, STL_pg: 0.9, BLK_pg: 1.1, TOV_pg: 1.9, FG_pct: 0.433, FG3_pct: 0.235, FT_pct: 0.583 },
    },
  },
  'palmewe01w': {
    id: 'palmewe01w',
    name: 'Wendy Palmer',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 22, G: 28, MP: 936, MP_pct: 0.828, PER: 18.7, TS_pct: 0.446, ThrPAr: 0.114, FTr: 0.412, ORB_pct: 9, TRB_pct: 13.9, AST_pct: 12.2, STL_pct: 2.7, BLK_pct: 0.5, TOV_pct: 12.5, USG_pct: 27, OWS: 1.6, DWS: 0.4, WS: 2, WS40: 0.083, MIN_pg: 33.4, PTS_pg: 15.8, REB_pg: 8.0, AST_pg: 1.7, STL_pg: 1.7, BLK_pg: 0.2, FG_pct: 0.374, FG3_pct: 0.250, FT_pct: 0.676 },
      1998: { team: 'UTA', age: 23, G: 28, MP: 761, MP_pct: 0.629, PER: 19.9, TS_pct: 0.521, ThrPAr: 0.055, FTr: 0.404, ORB_pct: 11.3, TRB_pct: 14.6, AST_pct: 8.7, STL_pct: 1.3, BLK_pct: 0.5, TOV_pct: 13.4, USG_pct: 25.1, OWS: 2.1, DWS: 0, WS: 2.2, WS40: 0.115, MIN_pg: 27.2, PTS_pg: 13.5, REB_pg: 6.6, AST_pg: 1.1, STL_pg: 0.6, BLK_pg: 0.2, FG_pct: 0.472, FG3_pct: 0.353, FT_pct: 0.653 },
      1999: { team: 'UTA', age: 24, G: 20, MP: 446, MP_pct: 0.343, PER: 12.8, TS_pct: 0.489, ThrPAr: 0.213, FTr: 0.482, ORB_pct: 6.7, TRB_pct: 11.9, AST_pct: 12.9, STL_pct: 0.4, BLK_pct: 1.6, TOV_pct: 15.8, USG_pct: 20.9, OWS: 0.6, DWS: -0.1, WS: 0.5, WS40: 0.044, MIN_pg: 22.3, PTS_pg: 8.4, REB_pg: 4.2, AST_pg: 1.5, STL_pg: 0.2, BLK_pg: 0.4, FG_pct: 0.404, FG3_pct: 0.300, FT_pct: 0.647 },
      2000: { team: 'DET', age: 25, G: 32, MP: 914, MP_pct: 0.711, PER: 18, TS_pct: 0.51, ThrPAr: 0.129, FTr: 0.362, ORB_pct: 9.6, TRB_pct: 15.7, AST_pct: 8.7, STL_pct: 1.2, BLK_pct: 0.9, TOV_pct: 13.1, USG_pct: 24.8, OWS: 2.1, DWS: 0.7, WS: 2.8, WS40: 0.121, MIN_pg: 28.6, PTS_pg: 13.8, REB_pg: 6.8, AST_pg: 1.2, STL_pg: 0.6, BLK_pg: 0.3, FG_pct: 0.448, FG3_pct: 0.250, FT_pct: 0.704 },
      2001: { team: 'DET', age: 26, G: 22, MP: 651, MP_pct: 0.497, PER: 15, TS_pct: 0.483, ThrPAr: 0.153, FTr: 0.274, ORB_pct: 7.5, TRB_pct: 16.1, AST_pct: 7.8, STL_pct: 2.1, BLK_pct: 0.5, TOV_pct: 16.6, USG_pct: 21.9, OWS: 0.4, DWS: 0.5, WS: 0.9, WS40: 0.055, MIN_pg: 29.6, PTS_pg: 10.6, REB_pg: 7.0, AST_pg: 1.0, STL_pg: 1.0, BLK_pg: 0.2, FG_pct: 0.423, FG3_pct: 0.333, FT_pct: 0.678 },
      2002: { team: 'DET', age: 27, G: 32, MIN_pg: 29.7, PTS_pg: 11.4, REB_pg: 5.9, AST_pg: 1.3, STL_pg: 1.1, BLK_pg: 0.3, FG_pct: 0.431, FG3_pct: 0.347, FT_pct: 0.676 },
      2003: { team: 'CON', age: 28, G: 32, MIN_pg: 13.5, PTS_pg: 4.7, REB_pg: 3.3, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.1, FG_pct: 0.395, FG3_pct: 0.217, FT_pct: 0.821 },
      2004: { team: 'CON', age: 29, G: 33, MIN_pg: 23.8, PTS_pg: 9.0, REB_pg: 5.5, AST_pg: 0.9, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.427, FG3_pct: 0.317, FT_pct: 0.800 },
      2005: { team: 'SAN', age: 30, G: 34, MIN_pg: 25.9, PTS_pg: 9.6, REB_pg: 5.7, AST_pg: 1.0, STL_pg: 0.6, BLK_pg: 0.2, FG_pct: 0.517, FG3_pct: 0.429, FT_pct: 0.743 },
      2006: { team: 'SEA', age: 31, G: 5, MIN_pg: 24.0, PTS_pg: 9.4, REB_pg: 7.6, AST_pg: 0.6, STL_pg: 1.0, BLK_pg: 0.6, FG_pct: 0.485, FG3_pct: 0.333, FT_pct: 0.737 },
      2007: { team: 'SEA', age: 32, G: 34, MIN_pg: 13.9, PTS_pg: 4.6, REB_pg: 4.3, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.2, FG_pct: 0.417, FG3_pct: 0.143, FT_pct: 0.782 },
    },
  },
  'paschti01w': {
    id: 'paschti01w',
    name: 'Tia Paschal',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 29, G: 20, MP: 110, MP_pct: 0.092, PER: 6.2, TS_pct: 0.341, ThrPAr: 0.108, FTr: 0.162, ORB_pct: 4.5, TRB_pct: 8.4, AST_pct: 14.5, STL_pct: 3.9, BLK_pct: 0, TOV_pct: 21.7, USG_pct: 21.4, OWS: -0.4, DWS: 0.2, WS: -0.2, WS40: -0.055, MIN_pg: 5.5, PTS_pg: 1.4, REB_pg: 0.8, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.297, FG3_pct: 0.250, FT_pct: 0.667 },
    },
  },
  'pavlimi01w': {
    id: 'pavlimi01w',
    name: 'Michaela Pavlickova',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'UTA', age: 23, G: 10, MP: 21, MP_pct: 0.016, PER: 6.5, TS_pct: 0.174, ThrPAr: 0, FTr: 1, ORB_pct: 0, TRB_pct: 18.1, AST_pct: 7.6, STL_pct: 0, BLK_pct: 8, TOV_pct: 25.8, USG_pct: 9.1, OWS: -0.1, DWS: 0, WS: 0, WS40: -0.051 },
    },
  },
  'payeka01w': {
    id: 'payeka01w',
    name: 'Kate Paye',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 26, G: 28, MP: 408, MP_pct: 0.318, PER: 4.3, TS_pct: 0.452, ThrPAr: 0.707, FTr: 0.155, ORB_pct: 1, TRB_pct: 5.1, AST_pct: 16.9, STL_pct: 1.1, BLK_pct: 1.5, TOV_pct: 31.1, USG_pct: 10.9, OWS: -0.4, DWS: 0.3, WS: -0.1, WS40: -0.006, MIN_pg: 14.6, PTS_pg: 2, REB_pg: 1.1, AST_pg: 1.4, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.328, FG3_pct: 0.293, FT_pct: 0.667 },
      2001: { team: 'MIN', age: 27, G: 32, MP: 652, MP_pct: 0.503, PER: 9.2, TS_pct: 0.535, ThrPAr: 0.718, FTr: 0.205, ORB_pct: 1.4, TRB_pct: 6, AST_pct: 31.5, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 35.1, USG_pct: 9.9, OWS: 0.4, DWS: 0.4, WS: 0.8, WS40: 0.047, MIN_pg: 20.4, PTS_pg: 2.8, REB_pg: 1.9, AST_pg: 3, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.385, FG3_pct: 0.357, FT_pct: 0.688 },
    },
  },
  'penicti01w': {
    id: 'penicti01w',
    name: 'Ticha Penicheiro',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 23, G: 30, MP: 1080, MP_pct: 0.896, PER: 12.2, TS_pct: 0.446, ThrPAr: 0.261, FTr: 0.661, ORB_pct: 1.5, TRB_pct: 8.3, AST_pct: 37.2, STL_pct: 3.4, BLK_pct: 0.2, TOV_pct: 35.3, USG_pct: 14.2, OWS: -0.6, DWS: 1.4, WS: 0.9, WS40: 0.032, MIN_pg: 36.0, PTS_pg: 6.3, REB_pg: 4.7, AST_pg: 7.5, STL_pg: 2.2, BLK_pg: 0.1, FG_pct: 0.333, FG3_pct: 0.233, FT_pct: 0.642 },
      1999: { team: 'SAC', age: 24, G: 32, MP: 1120, MP_pct: 0.875, PER: 11.5, TS_pct: 0.42, ThrPAr: 0.171, FTr: 0.59, ORB_pct: 3.1, TRB_pct: 8.5, AST_pct: 33.6, STL_pct: 3.2, BLK_pct: 0.4, TOV_pct: 32.6, USG_pct: 16.4, OWS: -0.9, DWS: 1.9, WS: 1, WS40: 0.035, MIN_pg: 35.0, PTS_pg: 7.3, REB_pg: 4.8, AST_pg: 7.1, STL_pg: 2.1, BLK_pg: 0.2, FG_pct: 0.320, FG3_pct: 0.158, FT_pct: 0.664 },
      2000: { team: 'SAC', age: 25, G: 30, MP: 936, MP_pct: 0.731, PER: 17.1, TS_pct: 0.448, ThrPAr: 0.27, FTr: 0.578, ORB_pct: 1.6, TRB_pct: 6.1, AST_pct: 41.2, STL_pct: 4.2, BLK_pct: 0.5, TOV_pct: 23.4, USG_pct: 15.1, OWS: 1.6, DWS: 1.5, WS: 3.1, WS40: 0.134, MIN_pg: 31.2, PTS_pg: 6.9, REB_pg: 3.0, AST_pg: 7.9, STL_pg: 2.3, BLK_pg: 0.2, FG_pct: 0.368, FG3_pct: 0.200, FT_pct: 0.579 },
      2001: { team: 'SAC', age: 26, G: 23, MP: 744, MP_pct: 0.57, PER: 15, TS_pct: 0.473, ThrPAr: 0.339, FTr: 0.516, ORB_pct: 1, TRB_pct: 7.2, AST_pct: 39.5, STL_pct: 3.1, BLK_pct: 0.9, TOV_pct: 29.6, USG_pct: 13.8, OWS: 1.1, DWS: 1.2, WS: 2.3, WS40: 0.124, MIN_pg: 32.3, PTS_pg: 6.3, REB_pg: 3.7, AST_pg: 7.5, STL_pg: 1.7, BLK_pg: 0.4, FG_pct: 0.339, FG3_pct: 0.262, FT_pct: 0.766 },
      2002: { team: 'SAC', age: 27, G: 24, MIN_pg: 35.5, PTS_pg: 8.5, REB_pg: 4.3, AST_pg: 8.0, STL_pg: 2.7, BLK_pg: 0.0, FG_pct: 0.377, FG3_pct: 0.250, FT_pct: 0.728 },
      2003: { team: 'SAC', age: 28, G: 34, MIN_pg: 32.0, PTS_pg: 5.4, REB_pg: 3.5, AST_pg: 6.7, STL_pg: 1.8, BLK_pg: 0.0, FG_pct: 0.302, FG3_pct: 0.250, FT_pct: 0.579 },
      2004: { team: 'SAC', age: 29, G: 32, MIN_pg: 29.4, PTS_pg: 6.0, REB_pg: 3.1, AST_pg: 4.9, STL_pg: 1.9, BLK_pg: 0.1, FG_pct: 0.354, FG3_pct: 0.338, FT_pct: 0.714 },
      2005: { team: 'SAC', age: 30, G: 34, MIN_pg: 27.3, PTS_pg: 5.7, REB_pg: 2.9, AST_pg: 4.4, STL_pg: 1.4, BLK_pg: 0.2, FG_pct: 0.314, FG3_pct: 0.195, FT_pct: 0.790 },
      2006: { team: 'SAC', age: 31, G: 34, MIN_pg: 24.9, PTS_pg: 5.4, REB_pg: 2.7, AST_pg: 3.4, STL_pg: 1.7, BLK_pg: 0.1, FG_pct: 0.339, FG3_pct: 0.194, FT_pct: 0.792 },
      2007: { team: 'SAC', age: 32, G: 32, MIN_pg: 23.7, PTS_pg: 5.7, REB_pg: 2.6, AST_pg: 4.5, STL_pg: 1.5, BLK_pg: 0.0, FG_pct: 0.314, FG3_pct: 0.214, FT_pct: 0.822 },
      2008: { team: 'SAC', age: 33, G: 33, MIN_pg: 25.9, PTS_pg: 8.6, REB_pg: 3.0, AST_pg: 5.2, STL_pg: 2.0, BLK_pg: 0.1, FG_pct: 0.374, FG3_pct: 0.286, FT_pct: 0.809 },
      2009: { team: 'SAC', age: 34, G: 30, MIN_pg: 24.1, PTS_pg: 4.9, REB_pg: 2.7, AST_pg: 5.2, STL_pg: 1.0, BLK_pg: 0.1, FG_pct: 0.324, FG3_pct: 0.111, FT_pct: 0.814 },
      2010: { team: 'LAS', age: 35, G: 32, MIN_pg: 26.3, PTS_pg: 4.9, REB_pg: 4.0, AST_pg: 6.9, STL_pg: 1.3, BLK_pg: 0.1, FG_pct: 0.410, FG3_pct: 0.111, FT_pct: 0.819 },
      2011: { team: 'LAS', age: 36, G: 34, MIN_pg: 23.7, PTS_pg: 6.0, REB_pg: 2.8, AST_pg: 4.8, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.486, FG3_pct: 0.417, FT_pct: 0.868 },
      2012: { team: 'CHI', age: 37, G: 18, MIN_pg: 12.8, PTS_pg: 1.8, REB_pg: 1.3, AST_pg: 2.1, STL_pg: 0.4, BLK_pg: 0.2, FG_pct: 0.375, FG3_pct: 0.200, FT_pct: 0.545 },
    },
  },
  'perazja01w': {
    id: 'perazja01w',
    name: 'Jasmina Perazic-Gipe',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 36, G: 9, MP: 47, MP_pct: 0.041, PER: 8.2, TS_pct: 0.385, ThrPAr: 0.231, FTr: 0, ORB_pct: 5.2, TRB_pct: 14.4, AST_pct: 16.5, STL_pct: 3.4, BLK_pct: 0, TOV_pct: 35, USG_pct: 19.2, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.043 },
    },
  },
  'perpeer01w': {
    id: 'perpeer01w',
    name: 'Erin Perperoglou',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'MIN', age: 22, G: 32, MP: 725, MP_pct: 0.56, PER: 9.9, TS_pct: 0.421, ThrPAr: 0.158, FTr: 0.413, ORB_pct: 7.5, TRB_pct: 10.4, AST_pct: 19.9, STL_pct: 2.2, BLK_pct: 3.6, TOV_pct: 23, USG_pct: 19.1, OWS: -0.7, DWS: 0.9, WS: 0.2, WS40: 0.012 },
    },
  },
  'perroki01w': {
    id: 'perroki01w',
    name: 'Kim Perrot',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 30, G: 28, MP: 692, MP_pct: 0.612, PER: 14.1, TS_pct: 0.452, ThrPAr: 0.611, FTr: 0.228, ORB_pct: 3.4, TRB_pct: 7.2, AST_pct: 23.8, STL_pct: 5.6, BLK_pct: 0.2, TOV_pct: 26.7, USG_pct: 16.5, OWS: 0.2, DWS: 1.5, WS: 1.7, WS40: 0.098, MIN_pg: 24.7, PTS_pg: 5.8, REB_pg: 2.7, AST_pg: 3.1, STL_pg: 2.5, BLK_pg: 0.1, TOV_pg: 2.3, FG_pct: 0.364, FG3_pct: 0.283, FT_pct: 0.405 },
      1998: { team: 'HOU', age: 31, G: 30, MP: 986, MP_pct: 0.812, PER: 16, TS_pct: 0.51, ThrPAr: 0.495, FTr: 0.321, ORB_pct: 2.3, TRB_pct: 6, AST_pct: 25.5, STL_pct: 4.8, BLK_pct: 0, TOV_pct: 24.8, USG_pct: 16, OWS: 1.5, DWS: 2.5, WS: 4, WS40: 0.162, MIN_pg: 32.9, PTS_pg: 8.5, REB_pg: 3.1, AST_pg: 4.7, STL_pg: 2.8, BLK_pg: 0, TOV_pg: 2.7, FG_pct: 0.404, FG3_pct: 0.269, FT_pct: 0.700 },
    },
  },
  'pettibr01w': {
    id: 'pettibr01w',
    name: 'Bridget Pettis',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 26, G: 28, MP: 842, MP_pct: 0.742, PER: 17, TS_pct: 0.478, ThrPAr: 0.417, FTr: 0.336, ORB_pct: 5, TRB_pct: 7.8, AST_pct: 20.4, STL_pct: 3.1, BLK_pct: 1.2, TOV_pct: 18.2, USG_pct: 24.1, OWS: 1.4, DWS: 1.7, WS: 3.2, WS40: 0.15, MIN_pg: 30.1, PTS_pg: 12.6, REB_pg: 3.8, AST_pg: 2.8, STL_pg: 1.8, BLK_pg: 0.4, TOV_pg: 2.9, FG_pct: 0.334, FG3_pct: 0.306, FT_pct: 0.898 },
      1998: { team: 'PHO', age: 27, G: 30, MP: 849, MP_pct: 0.699, PER: 14.8, TS_pct: 0.498, ThrPAr: 0.41, FTr: 0.297, ORB_pct: 5, TRB_pct: 7.8, AST_pct: 14.2, STL_pct: 1.9, BLK_pct: 0.9, TOV_pct: 15.5, USG_pct: 21.7, OWS: 1.7, DWS: 1.2, WS: 2.9, WS40: 0.138, MIN_pg: 28.3, PTS_pg: 11.3, REB_pg: 3.4, AST_pg: 2.1, STL_pg: 1, BLK_pg: 0.3, TOV_pg: 2.1, FG_pct: 0.377, FG3_pct: 0.285, FT_pct: 0.865 },
      1999: { team: 'PHO', age: 28, G: 32, MP: 541, MP_pct: 0.423, PER: 10.7, TS_pct: 0.386, ThrPAr: 0.458, FTr: 0.22, ORB_pct: 6.7, TRB_pct: 6.9, AST_pct: 17.5, STL_pct: 2.7, BLK_pct: 0.3, TOV_pct: 11.3, USG_pct: 23.4, OWS: -0.2, DWS: 0.5, WS: 0.3, WS40: 0.019, MIN_pg: 16.9, PTS_pg: 5.7, REB_pg: 1.8, AST_pg: 1.4, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.304, FG3_pct: 0.224, FT_pct: 0.617 },
      2000: { team: 'PHO', age: 29, G: 32, MP: 583, MP_pct: 0.454, PER: 13.7, TS_pct: 0.485, ThrPAr: 0.446, FTr: 0.363, ORB_pct: 4.6, TRB_pct: 7.1, AST_pct: 15.1, STL_pct: 3.1, BLK_pct: 0.6, TOV_pct: 16.7, USG_pct: 20.5, OWS: 0.6, DWS: 0.8, WS: 1.4, WS40: 0.099, MIN_pg: 18.2, PTS_pg: 5.9, REB_pg: 1.9, AST_pg: 1.4, STL_pg: 1, BLK_pg: 0.1, TOV_pg: 1.2, FG_pct: 0.357, FG3_pct: 0.267, FT_pct: 0.803 },
      2001: { team: 'PHO', age: 30, G: 32, MP: 497, MP_pct: 0.385, PER: 15.1, TS_pct: 0.468, ThrPAr: 0.396, FTr: 0.352, ORB_pct: 7.8, TRB_pct: 7.9, AST_pct: 20.6, STL_pct: 3.2, BLK_pct: 0.7, TOV_pct: 17.1, USG_pct: 21.5, OWS: 0.6, DWS: 0.4, WS: 1, WS40: 0.082, MIN_pg: 16.9, PTS_pg: 5.7, REB_pg: 1.8, AST_pg: 1.4, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.304, FG3_pct: 0.224, FT_pct: 0.617 },
    },
  },
  'phillta01w': {
    id: 'phillta01w',
    name: 'Tari Phillips',
    position: 'F-C',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 29, G: 32, MP: 335, MP_pct: 0.26, PER: 9.2, TS_pct: 0.428, ThrPAr: 0.023, FTr: 0.422, ORB_pct: 10.1, TRB_pct: 12.9, AST_pct: 5.8, STL_pct: 3.2, BLK_pct: 2.1, TOV_pct: 24, USG_pct: 28.6, OWS: -1.1, DWS: 0.5, WS: -0.6, WS40: -0.074, MIN_pg: 10.5, PTS_pg: 4.1, REB_pg: 2.1, AST_pg: 0.3, STL_pg: 0.6, BLK_pg: 0.3, FG_pct: 0.406, FG3_pct: 0.000, FT_pct: 0.481 },
      2000: { team: 'NYL', age: 30, G: 31, MP: 978, MP_pct: 0.761, PER: 20.1, TS_pct: 0.507, ThrPAr: 0.022, FTr: 0.357, ORB_pct: 12.1, TRB_pct: 17, AST_pct: 6.5, STL_pct: 3.6, BLK_pct: 2, TOV_pct: 16.8, USG_pct: 26.2, OWS: 1, DWS: 2.8, WS: 3.8, WS40: 0.155, MIN_pg: 31.5, PTS_pg: 13.8, REB_pg: 8.0, AST_pg: 0.9, STL_pg: 1.9, BLK_pg: 0.7, FG_pct: 0.467, FG3_pct: 0.250, FT_pct: 0.654 },
      2001: { team: 'NYL', age: 31, G: 32, MP: 1049, MP_pct: 0.82, PER: 21.2, TS_pct: 0.526, ThrPAr: 0.01, FTr: 0.305, ORB_pct: 11.6, TRB_pct: 16.5, AST_pct: 7.2, STL_pct: 2.7, BLK_pct: 1.5, TOV_pct: 15.3, USG_pct: 27, OWS: 2.1, DWS: 1.8, WS: 3.9, WS40: 0.15, MIN_pg: 32.8, PTS_pg: 15.3, REB_pg: 8.0, AST_pg: 1.1, STL_pg: 1.5, BLK_pg: 0.5, FG_pct: 0.507, FG3_pct: 0.000, FT_pct: 0.584 },
      2002: { team: 'NYL', age: 32, G: 32, MIN_pg: 31.5, PTS_pg: 14.1, REB_pg: 7.0, AST_pg: 1.3, STL_pg: 1.8, BLK_pg: 0.4, FG_pct: 0.491, FG3_pct: 0.000, FT_pct: 0.675 },
      2003: { team: 'NYL', age: 33, G: 33, MIN_pg: 31.3, PTS_pg: 11.3, REB_pg: 8.5, AST_pg: 1.7, STL_pg: 1.7, BLK_pg: 0.8, FG_pct: 0.397, FG3_pct: 0.200, FT_pct: 0.649 },
      2004: { team: 'NYL', age: 34, G: 13, MIN_pg: 23.9, PTS_pg: 6.7, REB_pg: 5.4, AST_pg: 1.2, STL_pg: 1.1, BLK_pg: 0.8, FG_pct: 0.347, FG3_pct: 0.000, FT_pct: 0.457 },
      2005: { team: 'HOU', age: 35, G: 32, MIN_pg: 11.4, PTS_pg: 3.5, REB_pg: 2.5, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.3, FG_pct: 0.426, FG3_pct: 0.000, FT_pct: 0.646 },
      2006: { team: 'HOU', age: 36, G: 21, MIN_pg: 10.6, PTS_pg: 2.8, REB_pg: 2.2, AST_pg: 0.2, STL_pg: 0.4, BLK_pg: 0.2, FG_pct: 0.385, FG3_pct: 0.000, FT_pct: 0.655 },
      2007: { team: 'HOU', age: 37, G: 6, MIN_pg: 5.8, PTS_pg: 1.7, REB_pg: 0.8, AST_pg: 0.2, STL_pg: 0.5, BLK_pg: 0.0, FG_pct: 0.300, FG3_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'pollica01w': {
    id: 'pollica01w',
    name: 'Catarina Pollini',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 31, G: 13, MP: 94, MP_pct: 0.083, PER: 4.6, TS_pct: 0.403, ThrPAr: 0, FTr: 0.545, ORB_pct: 4.1, TRB_pct: 8.4, AST_pct: 10, STL_pct: 2.4, BLK_pct: 0.9, TOV_pct: 22.7, USG_pct: 17.6, OWS: -0.1, DWS: 0.1, WS: 0, WS40: 0.005 },
      1999: { G: 30, MIN_pg: 18.8, PTS_pg: 5.3, REB_pg: 1.6, AST_pg: 1.7, STL_pg: 0.6, BLK_pg: 0.1, TOV_pg: 1.3, FG_pct: 0.408, FG3_pct: 0.354, FT_pct: 0.909 },
      2000: { G: 32, MIN_pg: 19.8, PTS_pg: 7.2, REB_pg: 1.9, AST_pg: 1.8, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 1.5, FG_pct: 0.398, FG3_pct: 0.386, FT_pct: 0.826 },
      2001: { G: 30, MIN_pg: 16.8, PTS_pg: 5.6, REB_pg: 1.8, AST_pg: 1.9, STL_pg: 0.9, BLK_pg: 0.5, TOV_pg: 1.3, FG_pct: 0.380, FG3_pct: 0.404, FT_pct: 0.774 },
    },
  },
  'potthan01w': {
    id: 'potthan01w',
    name: 'Angie Potthoff',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 25, G: 32, MP: 710, MP_pct: 0.548, PER: 6.6, TS_pct: 0.411, ThrPAr: 0.129, FTr: 0.236, ORB_pct: 4.6, TRB_pct: 8, AST_pct: 10.4, STL_pct: 2, BLK_pct: 0.7, TOV_pct: 18.5, USG_pct: 13.5, OWS: -0.6, DWS: 0.7, WS: 0.2, WS40: 0.009 },
      2000: { team: 'MIN', age: 26, G: 3, MP: 8, MP_pct: 0.006, PER: -7.4, TS_pct: 0, ThrPAr: 0.5, FTr: 0, ORB_pct: 0, TRB_pct: 17.4, AST_pct: 20.9, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 12.4, OWS: 0, DWS: 0, WS: 0, WS40: -0.146 },
      1997: { G: 27, MIN_pg: 25.6, PTS_pg: 10.6, REB_pg: 4.4, AST_pg: 0.7, STL_pg: 1, BLK_pg: 0.5, TOV_pg: 2.7, FG_pct: 0.459, FG3_pct: 0.286, FT_pct: 0.705 },
      1998: { G: 30, MIN_pg: 19, PTS_pg: 6.8, REB_pg: 4.8, AST_pg: 0.4, STL_pg: 0.8, BLK_pg: 0.8, TOV_pg: 1.8, FG_pct: 0.437, FG3_pct: 0.000, FT_pct: 0.614 },
    },
  },
  'powelel01w': {
    id: 'powelel01w',
    name: 'Elaine Powell',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 23, G: 18, MP: 256, MP_pct: 0.198, PER: 11.1, TS_pct: 0.551, ThrPAr: 0.273, FTr: 0.667, ORB_pct: 4.6, TRB_pct: 5.9, AST_pct: 22.8, STL_pct: 2, BLK_pct: 1.4, TOV_pct: 30.8, USG_pct: 11.6, OWS: 0.2, DWS: 0.1, WS: 0.4, WS40: 0.058, MIN_pg: 7.8, PTS_pg: 1.5, REB_pg: 1.5, AST_pg: 0.3, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.7, FG_pct: 0.319, FG3_pct: 0.000, FT_pct: 0.833 },
      2000: { team: 'ORL', age: 24, G: 20, MP: 347, MP_pct: 0.267, PER: 11.3, TS_pct: 0.476, ThrPAr: 0.136, FTr: 0.333, ORB_pct: 6.4, TRB_pct: 9.6, AST_pct: 21.4, STL_pct: 2, BLK_pct: 0.2, TOV_pct: 28.4, USG_pct: 15, OWS: 0, DWS: 0.2, WS: 0.3, WS40: 0.03, MIN_pg: 12.8, PTS_pg: 2.7, REB_pg: 2, AST_pg: 0.7, STL_pg: 0.7, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.361, FG3_pct: 0.000, FT_pct: 0.692 },
      2001: { team: 'ORL', age: 25, G: 32, MP: 1055, MP_pct: 0.818, PER: 15.5, TS_pct: 0.521, ThrPAr: 0.345, FTr: 0.358, ORB_pct: 3.9, TRB_pct: 6.2, AST_pct: 19.2, STL_pct: 2.7, BLK_pct: 0.6, TOV_pct: 18.7, USG_pct: 19.1, OWS: 2.3, DWS: 0.3, WS: 2.6, WS40: 0.099, MIN_pg: 4.2, PTS_pg: 0.8, REB_pg: 0.6, AST_pg: 0, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.250, FG3_pct: 0.000, FT_pct: 0.500 },
      2002: { G: 2, MIN_pg: 2, PTS_pg: 2.5, REB_pg: 0.5, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'pricefr01w': {
    id: 'pricefr01w',
    name: 'Franthea Price',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 30, G: 26, MP: 379, MP_pct: 0.315, PER: 14.2, TS_pct: 0.517, ThrPAr: 0.678, FTr: 0.157, ORB_pct: 2.3, TRB_pct: 7.4, AST_pct: 18.6, STL_pct: 2.9, BLK_pct: 0.5, TOV_pct: 20.7, USG_pct: 19.1, OWS: 0.4, DWS: 0.4, WS: 0.8, WS40: 0.08 },
    },
  },
  'pridely01w': {
    id: 'pridely01w',
    name: 'Lynn Pride',
    position: 'G-F',
    retired: true,
    seasons: {
      2000: { team: 'POR', age: 21, G: 32, MP: 462, MP_pct: 0.354, PER: 8.9, TS_pct: 0.418, ThrPAr: 0.076, FTr: 0.356, ORB_pct: 6.5, TRB_pct: 9.1, AST_pct: 17.5, STL_pct: 1.9, BLK_pct: 1.8, TOV_pct: 19.5, USG_pct: 17.6, OWS: -0.3, DWS: 0.4, WS: 0.1, WS40: 0.012, MIN_pg: 14.4, PTS_pg: 3.6, REB_pg: 1.9, AST_pg: 1.3, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.347, FG3_pct: 0.333, FT_pct: 0.690 },
      2001: { team: 'MIN', age: 22, G: 32, MP: 713, MP_pct: 0.551, PER: 10.6, TS_pct: 0.429, ThrPAr: 0.023, FTr: 0.316, ORB_pct: 8.6, TRB_pct: 13.1, AST_pct: 9.3, STL_pct: 2.3, BLK_pct: 2.5, TOV_pct: 18.8, USG_pct: 16.8, OWS: -0.4, DWS: 1.1, WS: 0.7, WS40: 0.039, MIN_pg: 22.3, PTS_pg: 5.3, REB_pg: 4.6, AST_pg: 0.9, STL_pg: 0.9, BLK_pg: 0.6, TOV_pg: 1.4, FG_pct: 0.391, FG3_pct: 0.250, FT_pct: 0.600 },
    },
  },
  'quinnte01w': {
    id: 'quinnte01w',
    name: 'Texlin Quinney',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 25, G: 17, MP: 118, MP_pct: 0.092, PER: 8.6, TS_pct: 0.463, ThrPAr: 0, FTr: 0.357, ORB_pct: 13, TRB_pct: 9.2, AST_pct: 22.4, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 38.2, USG_pct: 10.9, OWS: 0, DWS: 0, WS: 0, WS40: 0.004 },
    },
  },
  'radunha01w': {
    id: 'radunha01w',
    name: 'Hajdana Radunovic',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'NYL', age: 23, G: 4, MP: 9, MP_pct: 0.007, PER: 15.9, TS_pct: 0.694, ThrPAr: 0, FTr: 1, ORB_pct: 15.2, TRB_pct: 30, AST_pct: 0, STL_pct: 0, BLK_pct: 10.4, TOV_pct: 41, USG_pct: 27.9, OWS: 0, DWS: 0, WS: 0, WS40: 0.124 },
    },
  },
  'randase01w': {
    id: 'randase01w',
    name: 'Semeka Randall',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'SEA', age: 22, G: 32, MP: 884, MP_pct: 0.675, PER: 10.8, TS_pct: 0.418, ThrPAr: 0.013, FTr: 0.317, ORB_pct: 4.5, TRB_pct: 8, AST_pct: 12.6, STL_pct: 2, BLK_pct: 0.4, TOV_pct: 16.9, USG_pct: 25.4, OWS: -1.4, DWS: 0.6, WS: -0.8, WS40: -0.034, MIN_pg: 27.6, PTS_pg: 9.4, REB_pg: 3.3, AST_pg: 1.4, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 2.3, FG_pct: 0.371, FG3_pct: 0.000, FT_pct: 0.660 },
    },
  },
  'rasmukr01w': {
    id: 'rasmukr01w',
    name: 'Kristen Rasmussen',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'UTA', age: 21, G: 1, MP: 9, MP_pct: 0.007, PER: 6.7, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 15, TRB_pct: 14.3, AST_pct: 16.6, STL_pct: 6.1, BLK_pct: 0, TOV_pct: 100, USG_pct: 5.1, OWS: 0, DWS: 0, WS: 0, WS40: 0.001, MIN_pg: 18.2, PTS_pg: 5, REB_pg: 3.8, AST_pg: 1.1, STL_pg: 1, BLK_pg: 0.6, TOV_pg: 1.2, FG_pct: 0.350, FG3_pct: 0.286, FT_pct: 0.844 },
      2001: { team: 'MIA', age: 22, G: 28, MP: 416, MP_pct: 0.316, PER: 8.4, TS_pct: 0.403, ThrPAr: 0.047, FTr: 0.186, ORB_pct: 10.9, TRB_pct: 14.6, AST_pct: 7.7, STL_pct: 1.6, BLK_pct: 3.3, TOV_pct: 25, USG_pct: 15.8, OWS: -0.6, DWS: 0.9, WS: 0.3, WS40: 0.028, MIN_pg: 14.9, PTS_pg: 2.7, REB_pg: 3.1, AST_pg: 0.6, STL_pg: 0.4, BLK_pg: 0.5, TOV_pg: 1.1, FG_pct: 0.360, FG3_pct: 0.250, FT_pct: 0.750 },
    },
  },
  'reddja01w': {
    id: 'reddja01w',
    name: 'Jamie Redd',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 22, G: 26, MP: 387, MP_pct: 0.299, PER: 11.7, TS_pct: 0.5, ThrPAr: 0.416, FTr: 0.272, ORB_pct: 6.2, TRB_pct: 8.4, AST_pct: 10.6, STL_pct: 2.9, BLK_pct: 0.2, TOV_pct: 20, USG_pct: 23.3, OWS: -0.2, DWS: 0.4, WS: 0.1, WS40: 0.013 },
      2001: { team: 'SEA', age: 23, G: 32, MP: 659, MP_pct: 0.503, PER: 12.1, TS_pct: 0.471, ThrPAr: 0.356, FTr: 0.306, ORB_pct: 5.4, TRB_pct: 8.4, AST_pct: 18.1, STL_pct: 1.6, BLK_pct: 0.4, TOV_pct: 16.4, USG_pct: 23.1, OWS: 0.4, DWS: 0.4, WS: 0.8, WS40: 0.049 },
    },
  },
  'reedbr01w': {
    id: 'reedbr01w',
    name: 'Brandy Reed',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'PHO', age: 21, G: 24, MP: 254, MP_pct: 0.209, PER: 24.9, TS_pct: 0.571, ThrPAr: 0.084, FTr: 0.326, ORB_pct: 17.8, TRB_pct: 19.8, AST_pct: 17.5, STL_pct: 3.9, BLK_pct: 2.2, TOV_pct: 23.3, USG_pct: 25.6, OWS: 0.7, DWS: 0.7, WS: 1.4, WS40: 0.217, MIN_pg: 10.6, PTS_pg: 5.2, REB_pg: 3.3, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.4, FG_pct: 0.526, FG3_pct: 0.250, FT_pct: 0.710 },
      1999: { team: 'MIN', age: 22, G: 25, MP: 757, MP_pct: 0.585, PER: 23.7, TS_pct: 0.507, ThrPAr: 0.104, FTr: 0.191, ORB_pct: 9.1, TRB_pct: 13.4, AST_pct: 23.8, STL_pct: 2.3, BLK_pct: 2.2, TOV_pct: 13.7, USG_pct: 30.6, OWS: 1.5, DWS: 1.2, WS: 2.7, WS40: 0.144, MIN_pg: 30.3, PTS_pg: 16.1, REB_pg: 6, AST_pg: 2.6, STL_pg: 1.2, BLK_pg: 0.7, TOV_pg: 2.5, FG_pct: 0.459, FG3_pct: 0.342, FT_pct: 0.757 },
      2000: { team: 'PHO', age: 23, G: 32, MP: 1090, MP_pct: 0.848, PER: 28.7, TS_pct: 0.586, ThrPAr: 0.094, FTr: 0.311, ORB_pct: 7.6, TRB_pct: 11.8, AST_pct: 19.1, STL_pct: 3.6, BLK_pct: 1.8, TOV_pct: 14.8, USG_pct: 28.5, OWS: 5.1, DWS: 2.2, WS: 7.3, WS40: 0.269, MIN_pg: 34.1, PTS_pg: 19, REB_pg: 5.9, AST_pg: 2.7, STL_pg: 2.1, BLK_pg: 0.7, TOV_pg: 2.8, FG_pct: 0.507, FG3_pct: 0.419, FT_pct: 0.901 },
      2001: { team: 'PHO', age: 24, G: 1, MP: 13, MP_pct: 0.01, PER: -5, TS_pct: 0.178, ThrPAr: 0, FTr: 0.125, ORB_pct: 0, TRB_pct: 15.1, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 31.4, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.321, MIN_pg: 13, PTS_pg: 3, REB_pg: 3, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0, FG_pct: 0.125, FG3_pct: 0.000, FT_pct: 1.000 },
    },
  },
  'reedmi01w': {
    id: 'reedmi01w',
    name: 'Michelle Reed',
    position: 'G-F',
    retired: true,
    seasons: {
      1998: { team: 'LAS', age: 25, G: 9, MP: 49, MP_pct: 0.041, PER: 8.3, TS_pct: 0.43, ThrPAr: 0.364, FTr: 1.091, ORB_pct: 4.9, TRB_pct: 13.4, AST_pct: 6.8, STL_pct: 2.2, BLK_pct: 1.6, TOV_pct: 26.9, USG_pct: 20.3, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.023 },
    },
  },
  'reidtr01w': {
    id: 'reidtr01w',
    name: 'Tracy Reid',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 21, G: 30, MP: 966, MP_pct: 0.805, PER: 18.3, TS_pct: 0.53, ThrPAr: 0.006, FTr: 0.584, ORB_pct: 7.7, TRB_pct: 10, AST_pct: 9.4, STL_pct: 2.2, BLK_pct: 1, TOV_pct: 15.4, USG_pct: 22.1, OWS: 2.3, DWS: 1.3, WS: 3.6, WS40: 0.149, MIN_pg: 32.2, PTS_pg: 13.8, REB_pg: 5.2, AST_pg: 1.5, STL_pg: 1.3, BLK_pg: 0.4, TOV_pg: 2.4, FG_pct: 0.487, FG3_pct: 0.000, FT_pct: 0.613 },
      1999: { team: 'CHA', age: 22, G: 10, MP: 154, MP_pct: 0.12, PER: 7, TS_pct: 0.435, ThrPAr: 0.02, FTr: 0.286, ORB_pct: 6.5, TRB_pct: 10.1, AST_pct: 12.2, STL_pct: 0.4, BLK_pct: 1.1, TOV_pct: 23.6, USG_pct: 24, OWS: -0.4, DWS: 0.1, WS: -0.4, WS40: -0.093, MIN_pg: 15.4, PTS_pg: 4.8, REB_pg: 2.3, AST_pg: 0.9, STL_pg: 0.1, BLK_pg: 0.2, TOV_pg: 1.7, FG_pct: 0.429, FG3_pct: 0.000, FT_pct: 0.429 },
      2000: { team: 'CHA', age: 23, G: 29, MP: 620, MP_pct: 0.479, PER: 12.6, TS_pct: 0.498, ThrPAr: 0.011, FTr: 0.4, ORB_pct: 9.7, TRB_pct: 10.9, AST_pct: 9.6, STL_pct: 1.3, BLK_pct: 1.2, TOV_pct: 19.4, USG_pct: 20.7, OWS: 0.1, DWS: -0.3, WS: -0.3, WS40: -0.017, MIN_pg: 21.4, PTS_pg: 7.3, REB_pg: 3.4, AST_pg: 1, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 1.8, FG_pct: 0.478, FG3_pct: 0.000, FT_pct: 0.542 },
      2001: { team: 'MIA', age: 24, G: 21, MP: 278, MP_pct: 0.211, PER: 13.3, TS_pct: 0.537, ThrPAr: 0, FTr: 0.413, ORB_pct: 4.9, TRB_pct: 9.2, AST_pct: 10.2, STL_pct: 3.4, BLK_pct: 1.8, TOV_pct: 25.1, USG_pct: 19, OWS: 0, DWS: 0.6, WS: 0.6, WS40: 0.087, MIN_pg: 13.2, PTS_pg: 3.8, REB_pg: 1.8, AST_pg: 0.6, STL_pg: 0.7, BLK_pg: 0.2, TOV_pg: 1.2, FG_pct: 0.508, FG3_pct: 0.000, FT_pct: 0.615 },
    },
  },
  'reissta01w': {
    id: 'reissta01w',
    name: 'Tammi Reiss',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 27, G: 28, MP: 831, MP_pct: 0.735, PER: 9.6, TS_pct: 0.423, ThrPAr: 0.437, FTr: 0.238, ORB_pct: 3.9, TRB_pct: 5.3, AST_pct: 20.8, STL_pct: 1.5, BLK_pct: 0.2, TOV_pct: 19.3, USG_pct: 17, OWS: 0.2, DWS: -0.7, WS: -0.5, WS40: -0.024, MIN_pg: 29.7, PTS_pg: 7.7, REB_pg: 2.8, AST_pg: 3.1, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2.2, FG_pct: 0.312, FG3_pct: 0.297, FT_pct: 0.764 },
      1998: { team: 'UTA', age: 28, G: 22, MP: 477, MP_pct: 0.394, PER: 12.3, TS_pct: 0.487, ThrPAr: 0.403, FTr: 0.216, ORB_pct: 3.6, TRB_pct: 4.9, AST_pct: 19, STL_pct: 1.2, BLK_pct: 0.2, TOV_pct: 14.6, USG_pct: 16.5, OWS: 0.8, DWS: -0.3, WS: 0.4, WS40: 0.037, MIN_pg: 21.7, PTS_pg: 6.5, REB_pg: 1.8, AST_pg: 2.2, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 1.1, FG_pct: 0.403, FG3_pct: 0.296, FT_pct: 0.655 },
    },
  },
  'rileyru01w': {
    id: 'rileyru01w',
    name: 'Ruth Riley',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'MIA', age: 21, G: 32, MP: 799, MP_pct: 0.608, PER: 13.9, TS_pct: 0.549, ThrPAr: 0, FTr: 0.512, ORB_pct: 8.8, TRB_pct: 11.2, AST_pct: 6.8, STL_pct: 1.9, BLK_pct: 5.7, TOV_pct: 24.1, USG_pct: 17.4, OWS: 0.7, DWS: 1.7, WS: 2.4, WS40: 0.121, MIN_pg: 25, PTS_pg: 6.8, REB_pg: 4.1, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 1.4, TOV_pg: 2, FG_pct: 0.475, FT_pct: 0.771 },
    },
  },
  'rizzoje01w': {
    id: 'rizzoje01w',
    name: 'Jennifer Rizzotti',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'HOU', age: 25, G: 25, MP: 242, MP_pct: 0.188, PER: 9.6, TS_pct: 0.464, ThrPAr: 0.65, FTr: 0.3, ORB_pct: 1.1, TRB_pct: 7.3, AST_pct: 13.2, STL_pct: 4.3, BLK_pct: 0.4, TOV_pct: 26.1, USG_pct: 12.3, OWS: -0.1, DWS: 0.6, WS: 0.5, WS40: 0.078, MIN_pg: 9.7, PTS_pg: 1.7, REB_pg: 1.1, AST_pg: 0.8, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 0.6, FG_pct: 0.350, FG3_pct: 0.269, FT_pct: 0.583 },
      2000: { team: 'HOU', age: 26, G: 32, MP: 437, MP_pct: 0.337, PER: 7.5, TS_pct: 0.509, ThrPAr: 0.709, FTr: 0.164, ORB_pct: 2, TRB_pct: 5.6, AST_pct: 15.7, STL_pct: 2, BLK_pct: 0.4, TOV_pct: 30.6, USG_pct: 9.6, OWS: 0.1, DWS: 0.7, WS: 0.9, WS40: 0.079, MIN_pg: 13.7, PTS_pg: 1.9, REB_pg: 1.1, AST_pg: 1.4, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.382, FG3_pct: 0.308, FT_pct: 0.667 },
      2001: { team: 'CLE', age: 27, G: 32, MP: 476, MP_pct: 0.37, PER: 11.8, TS_pct: 0.518, ThrPAr: 0.664, FTr: 0.1, ORB_pct: 0.6, TRB_pct: 4.4, AST_pct: 21.2, STL_pct: 3.3, BLK_pct: 0.4, TOV_pct: 26.3, USG_pct: 17.3, OWS: 0.1, DWS: 1.1, WS: 1.2, WS40: 0.098, MIN_pg: 14.9, PTS_pg: 3.7, REB_pg: 0.9, AST_pg: 1.6, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.3, FG_pct: 0.382, FG3_pct: 0.384, FT_pct: 0.636 },
    },
  },
  'roberny01w': {
    id: 'roberny01w',
    name: 'Nyree Roberts',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'HOU', age: 22, G: 14, MP: 55, MP_pct: 0.045, PER: 16.3, TS_pct: 0.794, ThrPAr: 0, FTr: 1, ORB_pct: 7.1, TRB_pct: 11.7, AST_pct: 6.7, STL_pct: 1, BLK_pct: 0, TOV_pct: 28.4, USG_pct: 12.2, OWS: 0.2, DWS: 0.1, WS: 0.3, WS40: 0.187, MIN_pg: 3.9, PTS_pg: 1.1, REB_pg: 0.7, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.857, FG3_pct: 0.000, FT_pct: 0.571 },
      1999: { team: 'WAS', age: 23, G: 8, MP: 62, MP_pct: 0.048, PER: 9.1, TS_pct: 0.612, ThrPAr: 0, FTr: 0.7, ORB_pct: 4.4, TRB_pct: 10.4, AST_pct: 3.3, STL_pct: 4.6, BLK_pct: 1.3, TOV_pct: 43.3, USG_pct: 18.1, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.044, MIN_pg: 6, PTS_pg: 1.1, REB_pg: 0.9, AST_pg: 0.05, STL_pg: 0.3, BLK_pg: 0.05, TOV_pg: 0.8, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.542 },
    },
  },
  'robincr01w': {
    id: 'robincr01w',
    name: 'Crystal Robinson',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'NYL', age: 25, G: 32, MP: 901, MP_pct: 0.69, PER: 20, TS_pct: 0.604, ThrPAr: 0.611, FTr: 0.204, ORB_pct: 5.5, TRB_pct: 6.7, AST_pct: 11.5, STL_pct: 2.9, BLK_pct: 1.2, TOV_pct: 12.9, USG_pct: 19.6, OWS: 3.5, DWS: 1.3, WS: 4.8, WS40: 0.213, MIN_pg: 28.2, PTS_pg: 11.7, REB_pg: 2.8, AST_pg: 1.5, STL_pg: 1.4, BLK_pg: 0.3, TOV_pg: 1.4, FG_pct: 0.439, FG3_pct: 0.437, FT_pct: 0.845 },
      2000: { team: 'NYL', age: 26, G: 27, MP: 722, MP_pct: 0.562, PER: 15.1, TS_pct: 0.552, ThrPAr: 0.507, FTr: 0.164, ORB_pct: 4.9, TRB_pct: 6.3, AST_pct: 13.4, STL_pct: 1.9, BLK_pct: 1.3, TOV_pct: 13.3, USG_pct: 17.4, OWS: 1.9, DWS: 1, WS: 2.8, WS40: 0.157, MIN_pg: 26.7, PTS_pg: 8.8, REB_pg: 2.5, AST_pg: 1.8, STL_pg: 0.9, BLK_pg: 0.4, TOV_pg: 1.2, FG_pct: 0.428, FG3_pct: 0.353, FT_pct: 0.909 },
      2001: { team: 'NYL', age: 27, G: 32, MP: 980, MP_pct: 0.766, PER: 18.8, TS_pct: 0.611, ThrPAr: 0.629, FTr: 0.109, ORB_pct: 3.2, TRB_pct: 6.3, AST_pct: 16.1, STL_pct: 1.9, BLK_pct: 0.8, TOV_pct: 9.1, USG_pct: 16.2, OWS: 4.2, DWS: 0.7, WS: 4.9, WS40: 0.199, MIN_pg: 30.6, PTS_pg: 10.7, REB_pg: 2.9, AST_pg: 2.6, STL_pg: 1, BLK_pg: 0.3, TOV_pg: 0.9, FG_pct: 0.461, FG3_pct: 0.417, FT_pct: 0.897 },
    },
  },
  'robinre01w': {
    id: 'robinre01w',
    name: 'Renee Robinson',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'WAS', age: 22, G: 2, MP: 5, MP_pct: 0.004, PER: 26.1, TS_pct: 0.725, ThrPAr: 1, FTr: 4, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 11.6, BLK_pct: 0, TOV_pct: 26.6, USG_pct: 37.4, OWS: 0, DWS: 0, WS: 0.1, WS40: 0.463 },
    },
  },
  'rolanja01w': {
    id: 'rolanja01w',
    name: 'Jannon Roland',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 25, G: 21, MP: 173, MP_pct: 0.133, PER: 2.7, TS_pct: 0.407, ThrPAr: 0.27, FTr: 0.216, ORB_pct: 5.3, TRB_pct: 6.6, AST_pct: 8.2, STL_pct: 2, BLK_pct: 0, TOV_pct: 31.9, USG_pct: 17, OWS: -0.5, DWS: 0.1, WS: -0.5, WS40: -0.113 },
    },
  },
  'rycraeu01w': {
    id: 'rycraeu01w',
    name: 'Eugenia Rycraw',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'LAS', age: 29, G: 20, MP: 226, MP_pct: 0.188, PER: 12.5, TS_pct: 0.552, ThrPAr: 0, FTr: 0.688, ORB_pct: 9.1, TRB_pct: 13.2, AST_pct: 3, STL_pct: 1.6, BLK_pct: 6.3, TOV_pct: 25.1, USG_pct: 11, OWS: 0.2, DWS: 0.3, WS: 0.6, WS40: 0.098 },
    },
  },
  'salesny01w': {
    id: 'salesny01w',
    name: 'Nykesha Sales',
    position: 'F-G',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 23, G: 32, MP: 1039, MP_pct: 0.805, PER: 19, TS_pct: 0.487, ThrPAr: 0.275, FTr: 0.297, ORB_pct: 5.5, TRB_pct: 8.5, AST_pct: 18.7, STL_pct: 3.8, BLK_pct: 0.7, TOV_pct: 13.3, USG_pct: 23.9, OWS: 2.4, DWS: 1.4, WS: 3.8, WS40: 0.147, MIN_pg: 32.5, PTS_pg: 13.7, REB_pg: 4.2, AST_pg: 2.8, STL_pg: 2.2, BLK_pg: 0.3, TOV_pg: 2.2, FG_pct: 0.385, FG3_pct: 0.330, FT_pct: 0.805 },
      2000: { team: 'ORL', age: 24, G: 32, MP: 995, MP_pct: 0.765, PER: 18.8, TS_pct: 0.524, ThrPAr: 0.311, FTr: 0.162, ORB_pct: 5.7, TRB_pct: 9.4, AST_pct: 14.8, STL_pct: 2.7, BLK_pct: 1, TOV_pct: 14, USG_pct: 23.6, OWS: 2.2, DWS: 1, WS: 3.2, WS40: 0.13, MIN_pg: 31.1, PTS_pg: 13.4, REB_pg: 4.3, AST_pg: 2.2, STL_pg: 1.5, BLK_pg: 0.4, TOV_pg: 2.1, FG_pct: 0.444, FG3_pct: 0.395, FT_pct: 0.694 },
      2001: { team: 'ORL', age: 25, G: 32, MP: 1039, MP_pct: 0.805, PER: 19.3, TS_pct: 0.526, ThrPAr: 0.361, FTr: 0.195, ORB_pct: 7, TRB_pct: 11, AST_pct: 12.8, STL_pct: 3.9, BLK_pct: 0.5, TOV_pct: 14.9, USG_pct: 22.2, OWS: 2.8, DWS: 1.2, WS: 4, WS40: 0.154, MIN_pg: 32.5, PTS_pg: 13.5, REB_pg: 5.4, AST_pg: 1.8, STL_pg: 2.2, BLK_pg: 0.2, TOV_pg: 2.3, FG_pct: 0.438, FG3_pct: 0.314, FT_pct: 0.784 },
    },
  },
  'sampsch01w': {
    id: 'sampsch01w',
    name: 'Charisse Sampson',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 25, G: 21, MP: 280, MP_pct: 0.216, PER: 16.4, TS_pct: 0.652, ThrPAr: 0.5, FTr: 0.609, ORB_pct: 6.2, TRB_pct: 10.3, AST_pct: 8.9, STL_pct: 3.8, BLK_pct: 2, TOV_pct: 19.4, USG_pct: 13.3, OWS: 0.7, DWS: 0.4, WS: 1.2, WS40: 0.169, MIN_pg: 13.3, PTS_pg: 3.7, REB_pg: 2, AST_pg: 0.5, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 0.7, FG_pct: 0.468, FG3_pct: 0.391, FT_pct: 0.893 },
    },
  },
  'samsh01w': {
    id: 'samsh01w',
    name: 'Sheri Sam',
    position: 'G-F',
    retired: true,
    seasons: {
      1999: { team: 'ORL', age: 25, G: 32, MP: 1088, MP_pct: 0.843, PER: 13.6, TS_pct: 0.479, ThrPAr: 0.362, FTr: 0.232, ORB_pct: 4.7, TRB_pct: 8.8, AST_pct: 14.4, STL_pct: 2.1, BLK_pct: 0.7, TOV_pct: 14.4, USG_pct: 19.6, OWS: 1.4, DWS: 1, WS: 2.4, WS40: 0.088, MIN_pg: 34, PTS_pg: 11.4, REB_pg: 4.6, AST_pg: 2.4, STL_pg: 1.3, BLK_pg: 0.3, TOV_pg: 2, FG_pct: 0.388, FG3_pct: 0.328, FT_pct: 0.688 },
      2000: { team: 'MIA', age: 26, G: 31, MP: 904, MP_pct: 0.698, PER: 16.1, TS_pct: 0.467, ThrPAr: 0.316, FTr: 0.263, ORB_pct: 5.4, TRB_pct: 10, AST_pct: 21.7, STL_pct: 2.4, BLK_pct: 0.5, TOV_pct: 14.9, USG_pct: 27.5, OWS: 0.5, DWS: 1.6, WS: 2.1, WS40: 0.094, MIN_pg: 29.2, PTS_pg: 12.8, REB_pg: 4.3, AST_pg: 2.1, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 2.4, FG_pct: 0.387, FG3_pct: 0.292, FT_pct: 0.670 },
      2001: { team: 'MIA', age: 27, G: 32, MP: 1100, MP_pct: 0.837, PER: 18.4, TS_pct: 0.493, ThrPAr: 0.235, FTr: 0.182, ORB_pct: 5.1, TRB_pct: 8.6, AST_pct: 19.5, STL_pct: 3.1, BLK_pct: 0.7, TOV_pct: 16.2, USG_pct: 25.9, OWS: 1.4, DWS: 2.1, WS: 3.6, WS40: 0.129, MIN_pg: 34.4, PTS_pg: 13.9, REB_pg: 4.3, AST_pg: 2.8, STL_pg: 1.7, BLK_pg: 0.3, TOV_pg: 2.7, FG_pct: 0.432, FG3_pct: 0.276, FT_pct: 0.750 },
    },
  },
  'santoal01w': {
    id: 'santoal01w',
    name: 'Alessandra Santos de Oliveira',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 24, G: 16, MP: 481, MP_pct: 0.399, PER: 13.1, TS_pct: 0.519, ThrPAr: 0, FTr: 0.885, ORB_pct: 14.5, TRB_pct: 16.5, AST_pct: 0.4, STL_pct: 1.3, BLK_pct: 1.1, TOV_pct: 24.5, USG_pct: 20.7, OWS: -0.1, DWS: -0.2, WS: -0.3, WS40: -0.023, MIN_pg: 30.1, PTS_pg: 11, REB_pg: 8.1, AST_pg: 0.1, STL_pg: 0.8, BLK_pg: 0.4, TOV_pg: 3.4, FG_pct: 0.516, FT_pct: 0.463 },
      1999: { team: 'WAS', age: 25, G: 13, MP: 216, MP_pct: 0.167, PER: 7.8, TS_pct: 0.524, ThrPAr: 0, FTr: 0.564, ORB_pct: 12, TRB_pct: 12.5, AST_pct: 1, STL_pct: 0.3, BLK_pct: 0.8, TOV_pct: 24.7, USG_pct: 14.5, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.004, MIN_pg: 16.6, PTS_pg: 3.9, REB_pg: 3.2, AST_pg: 0.1, STL_pg: 0.1, BLK_pg: 0.2, TOV_pg: 1.2, FG_pct: 0.564, FT_pct: 0.318 },
      2000: { team: 'IND', age: 26, G: 3, MP: 11, MP_pct: 0.009, PER: -6.3, TS_pct: 0.412, ThrPAr: 0, FTr: 6, ORB_pct: 0, TRB_pct: 18.6, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 35.5, USG_pct: 25.3, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.347, MIN_pg: 3.7, PTS_pg: 1, REB_pg: 1, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 1.000, FT_pct: 0.167 },
      2001: { team: 'SEA', age: 27, G: 10, MP: 62, MP_pct: 0.047, PER: 4.8, TS_pct: 0.345, ThrPAr: 0, FTr: 0.786, ORB_pct: 19.9, TRB_pct: 17.4, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 13.7, USG_pct: 18.3, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.035, MIN_pg: 6.2, PTS_pg: 1.3, REB_pg: 1.6, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.286, FT_pct: 0.455 },
    },
  },
  'santoke01w': {
    id: 'santoke01w',
    name: 'Kelly Santos',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'DET', age: 21, G: 14, MP: 153, MP_pct: 0.117, PER: 12.8, TS_pct: 0.521, ThrPAr: 0.024, FTr: 0.429, ORB_pct: 9.2, TRB_pct: 12, AST_pct: 7.1, STL_pct: 1.1, BLK_pct: 1.7, TOV_pct: 19.4, USG_pct: 20, OWS: 0.2, DWS: 0, WS: 0.2, WS40: 0.046, MIN_pg: 10.9, PTS_pg: 3.7, REB_pg: 1.9, AST_pg: 0.4, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.476, FG3_pct: 0.000, FT_pct: 0.667 },
    },
  },
  'sarenra01w': {
    id: 'sarenra01w',
    name: 'Rankica Sarenac',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'PHO', age: 26, G: 20, MP: 142, MP_pct: 0.111, PER: 14.4, TS_pct: 0.573, ThrPAr: 0.023, FTr: 0.614, ORB_pct: 10.9, TRB_pct: 14.6, AST_pct: 12.2, STL_pct: 0, BLK_pct: 0.6, TOV_pct: 23.3, USG_pct: 26.2, OWS: 0.2, DWS: 0.1, WS: 0.3, WS40: 0.095 },
    },
  },
  'sauerpa01w': {
    id: 'sauerpa01w',
    name: 'Paige Sauer',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'LAS', age: 22, G: 12, MP: 66, MP_pct: 0.051, PER: 12.8, TS_pct: 0.617, ThrPAr: 0, FTr: 0.357, ORB_pct: 5.9, TRB_pct: 15.1, AST_pct: 8.3, STL_pct: 1.7, BLK_pct: 1.3, TOV_pct: 27, USG_pct: 15.9, OWS: 0.1, DWS: 0.2, WS: 0.2, WS40: 0.129 },
      2001: { team: 'CLE', age: 23, G: 2, MP: 4, MP_pct: 0.003, PER: 11.9, TS_pct: 0.333, ThrPAr: 0, FTr: 0, ORB_pct: 36.1, TRB_pct: 34.7, AST_pct: 0, STL_pct: 0, BLK_pct: 24.2, TOV_pct: 25, USG_pct: 52.7, OWS: 0, DWS: 0, WS: 0, WS40: -0.234 },
      1997: { G: 14, MIN_pg: 11.2, PTS_pg: 2.4, REB_pg: 0.4, AST_pg: 0.9, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.244, FG3_pct: 0.200, FT_pct: 0.778 },
    },
  },
  'saundja01w': {
    id: 'saundja01w',
    name: 'Jaynetta Saunders',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 21, G: 28, MP: 253, MP_pct: 0.196, PER: 8.8, TS_pct: 0.386, ThrPAr: 0.039, FTr: 0.325, ORB_pct: 6.6, TRB_pct: 10.3, AST_pct: 5.6, STL_pct: 2.3, BLK_pct: 2.7, TOV_pct: 13.7, USG_pct: 19.5, OWS: -0.3, DWS: 0.3, WS: 0, WS40: -0.006 },
    },
  },
  'saureau01w': {
    id: 'saureau01w',
    name: 'Audrey Sauret',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'WAS', age: 24, G: 25, MP: 455, MP_pct: 0.35, PER: 4.3, TS_pct: 0.313, ThrPAr: 0.234, FTr: 0.216, ORB_pct: 2.9, TRB_pct: 5.7, AST_pct: 19.1, STL_pct: 3.1, BLK_pct: 0.7, TOV_pct: 25.2, USG_pct: 17.6, OWS: -1.7, DWS: 0.5, WS: -1.1, WS40: -0.1 },
    },
  },
  'savasla01w': {
    id: 'savasla01w',
    name: 'Laure Savasta',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 23, G: 14, MP: 157, MP_pct: 0.139, PER: -0.5, TS_pct: 0.337, ThrPAr: 0.444, FTr: 0.2, ORB_pct: 0.8, TRB_pct: 2.4, AST_pct: 13.8, STL_pct: 1.4, BLK_pct: 0.5, TOV_pct: 30, USG_pct: 19.9, OWS: -0.6, DWS: -0.2, WS: -0.8, WS40: -0.204 },
    },
  },
  'schumke01w': {
    id: 'schumke01w',
    name: 'Kelly Schumacher',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'IND', age: 23, G: 28, MP: 380, MP_pct: 0.293, PER: 15.6, TS_pct: 0.55, ThrPAr: 0.054, FTr: 0.215, ORB_pct: 8.3, TRB_pct: 12.5, AST_pct: 5.6, STL_pct: 0.8, BLK_pct: 6.5, TOV_pct: 17.1, USG_pct: 16.3, OWS: 0.7, DWS: 0.2, WS: 0.9, WS40: 0.092, MIN_pg: 13.6, PTS_pg: 4, REB_pg: 2.5, AST_pg: 0.4, STL_pg: 0.2, BLK_pg: 1, TOV_pg: 0.8, FG_pct: 0.495, FG3_pct: 0.600, FT_pct: 0.850 },
    },
  },
  'schwege01w': {
    id: 'schwege01w',
    name: 'Georgia Schweitzer',
    position: 'G-F',
    retired: true,
    seasons: {
      2001: { team: 'MIN', age: 22, G: 24, MP: 423, MP_pct: 0.327, PER: 9, TS_pct: 0.394, ThrPAr: 0.417, FTr: 0.165, ORB_pct: 4.6, TRB_pct: 7.6, AST_pct: 18.3, STL_pct: 1.5, BLK_pct: 1.3, TOV_pct: 13.3, USG_pct: 14.8, OWS: 0.1, DWS: 0.3, WS: 0.3, WS40: 0.029, MIN_pg: 17.6, PTS_pg: 3.5, REB_pg: 2.1, AST_pg: 1.4, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 0.7, FG_pct: 0.314, FG3_pct: 0.167, FT_pct: 0.765 },
    },
  },
  'scottol01w': {
    id: 'scottol01w',
    name: 'Olympia Scott',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'UTA', age: 22, G: 29, MP: 466, MP_pct: 0.385, PER: 11, TS_pct: 0.471, ThrPAr: 0.037, FTr: 0.481, ORB_pct: 9.7, TRB_pct: 10.9, AST_pct: 9.1, STL_pct: 2.7, BLK_pct: 1.7, TOV_pct: 23, USG_pct: 20.9, OWS: -0.3, DWS: 0.2, WS: -0.1, WS40: -0.007, MIN_pg: 3.8, PTS_pg: 1.9, REB_pg: 0.6, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.500, FG3_pct: 0.400, FT_pct: 0.706 },
      1999: { team: 'UTA', age: 23, G: 4, MP: 36, MP_pct: 0.028, PER: 5.9, TS_pct: 0.356, ThrPAr: 0, FTr: 0.6, ORB_pct: 18, TRB_pct: 14.2, AST_pct: 9.8, STL_pct: 1.5, BLK_pct: 0, TOV_pct: 19.2, USG_pct: 19.9, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.067, MIN_pg: 5.4, PTS_pg: 2.4, REB_pg: 0.8, AST_pg: 0.5, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.371, FG3_pct: 0.400, FT_pct: 0.750 },
      2000: { team: 'DET', age: 24, G: 28, MP: 369, MP_pct: 0.287, PER: 8, TS_pct: 0.469, ThrPAr: 0.022, FTr: 0.449, ORB_pct: 9.9, TRB_pct: 14.2, AST_pct: 13.2, STL_pct: 1.8, BLK_pct: 2.2, TOV_pct: 29.7, USG_pct: 18.7, OWS: -0.5, DWS: 0.3, WS: -0.2, WS40: -0.018, MIN_pg: 7.8, PTS_pg: 2.6, REB_pg: 1, AST_pg: 0.6, STL_pg: 0.4, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.333, FG3_pct: 0.379, FT_pct: 1.000 },
      2001: { team: 'IND', age: 25, G: 32, MP: 775, MP_pct: 0.598, PER: 14.8, TS_pct: 0.527, ThrPAr: 0.009, FTr: 0.512, ORB_pct: 9.2, TRB_pct: 14.2, AST_pct: 11.2, STL_pct: 1.7, BLK_pct: 1.3, TOV_pct: 21.3, USG_pct: 21.9, OWS: 1.1, DWS: 0.3, WS: 1.4, WS40: 0.071 },
    },
  },
  'scottra01w': {
    id: 'scottra01w',
    name: 'Raegan Scott',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 21, G: 8, MP: 43, MP_pct: 0.038, PER: 16, TS_pct: 0.432, ThrPAr: 0, FTr: 0.154, ORB_pct: 10.3, TRB_pct: 9.4, AST_pct: 4.9, STL_pct: 1.2, BLK_pct: 5.5, TOV_pct: 0, USG_pct: 14.4, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.092 },
      1998: { team: 'CLE', age: 22, G: 22, MP: 167, MP_pct: 0.137, PER: 7.7, TS_pct: 0.439, ThrPAr: 0.053, FTr: 0.316, ORB_pct: 4.4, TRB_pct: 11.7, AST_pct: 7.3, STL_pct: 1, BLK_pct: 2.5, TOV_pct: 17.2, USG_pct: 15.1, OWS: 0, DWS: 0.2, WS: 0.2, WS40: 0.043 },
    },
  },
  'shakiel01w': {
    id: 'shakiel01w',
    name: 'Elena Shakirova',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'HOU', age: 30, G: 14, MP: 150, MP_pct: 0.116, PER: 21.4, TS_pct: 0.64, ThrPAr: 0.4, FTr: 1.1, ORB_pct: 13.7, TRB_pct: 14.1, AST_pct: 4.4, STL_pct: 1.9, BLK_pct: 1.1, TOV_pct: 13.6, USG_pct: 17, OWS: 0.8, DWS: 0.3, WS: 1.1, WS40: 0.306 },
      2001: { team: 'HOU', age: 31, G: 26, MP: 203, MP_pct: 0.157, PER: 10, TS_pct: 0.395, ThrPAr: 0.184, FTr: 0.605, ORB_pct: 9.2, TRB_pct: 10.9, AST_pct: 8.5, STL_pct: 1.8, BLK_pct: 0.9, TOV_pct: 15.8, USG_pct: 14.1, OWS: 0, DWS: 0.3, WS: 0.3, WS40: 0.054 },
    },
  },
  'shulead01w': {
    id: 'shulead01w',
    name: 'Adrienne Shuler',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 29, G: 25, MP: 363, MP_pct: 0.301, PER: 10.7, TS_pct: 0.486, ThrPAr: 0.452, FTr: 0.202, ORB_pct: 3.8, TRB_pct: 8.8, AST_pct: 25.8, STL_pct: 3.3, BLK_pct: 0.6, TOV_pct: 30.9, USG_pct: 16.2, OWS: -0.2, DWS: 0, WS: -0.1, WS40: -0.013 },
      1999: { G: 21, MIN_pg: 5.6, PTS_pg: 1, REB_pg: 0.8, AST_pg: 0.3, STL_pg: 0, BLK_pg: 0.1, TOV_pg: 0.1, FG_pct: 0.333, FG3_pct: 0.000, FT_pct: 0.800 },
      2000: { G: 28, MIN_pg: 7.1, PTS_pg: 2.5, REB_pg: 1.5, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 1.1, FG_pct: 0.500, FG3_pct: 0.000, FT_pct: 0.543 },
      2001: { G: 22, MIN_pg: 11, PTS_pg: 1.9, REB_pg: 1.5, AST_pg: 0.5, STL_pg: 0.1, BLK_pg: 0.3, TOV_pg: 0.8, FG_pct: 0.375, FG3_pct: 0.000, FT_pct: 0.550 },
    },
  },
  'slaisma01w': {
    id: 'slaisma01w',
    name: 'Madinah Slaise',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 26, G: 3, MP: 7, MP_pct: 0.005, PER: 30.7, TS_pct: 0.532, ThrPAr: 0.5, FTr: 2, ORB_pct: 0, TRB_pct: 9.4, AST_pct: 0, STL_pct: 7.7, BLK_pct: 0, TOV_pct: 0, USG_pct: 24.5, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.407 },
    },
  },
  'smithch01w': {
    id: 'smithch01w',
    name: 'Christy Smith',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'CHA', age: 22, G: 24, MP: 448, MP_pct: 0.373, PER: 8.3, TS_pct: 0.531, ThrPAr: 0.76, FTr: 0.267, ORB_pct: 0.8, TRB_pct: 4.7, AST_pct: 26.2, STL_pct: 1.2, BLK_pct: 0, TOV_pct: 36.4, USG_pct: 13.6, OWS: -0.1, DWS: 0.3, WS: 0.3, WS40: 0.022 },
      1999: { team: 'CHA', age: 23, G: 4, MP: 19, MP_pct: 0.015, PER: 36.2, TS_pct: 0.979, ThrPAr: 0.75, FTr: 1.5, ORB_pct: 0, TRB_pct: 3.6, AST_pct: 11.5, STL_pct: 3.1, BLK_pct: 0, TOV_pct: 13.1, USG_pct: 20.6, OWS: 0.2, DWS: 0, WS: 0.2, WS40: 0.46 },
    },
  },
  'smithch02w': {
    id: 'smithch02w',
    name: 'Charlotte Smith',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 25, G: 32, MP: 746, MP_pct: 0.581, PER: 7.7, TS_pct: 0.405, ThrPAr: 0.298, FTr: 0.309, ORB_pct: 8.9, TRB_pct: 10.4, AST_pct: 14.6, STL_pct: 0.8, BLK_pct: 0.8, TOV_pct: 19, USG_pct: 18.1, OWS: -0.5, DWS: 0.3, WS: -0.1, WS40: -0.008 },
      2000: { team: 'CHA', age: 26, G: 30, MP: 659, MP_pct: 0.509, PER: 9.2, TS_pct: 0.459, ThrPAr: 0.478, FTr: 0.157, ORB_pct: 5.9, TRB_pct: 10.8, AST_pct: 15.4, STL_pct: 1.3, BLK_pct: 2.2, TOV_pct: 22, USG_pct: 16.1, OWS: -0.2, DWS: -0.2, WS: -0.3, WS40: -0.02 },
      2001: { team: 'CHA', age: 27, G: 30, MP: 678, MP_pct: 0.522, PER: 12.5, TS_pct: 0.491, ThrPAr: 0.219, FTr: 0.438, ORB_pct: 7.9, TRB_pct: 10.4, AST_pct: 15.1, STL_pct: 1.5, BLK_pct: 1.7, TOV_pct: 19.1, USG_pct: 16.6, OWS: 1.1, DWS: 0.6, WS: 1.7, WS40: 0.099 },
    },
  },
  'smithch03w': {
    id: 'smithch03w',
    name: 'Charmin Smith',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 24, G: 13, MP: 56, MP_pct: 0.043, PER: 0.9, TS_pct: 0.373, ThrPAr: 0.444, FTr: 1.111, ORB_pct: 4.5, TRB_pct: 10.8, AST_pct: 6.4, STL_pct: 1.1, BLK_pct: 0, TOV_pct: 27.2, USG_pct: 16.6, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.066 },
      2000: { team: 'SEA', age: 25, G: 32, MP: 516, MP_pct: 0.398, PER: 5.4, TS_pct: 0.407, ThrPAr: 0.571, FTr: 0.321, ORB_pct: 3.6, TRB_pct: 6.5, AST_pct: 21.2, STL_pct: 1.8, BLK_pct: 0.5, TOV_pct: 33.4, USG_pct: 9.6, OWS: -0.6, DWS: 0.3, WS: -0.3, WS40: -0.022 },
      2001: { team: 'SEA', age: 26, G: 32, MP: 589, MP_pct: 0.45, PER: 5.1, TS_pct: 0.401, ThrPAr: 0.603, FTr: 0.333, ORB_pct: 3.8, TRB_pct: 6.3, AST_pct: 13.3, STL_pct: 1.8, BLK_pct: 0.2, TOV_pct: 26.5, USG_pct: 8.7, OWS: -0.3, DWS: 0.3, WS: 0, WS40: -0.001 },
    },
  },
  'smithka01w': {
    id: 'smithka01w',
    name: 'Katie Smith',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 25, G: 30, MP: 971, MP_pct: 0.75, PER: 13.6, TS_pct: 0.525, ThrPAr: 0.466, FTr: 0.322, ORB_pct: 5.4, TRB_pct: 6.1, AST_pct: 13.4, STL_pct: 1.2, BLK_pct: 1, TOV_pct: 14.2, USG_pct: 20.2, OWS: 2, DWS: 0.5, WS: 2.4, WS40: 0.1, MIN_pg: 32.4, PTS_pg: 11.7, REB_pg: 2.9, AST_pg: 2.0, STL_pg: 0.6, BLK_pg: 0.3, FG_pct: 0.387, FG3_pct: 0.382, FT_pct: 0.766 },
      2000: { team: 'MIN', age: 26, G: 32, MP: 1193, MP_pct: 0.928, PER: 22.3, TS_pct: 0.578, ThrPAr: 0.481, FTr: 0.363, ORB_pct: 3.2, TRB_pct: 5.4, AST_pct: 17.6, STL_pct: 2.1, BLK_pct: 0.6, TOV_pct: 12, USG_pct: 26.4, OWS: 5.3, DWS: 1.1, WS: 6.4, WS40: 0.213, MIN_pg: 37.3, PTS_pg: 20.2, REB_pg: 2.9, AST_pg: 2.8, STL_pg: 1.4, BLK_pg: 0.2, FG_pct: 0.421, FG3_pct: 0.379, FT_pct: 0.869 },
      2001: { team: 'MIN', age: 27, G: 32, MP: 1234, MP_pct: 0.953, PER: 23.3, TS_pct: 0.577, ThrPAr: 0.462, FTr: 0.53, ORB_pct: 4.2, TRB_pct: 6.3, AST_pct: 16.1, STL_pct: 1.1, BLK_pct: 0.4, TOV_pct: 12, USG_pct: 28.9, OWS: 7.2, DWS: 0.3, WS: 7.5, WS40: 0.244, MIN_pg: 38.6, PTS_pg: 23.1, REB_pg: 3.8, AST_pg: 2.2, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.393, FG3_pct: 0.354, FT_pct: 0.895 },
      2002: { team: 'MIN', age: 28, G: 31, MIN_pg: 36.7, PTS_pg: 16.5, REB_pg: 3.0, AST_pg: 2.5, STL_pg: 1.0, BLK_pg: 0.2, FG_pct: 0.404, FG3_pct: 0.330, FT_pct: 0.824 },
      2003: { team: 'MIN', age: 29, G: 34, MIN_pg: 34.9, PTS_pg: 18.2, REB_pg: 4.1, AST_pg: 2.5, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.457, FG3_pct: 0.390, FT_pct: 0.881 },
      2004: { team: 'MIN', age: 30, G: 23, MIN_pg: 34.8, PTS_pg: 18.8, REB_pg: 3.7, AST_pg: 2.3, STL_pg: 1.0, BLK_pg: 0.3, FG_pct: 0.431, FG3_pct: 0.432, FT_pct: 0.899 },
      2005: { team: 'DET', age: 31, G: 36, MIN_pg: 32.5, PTS_pg: 11.9, REB_pg: 2.3, AST_pg: 2.4, STL_pg: 0.9, BLK_pg: 0.2, FG_pct: 0.379, FG3_pct: 0.333, FT_pct: 0.781 },
      2006: { team: 'DET', age: 32, G: 34, MIN_pg: 33.4, PTS_pg: 11.7, REB_pg: 2.7, AST_pg: 3.3, STL_pg: 0.7, BLK_pg: 0.1, FG_pct: 0.407, FG3_pct: 0.366, FT_pct: 0.912 },
      2007: { team: 'DET', age: 33, G: 34, MIN_pg: 34.3, PTS_pg: 13.2, REB_pg: 3.8, AST_pg: 3.6, STL_pg: 1.2, BLK_pg: 0.1, FG_pct: 0.361, FG3_pct: 0.311, FT_pct: 0.847 },
      2008: { team: 'DET', age: 34, G: 34, MIN_pg: 33.9, PTS_pg: 14.7, REB_pg: 2.8, AST_pg: 4.0, STL_pg: 0.9, BLK_pg: 0.1, FG_pct: 0.383, FG3_pct: 0.360, FT_pct: 0.887 },
      2009: { team: 'DET', age: 35, G: 27, MIN_pg: 33.1, PTS_pg: 13.7, REB_pg: 2.3, AST_pg: 2.8, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.435, FG3_pct: 0.432, FT_pct: 0.918 },
      2010: { team: 'WAS', age: 36, G: 33, MIN_pg: 30.8, PTS_pg: 9.5, REB_pg: 2.1, AST_pg: 2.6, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.395, FG3_pct: 0.362, FT_pct: 0.764 },
      2011: { team: 'SEA', age: 37, G: 34, MIN_pg: 25.1, PTS_pg: 7.5, REB_pg: 2.3, AST_pg: 2.0, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.395, FG3_pct: 0.395, FT_pct: 0.857 },
      2012: { team: 'SEA', age: 38, G: 34, MIN_pg: 27.0, PTS_pg: 6.7, REB_pg: 2.7, AST_pg: 2.1, STL_pg: 0.6, BLK_pg: 0.1, FG_pct: 0.412, FG3_pct: 0.400, FT_pct: 0.838 },
      2013: { team: 'NYL', age: 39, G: 34, MIN_pg: 26.6, PTS_pg: 6.1, REB_pg: 1.9, AST_pg: 1.8, STL_pg: 0.7, BLK_pg: 0.2, FG_pct: 0.374, FG3_pct: 0.315, FT_pct: 0.848 },
    },
  },
  'smithla01w': {
    id: 'smithla01w',
    name: 'LaCharlotte Smith',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'ORL', age: 26, G: 3, MP: 12, MP_pct: 0.009, PER: 24.7, TS_pct: 0.727, ThrPAr: 0.333, FTr: 0.333, ORB_pct: 11, TRB_pct: 11.2, AST_pct: 17.6, STL_pct: 9.7, BLK_pct: 0, TOV_pct: 36.8, USG_pct: 22.3, OWS: 0, DWS: 0, WS: 0.1, WS40: 0.188 },
    },
  },
  'smithta01w': {
    id: 'smithta01w',
    name: 'Tangela Smith',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 21, G: 28, MP: 707, MP_pct: 0.587, PER: 15.4, TS_pct: 0.448, ThrPAr: 0.05, FTr: 0.194, ORB_pct: 7.9, TRB_pct: 11.6, AST_pct: 9.8, STL_pct: 1.3, BLK_pct: 5.7, TOV_pct: 13.2, USG_pct: 23, OWS: 0.5, DWS: 0.8, WS: 1.2, WS40: 0.069, MIN_pg: 25.3, PTS_pg: 9.6, REB_pg: 4.6, AST_pg: 1, STL_pg: 0.6, BLK_pg: 1.6, TOV_pg: 1.7, FG_pct: 0.401, FG3_pct: 0.357, FT_pct: 0.741 },
      1999: { team: 'SAC', age: 22, G: 31, MP: 632, MP_pct: 0.494, PER: 17.1, TS_pct: 0.48, ThrPAr: 0.009, FTr: 0.306, ORB_pct: 8.7, TRB_pct: 11.5, AST_pct: 5.4, STL_pct: 2.2, BLK_pct: 5.1, TOV_pct: 12.5, USG_pct: 21.4, OWS: 1, DWS: 1.1, WS: 2.1, WS40: 0.135, MIN_pg: 20.4, PTS_pg: 8.3, REB_pg: 3.8, AST_pg: 0.5, STL_pg: 0.8, BLK_pg: 1.2, TOV_pg: 1.2, FG_pct: 0.443, FG3_pct: 0.500, FT_pct: 0.653 },
      2000: { team: 'SAC', age: 23, G: 32, MP: 925, MP_pct: 0.723, PER: 18.5, TS_pct: 0.496, ThrPAr: 0, FTr: 0.124, ORB_pct: 8.3, TRB_pct: 12.4, AST_pct: 9.4, STL_pct: 1.8, BLK_pct: 5.9, TOV_pct: 13.3, USG_pct: 22.8, OWS: 1.6, DWS: 1.5, WS: 3.1, WS40: 0.135, MIN_pg: 28.9, PTS_pg: 12.1, REB_pg: 5.6, AST_pg: 1.3, STL_pg: 0.9, BLK_pg: 2, TOV_pg: 1.9, FG_pct: 0.474, FG3_pct: 0.000, FT_pct: 0.783 },
      2001: { team: 'SAC', age: 24, G: 32, MP: 912, MP_pct: 0.699, PER: 16.1, TS_pct: 0.46, ThrPAr: 0.006, FTr: 0.241, ORB_pct: 6.6, TRB_pct: 12.2, AST_pct: 9.4, STL_pct: 2.1, BLK_pct: 4.9, TOV_pct: 14.5, USG_pct: 23.8, OWS: 0.8, DWS: 1.8, WS: 2.6, WS40: 0.112, MIN_pg: 28.5, PTS_pg: 11.2, REB_pg: 5.6, AST_pg: 1.3, STL_pg: 1.1, BLK_pg: 1.7, TOV_pg: 2.1, FG_pct: 0.420, FG3_pct: 0.000, FT_pct: 0.729 },
    },
  },
  'sobrale01w': {
    id: 'sobrale01w',
    name: 'Leila Sobral',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 23, G: 14, MP: 71, MP_pct: 0.059, PER: 7.8, TS_pct: 0.391, ThrPAr: 0.44, FTr: 0.52, ORB_pct: 4.9, TRB_pct: 8.7, AST_pct: 16.5, STL_pct: 3.7, BLK_pct: 2.2, TOV_pct: 22.7, USG_pct: 24.8, OWS: -0.2, DWS: 0, WS: -0.1, WS40: -0.084 },
      1999: { G: 13, MIN_pg: 4.3, PTS_pg: 0.8, REB_pg: 0.7, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.4, FG_pct: 0.111, FG3_pct: 0.000, FT_pct: 0.800 },
      2000: { G: 32, MIN_pg: 16.1, PTS_pg: 1.6, REB_pg: 1.5, AST_pg: 1.7, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.286, FG3_pct: 0.313, FT_pct: 0.560 },
      2001: { G: 32, MIN_pg: 18.4, PTS_pg: 1.8, REB_pg: 1.7, AST_pg: 1.2, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.270, FG3_pct: 0.289, FT_pct: 0.619 },
    },
  },
  'spornra01w': {
    id: 'spornra01w',
    name: 'Rachael Sporn',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 30, G: 30, MP: 535, MP_pct: 0.446, PER: 11, TS_pct: 0.42, ThrPAr: 0, FTr: 0.231, ORB_pct: 11.3, TRB_pct: 12, AST_pct: 13.4, STL_pct: 0.8, BLK_pct: 1.8, TOV_pct: 17.4, USG_pct: 16.6, OWS: 0.2, DWS: 0.6, WS: 0.8, WS40: 0.056, MIN_pg: 17.8, PTS_pg: 4.5, REB_pg: 3.6, AST_pg: 1.3, STL_pg: 0.3, BLK_pg: 0.4, TOV_pg: 1.1, FG_pct: 0.408, FT_pct: 0.500 },
      1999: { team: 'DET', age: 31, G: 18, MP: 340, MP_pct: 0.262, PER: 15.8, TS_pct: 0.498, ThrPAr: 0.011, FTr: 0.298, ORB_pct: 9.1, TRB_pct: 11, AST_pct: 16.6, STL_pct: 2.4, BLK_pct: 1, TOV_pct: 13.1, USG_pct: 16.8, OWS: 0.7, DWS: 0.5, WS: 1.1, WS40: 0.134, MIN_pg: 18.9, PTS_pg: 5.9, REB_pg: 3.3, AST_pg: 1.5, STL_pg: 0.8, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.468, FG3_pct: 0.000, FT_pct: 0.643 },
      2001: { team: 'DET', age: 33, G: 23, MP: 265, MP_pct: 0.202, PER: 9.1, TS_pct: 0.402, ThrPAr: 0, FTr: 0.191, ORB_pct: 10.1, TRB_pct: 13.3, AST_pct: 8, STL_pct: 1.5, BLK_pct: 1.3, TOV_pct: 20.3, USG_pct: 11.9, OWS: -0.1, DWS: 0.1, WS: 0, WS40: -0.007, MIN_pg: 11.5, PTS_pg: 1.8, REB_pg: 2.3, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.2, TOV_pg: 0.6, FG_pct: 0.404, FT_pct: 0.333 },
    },
  },
  'stafftr01w': {
    id: 'stafftr01w',
    name: 'Trisha Stafford-Odom',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'HOU', age: 30, G: 30, MP: 365, MP_pct: 0.283, PER: 13.5, TS_pct: 0.438, ThrPAr: 0.009, FTr: 0.491, ORB_pct: 12.7, TRB_pct: 14.7, AST_pct: 9.3, STL_pct: 2, BLK_pct: 0.5, TOV_pct: 16.8, USG_pct: 21.2, OWS: 0.2, DWS: 0.6, WS: 0.8, WS40: 0.087, MIN_pg: 13.5, PTS_pg: 4.7, REB_pg: 1.3, AST_pg: 0.9, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.373, FG3_pct: 0.217, FT_pct: 0.815 },
      1999: { G: 24, MIN_pg: 9, PTS_pg: 2, REB_pg: 1, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.2, TOV_pg: 0.7, FG_pct: 0.218, FG3_pct: 0.133, FT_pct: 0.815 },
      2000: { G: 29, MIN_pg: 11.7, PTS_pg: 4, REB_pg: 1.1, AST_pg: 1, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 1, FG_pct: 0.358, FG3_pct: 0.217, FT_pct: 0.810 },
    },
  },
  'staleda01w': {
    id: 'staleda01w',
    name: 'Dawn Staley',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'CHA', age: 29, G: 32, MP: 1065, MP_pct: 0.829, PER: 16.9, TS_pct: 0.54, ThrPAr: 0.346, FTr: 0.302, ORB_pct: 1.6, TRB_pct: 4.6, AST_pct: 33.3, STL_pct: 2.1, BLK_pct: 0.2, TOV_pct: 20.9, USG_pct: 20.7, OWS: 2.4, DWS: 0.5, WS: 3, WS40: 0.112, MIN_pg: 33.3, PTS_pg: 11.5, REB_pg: 2.3, AST_pg: 5.5, STL_pg: 1.2, BLK_pg: 0.1, FG_pct: 0.415, FG3_pct: 0.317, FT_pct: 0.934 },
      2000: { team: 'CHA', age: 30, G: 32, MP: 1099, MP_pct: 0.849, PER: 12.4, TS_pct: 0.494, ThrPAr: 0.348, FTr: 0.292, ORB_pct: 2.6, TRB_pct: 4.7, AST_pct: 31.9, STL_pct: 1.9, BLK_pct: 0.1, TOV_pct: 24.2, USG_pct: 16.7, OWS: 1.1, DWS: -0.8, WS: 0.3, WS40: 0.012, MIN_pg: 34.3, PTS_pg: 8.8, REB_pg: 2.4, AST_pg: 5.9, STL_pg: 1.2, BLK_pg: 0.0, FG_pct: 0.372, FG3_pct: 0.330, FT_pct: 0.878 },
      2001: { team: 'CHA', age: 31, G: 32, MP: 1152, MP_pct: 0.886, PER: 13.8, TS_pct: 0.487, ThrPAr: 0.317, FTr: 0.203, ORB_pct: 1.4, TRB_pct: 4.3, AST_pct: 32.3, STL_pct: 2.8, BLK_pct: 0.1, TOV_pct: 24.6, USG_pct: 18.4, OWS: 1.4, DWS: 0.8, WS: 2.3, WS40: 0.079, MIN_pg: 36.0, PTS_pg: 9.3, REB_pg: 2.2, AST_pg: 5.6, STL_pg: 1.6, BLK_pg: 0.0, FG_pct: 0.381, FG3_pct: 0.371, FT_pct: 0.895 },
      2002: { team: 'CHA', age: 32, G: 32, MIN_pg: 33.2, PTS_pg: 8.7, REB_pg: 1.8, AST_pg: 5.1, STL_pg: 1.5, BLK_pg: 0.0, FG_pct: 0.364, FG3_pct: 0.398, FT_pct: 0.762 },
      2003: { team: 'CHA', age: 33, G: 34, MIN_pg: 31.9, PTS_pg: 7.9, REB_pg: 1.7, AST_pg: 5.1, STL_pg: 1.4, BLK_pg: 0.1, FG_pct: 0.417, FG3_pct: 0.389, FT_pct: 0.836 },
      2004: { team: 'CHA', age: 34, G: 34, MIN_pg: 33.6, PTS_pg: 8.9, REB_pg: 1.7, AST_pg: 5.0, STL_pg: 1.3, BLK_pg: 0.1, FG_pct: 0.431, FG3_pct: 0.407, FT_pct: 0.759 },
      2005: { team: 'HOU', age: 35, G: 33, MIN_pg: 27.4, PTS_pg: 5.4, REB_pg: 2.1, AST_pg: 4.5, STL_pg: 1.1, BLK_pg: 0.0, FG_pct: 0.387, FG3_pct: 0.369, FT_pct: 0.803 },
      2006: { team: 'HOU', age: 36, G: 34, MIN_pg: 29.9, PTS_pg: 7.4, REB_pg: 2.2, AST_pg: 3.9, STL_pg: 1.0, BLK_pg: 0.2, FG_pct: 0.420, FG3_pct: 0.427, FT_pct: 0.806 },
    },
  },
  'starbka01w': {
    id: 'starbka01w',
    name: 'Kate Starbird',
    position: 'F-G',
    retired: true,
    seasons: {
      1999: { team: 'SAC', age: 23, G: 24, MP: 215, MP_pct: 0.168, PER: 6.7, TS_pct: 0.359, ThrPAr: 0.273, FTr: 0.491, ORB_pct: 5, TRB_pct: 6.6, AST_pct: 10.7, STL_pct: 3.2, BLK_pct: 1.6, TOV_pct: 20.3, USG_pct: 17.3, OWS: -0.3, DWS: 0.3, WS: 0, WS40: 0.001, MIN_pg: 24.9, PTS_pg: 4, REB_pg: 2.5, AST_pg: 2.3, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.444, FG3_pct: 0.317, FT_pct: 0.611 },
      2000: { team: 'UTA', age: 24, G: 29, MP: 340, MP_pct: 0.266, PER: 12.2, TS_pct: 0.459, ThrPAr: 0.211, FTr: 0.385, ORB_pct: 4.8, TRB_pct: 6.2, AST_pct: 15.9, STL_pct: 2.1, BLK_pct: 2.7, TOV_pct: 18.5, USG_pct: 21.1, OWS: 0.2, DWS: 0.1, WS: 0.3, WS40: 0.03, MIN_pg: 30.6, PTS_pg: 5.3, REB_pg: 2.7, AST_pg: 2.5, STL_pg: 1.9, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.351, FG3_pct: 0.379, FT_pct: 0.607 },
      2001: { team: 'UTA', age: 25, G: 23, MP: 310, MP_pct: 0.239, PER: 12.4, TS_pct: 0.447, ThrPAr: 0.209, FTr: 0.245, ORB_pct: 5.9, TRB_pct: 6.1, AST_pct: 13.7, STL_pct: 1.5, BLK_pct: 0.3, TOV_pct: 11, USG_pct: 21.7, OWS: 0.4, DWS: 0, WS: 0.4, WS40: 0.057, MIN_pg: 28.2, PTS_pg: 3.4, REB_pg: 2.2, AST_pg: 2.9, STL_pg: 1.6, BLK_pg: 0.2, TOV_pg: 1.3, FG_pct: 0.318, FG3_pct: 0.182, FT_pct: 0.514 },
    },
  },
  'stedika01w': {
    id: 'stedika01w',
    name: 'Katy Steding',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'SAC', age: 32, G: 29, MP: 309, MP_pct: 0.241, PER: 11.5, TS_pct: 0.464, ThrPAr: 0.558, FTr: 0.074, ORB_pct: 4.5, TRB_pct: 8.1, AST_pct: 8, STL_pct: 2, BLK_pct: 2.8, TOV_pct: 14.8, USG_pct: 17.4, OWS: 0.1, DWS: 0.4, WS: 0.5, WS40: 0.062, MIN_pg: 21.5, PTS_pg: 8.7, REB_pg: 3.3, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.5, TOV_pg: 1.7, FG_pct: 0.431, FG3_pct: 0.000, FT_pct: 0.702 },
      2001: { team: 'SEA', age: 33, G: 26, MP: 393, MP_pct: 0.3, PER: 12.8, TS_pct: 0.496, ThrPAr: 0.372, FTr: 0.213, ORB_pct: 2.8, TRB_pct: 6, AST_pct: 14, STL_pct: 2.5, BLK_pct: 2.1, TOV_pct: 17.6, USG_pct: 16.5, OWS: 0.3, DWS: 0.4, WS: 0.6, WS40: 0.065, MIN_pg: 23.5, PTS_pg: 7.1, REB_pg: 3, AST_pg: 0.6, STL_pg: 0.5, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.432, FG3_pct: 0.432, FT_pct: 0.569 },
      1999: { G: 27, MIN_pg: 21.2, PTS_pg: 7.9, REB_pg: 3.6, AST_pg: 0.7, STL_pg: 0.6, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.435, FG3_pct: 0.125, FT_pct: 0.679 },
    },
  },
  'stepama01w': {
    id: 'stepama01w',
    name: 'Maria Stepanova',
    position: 'C',
    retired: true,
    seasons: {
      1998: { team: 'PHO', age: 19, G: 20, MP: 130, MP_pct: 0.107, PER: 21, TS_pct: 0.467, ThrPAr: 0, FTr: 0.361, ORB_pct: 16.4, TRB_pct: 18.9, AST_pct: 12, STL_pct: 1.3, BLK_pct: 6.8, TOV_pct: 11.3, USG_pct: 28.1, OWS: 0.3, DWS: 0.3, WS: 0.6, WS40: 0.198, MIN_pg: 16.1, PTS_pg: 5.3, REB_pg: 2.9, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 0.3, TOV_pg: 1.7, FG_pct: 0.430, FG3_pct: 0.200, FT_pct: 0.569 },
      1999: { team: 'PHO', age: 20, G: 32, MP: 554, MP_pct: 0.433, PER: 23.3, TS_pct: 0.524, ThrPAr: 0.005, FTr: 0.444, ORB_pct: 14, TRB_pct: 18.8, AST_pct: 10.3, STL_pct: 1.3, BLK_pct: 9.4, TOV_pct: 15.4, USG_pct: 24.2, OWS: 1.3, DWS: 1.2, WS: 2.5, WS40: 0.181, MIN_pg: 7.75, PTS_pg: 2.15, REB_pg: 1.75, AST_pg: 0.45, STL_pg: 0.15, BLK_pg: 0.2, TOV_pg: 0.7, FG_pct: 0.317, FG3_pct: 0.000, FT_pct: 0.584 },
      2000: { team: 'PHO', age: 21, G: 15, MP: 170, MP_pct: 0.132, PER: 10.6, TS_pct: 0.47, ThrPAr: 0, FTr: 0.278, ORB_pct: 12.5, TRB_pct: 19.5, AST_pct: 9.7, STL_pct: 1.4, BLK_pct: 4.8, TOV_pct: 26.6, USG_pct: 24.8, OWS: -0.3, DWS: 0.4, WS: 0.1, WS40: 0.016, MIN_pg: 13.2, PTS_pg: 3.6, REB_pg: 2.9, AST_pg: 1, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 1.6, FG_pct: 0.416, FG3_pct: 0.000, FT_pct: 0.650 },
      2001: { team: 'PHO', age: 22, G: 32, MP: 815, MP_pct: 0.632, PER: 22.5, TS_pct: 0.528, ThrPAr: 0.007, FTr: 0.277, ORB_pct: 10.5, TRB_pct: 16.1, AST_pct: 12, STL_pct: 3, BLK_pct: 6.7, TOV_pct: 13.6, USG_pct: 21.7, OWS: 1.9, DWS: 1.8, WS: 3.7, WS40: 0.18, MIN_pg: 24.2, PTS_pg: 8.8, REB_pg: 5, AST_pg: 1.3, STL_pg: 0.7, BLK_pg: 0.4, TOV_pg: 2.3, FG_pct: 0.456, FG3_pct: 0.000, FT_pct: 0.739 },
    },
  },
  'stephre01w': {
    id: 'stephre01w',
    name: 'Rehema Stephens',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'SAC', age: 28, G: 8, MP: 81, MP_pct: 0.067, PER: -0.3, TS_pct: 0.304, ThrPAr: 0.293, FTr: 0.098, ORB_pct: 10.7, TRB_pct: 7.8, AST_pct: 10.4, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 20.5, USG_pct: 31, OWS: -0.5, DWS: 0, WS: -0.5, WS40: -0.253, MIN_pg: 10.1, PTS_pg: 3.3, REB_pg: 1.3, AST_pg: 0.5, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 1.4, FG_pct: 0.268, FG3_pct: 0.167, FT_pct: 0.500 },
    },
  },
  'stileja01w': {
    id: 'stileja01w',
    name: 'Jackie Stiles',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'POR', age: 22, G: 32, MP: 1023, MP_pct: 0.784, PER: 16.7, TS_pct: 0.53, ThrPAr: 0.301, FTr: 0.387, ORB_pct: 2.9, TRB_pct: 4.7, AST_pct: 13.1, STL_pct: 1.3, BLK_pct: 0.2, TOV_pct: 13.1, USG_pct: 24.9, OWS: 2.7, DWS: 0.1, WS: 2.8, WS40: 0.111, MIN_pg: 32, PTS_pg: 14.9, REB_pg: 2.4, AST_pg: 1.7, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 2.1, FG_pct: 0.405, FG3_pct: 0.431, FT_pct: 0.779 },
      2002: { G: 21, MIN_pg: 18.2, PTS_pg: 6, REB_pg: 0.9, AST_pg: 1, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.319, FG3_pct: 0.341, FT_pct: 0.800 },
    },
  },
  'stillva01w': {
    id: 'stillva01w',
    name: 'Valerie Still',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 38, G: 23, MP: 282, MP_pct: 0.218, PER: -0.8, TS_pct: 0.27, ThrPAr: 0.061, FTr: 0.388, ORB_pct: 7.8, TRB_pct: 9.8, AST_pct: 3.9, STL_pct: 0.8, BLK_pct: 1.2, TOV_pct: 25.9, USG_pct: 13.3, OWS: -1, DWS: 0.1, WS: -0.9, WS40: -0.125, MIN_pg: 12.3, PTS_pg: 1.3, REB_pg: 1.9, AST_pg: 0.3, STL_pg: 0.2, BLK_pg: 0.2, TOV_pg: 0.9, FG_pct: 0.245, FG3_pct: 0.000, FT_pct: 0.368 },
    },
  },
  'stinsan01w': {
    id: 'stinsan01w',
    name: 'Andrea Stinson',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 29, G: 28, MP: 1011, MP_pct: 0.903, PER: 20.5, TS_pct: 0.504, ThrPAr: 0.194, FTr: 0.225, ORB_pct: 6.1, TRB_pct: 9.5, AST_pct: 26.3, STL_pct: 2.3, BLK_pct: 1.7, TOV_pct: 18.5, USG_pct: 25.1, OWS: 2.4, DWS: 1.4, WS: 3.8, WS40: 0.151, MIN_pg: 36.1, PTS_pg: 15.7, REB_pg: 5.5, AST_pg: 4.4, STL_pg: 1.5, BLK_pg: 0.8, FG_pct: 0.447, FG3_pct: 0.325, FT_pct: 0.674 },
      1998: { team: 'CHA', age: 30, G: 30, MP: 1046, MP_pct: 0.872, PER: 19.6, TS_pct: 0.491, ThrPAr: 0.249, FTr: 0.242, ORB_pct: 3.4, TRB_pct: 8.1, AST_pct: 25.6, STL_pct: 2.8, BLK_pct: 1.1, TOV_pct: 14.4, USG_pct: 23.7, OWS: 2.5, DWS: 1.7, WS: 4.2, WS40: 0.161, MIN_pg: 34.9, PTS_pg: 15.0, REB_pg: 4.6, AST_pg: 4.5, STL_pg: 1.8, BLK_pg: 0.5, FG_pct: 0.418, FG3_pct: 0.282, FT_pct: 0.750 },
      1999: { team: 'CHA', age: 31, G: 32, MP: 1041, MP_pct: 0.81, PER: 18.5, TS_pct: 0.521, ThrPAr: 0.18, FTr: 0.233, ORB_pct: 4.4, TRB_pct: 7.4, AST_pct: 19.9, STL_pct: 1.8, BLK_pct: 1.5, TOV_pct: 13.9, USG_pct: 23.8, OWS: 2.2, DWS: 0.7, WS: 3, WS40: 0.113, MIN_pg: 32.5, PTS_pg: 13.6, REB_pg: 3.5, AST_pg: 2.9, STL_pg: 1.0, BLK_pg: 0.6, FG_pct: 0.460, FG3_pct: 0.309, FT_pct: 0.739 },
      2000: { team: 'CHA', age: 32, G: 32, MP: 1123, MP_pct: 0.867, PER: 22.3, TS_pct: 0.541, ThrPAr: 0.229, FTr: 0.289, ORB_pct: 4.2, TRB_pct: 8.1, AST_pct: 24.7, STL_pct: 2.8, BLK_pct: 1.8, TOV_pct: 14.1, USG_pct: 26.4, OWS: 3.4, DWS: 0, WS: 3.4, WS40: 0.122, MIN_pg: 35.1, PTS_pg: 17.7, REB_pg: 4.3, AST_pg: 3.8, STL_pg: 1.7, BLK_pg: 0.7, FG_pct: 0.462, FG3_pct: 0.358, FT_pct: 0.739 },
      2001: { team: 'CHA', age: 33, G: 32, MP: 1006, MP_pct: 0.774, PER: 23.4, TS_pct: 0.556, ThrPAr: 0.176, FTr: 0.214, ORB_pct: 5.8, TRB_pct: 9.5, AST_pct: 22.1, STL_pct: 2.7, BLK_pct: 1.7, TOV_pct: 14.7, USG_pct: 24.7, OWS: 4.1, DWS: 1.2, WS: 5.4, WS40: 0.214, MIN_pg: 31.4, PTS_pg: 14.1, REB_pg: 4.3, AST_pg: 2.8, STL_pg: 1.3, BLK_pg: 0.6, FG_pct: 0.484, FG3_pct: 0.446, FT_pct: 0.797 },
      2002: { team: 'CHA', age: 34, G: 32, MIN_pg: 29.7, PTS_pg: 12.8, REB_pg: 5.5, AST_pg: 2.8, STL_pg: 1.2, BLK_pg: 0.3, FG_pct: 0.456, FG3_pct: 0.414, FT_pct: 0.688 },
      2003: { team: 'CHA', age: 35, G: 34, MIN_pg: 29.4, PTS_pg: 11.1, REB_pg: 4.1, AST_pg: 2.9, STL_pg: 1.4, BLK_pg: 0.2, FG_pct: 0.458, FG3_pct: 0.307, FT_pct: 0.759 },
      2004: { team: 'CHA', age: 36, G: 34, MIN_pg: 22.9, PTS_pg: 6.0, REB_pg: 3.5, AST_pg: 1.4, STL_pg: 0.8, BLK_pg: 0.2, FG_pct: 0.414, FG3_pct: 0.297, FT_pct: 0.773 },
      2005: { team: 'DET', age: 37, G: 18, MIN_pg: 5.7, PTS_pg: 1.2, REB_pg: 0.7, AST_pg: 0.7, STL_pg: 0.2, BLK_pg: 0.0, FG_pct: 0.348, FG3_pct: 0.200, FT_pct: 0.667 },
    },
  },
  'stiresh01w': {
    id: 'stiresh01w',
    name: 'Shanele Stires',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'MIN', age: 28, G: 21, MP: 117, MP_pct: 0.091, PER: 8.4, TS_pct: 0.553, ThrPAr: 0.345, FTr: 0.207, ORB_pct: 7, TRB_pct: 8.3, AST_pct: 12.3, STL_pct: 2.9, BLK_pct: 0, TOV_pct: 30.7, USG_pct: 19.4, OWS: -0.1, DWS: 0.2, WS: 0, WS40: 0.017 },
      2001: { team: 'MIN', age: 29, G: 18, MP: 201, MP_pct: 0.155, PER: 8.6, TS_pct: 0.455, ThrPAr: 0.472, FTr: 0.132, ORB_pct: 6.5, TRB_pct: 8.6, AST_pct: 16.6, STL_pct: 2.3, BLK_pct: 1.8, TOV_pct: 25.3, USG_pct: 18.3, OWS: -0.2, DWS: 0.2, WS: 0, WS40: -0.003 },
    },
  },
  'stockta01w': {
    id: 'stockta01w',
    name: 'Tamara Stocks',
    position: 'F-C',
    retired: true,
    seasons: {
      2001: { team: 'WAS', age: 22, G: 3, MP: 11, MP_pct: 0.008, PER: 3.8, TS_pct: 0.387, ThrPAr: 0, FTr: 0.667, ORB_pct: 0, TRB_pct: 11.1, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 17.4, OWS: 0, DWS: 0, WS: 0, WS40: 0.049 },
    },
  },
  'streiju01w': {
    id: 'streiju01w',
    name: 'Jurgita Streimikyte',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 28, G: 27, MP: 424, MP_pct: 0.33, PER: 13.8, TS_pct: 0.457, ThrPAr: 0.051, FTr: 0.299, ORB_pct: 8.3, TRB_pct: 11.4, AST_pct: 20.3, STL_pct: 2.2, BLK_pct: 4.6, TOV_pct: 19.5, USG_pct: 19.1, OWS: 0.3, DWS: 0.4, WS: 0.6, WS40: 0.06 },
      2001: { team: 'IND', age: 29, G: 27, MP: 707, MP_pct: 0.546, PER: 18.7, TS_pct: 0.53, ThrPAr: 0.043, FTr: 0.275, ORB_pct: 8.7, TRB_pct: 13.4, AST_pct: 16.4, STL_pct: 3, BLK_pct: 2.3, TOV_pct: 18.3, USG_pct: 20.2, OWS: 1.6, DWS: 0.7, WS: 2.2, WS40: 0.125 },
    },
  },
  'suberto01w': {
    id: 'suberto01w',
    name: 'Tora Suber',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 22, G: 28, MP: 475, MP_pct: 0.424, PER: 10.7, TS_pct: 0.52, ThrPAr: 0.537, FTr: 0.38, ORB_pct: 1.3, TRB_pct: 5.5, AST_pct: 21.1, STL_pct: 1.5, BLK_pct: 0.5, TOV_pct: 28.8, USG_pct: 17.7, OWS: 0.2, DWS: 0.4, WS: 0.5, WS40: 0.044 },
      1998: { team: 'CHA', age: 23, G: 30, MP: 682, MP_pct: 0.568, PER: 11, TS_pct: 0.441, ThrPAr: 0.627, FTr: 0.249, ORB_pct: 2.2, TRB_pct: 4.8, AST_pct: 21.7, STL_pct: 2.4, BLK_pct: 0.1, TOV_pct: 17.7, USG_pct: 17, OWS: 0.4, DWS: 0.7, WS: 1.1, WS40: 0.066, MIN_pg: 16.8, PTS_pg: 3.4, REB_pg: 2.7, AST_pg: 0.6, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 0.7, FG_pct: 0.483, FT_pct: 0.500 },
      1999: { team: 'ORL', age: 24, G: 25, MP: 114, MP_pct: 0.088, PER: 3.9, TS_pct: 0.352, ThrPAr: 0.375, FTr: 0.417, ORB_pct: 4.6, TRB_pct: 7.5, AST_pct: 14.3, STL_pct: 2.5, BLK_pct: 0, TOV_pct: 26, USG_pct: 16.2, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.068 },
    },
  },
  'suttota01w': {
    id: 'suttota01w',
    name: 'Tammy Sutton-Brown',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'CHA', age: 23, G: 29, MP: 602, MP_pct: 0.463, PER: 17.9, TS_pct: 0.548, ThrPAr: 0, FTr: 0.49, ORB_pct: 12.6, TRB_pct: 15, AST_pct: 4, STL_pct: 2.2, BLK_pct: 5.7, TOV_pct: 18.3, USG_pct: 19, OWS: 1.4, DWS: 1.1, WS: 2.4, WS40: 0.161, MIN_pg: 20.8, PTS_pg: 6.8, REB_pg: 4.4, AST_pg: 0.4, STL_pg: 0.7, BLK_pg: 1.3, TOV_pg: 1.3, FG_pct: 0.394, FG3_pct: 0.000, FT_pct: 0.722 },
    },
  },
  'swoopsh01w': {
    id: 'swoopsh01w',
    name: 'Sheryl Swoopes',
    position: 'F-G',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 26, G: 9, MP: 129, MP_pct: 0.114, PER: 26.6, TS_pct: 0.541, ThrPAr: 0.302, FTr: 0.264, ORB_pct: 6, TRB_pct: 7.7, AST_pct: 12.7, STL_pct: 3, BLK_pct: 2.6, TOV_pct: 6.3, USG_pct: 22.9, OWS: 0.7, DWS: 0.2, WS: 0.9, WS40: 0.283, MIN_pg: 14.3, PTS_pg: 7.1, REB_pg: 1.7, AST_pg: 0.8, STL_pg: 0.8, BLK_pg: 0.4, FG_pct: 0.472, FG3_pct: 0.250, FT_pct: 0.714 },
      1998: { team: 'HOU', age: 27, G: 29, MP: 937, MP_pct: 0.771, PER: 24.4, TS_pct: 0.511, ThrPAr: 0.247, FTr: 0.212, ORB_pct: 5.5, TRB_pct: 10.3, AST_pct: 14.1, STL_pct: 4.3, BLK_pct: 1.3, TOV_pct: 11.6, USG_pct: 25.5, OWS: 3.4, DWS: 2.6, WS: 6, WS40: 0.255, MIN_pg: 32.3, PTS_pg: 15.6, REB_pg: 5.1, AST_pg: 2.1, STL_pg: 2.5, BLK_pg: 0.5, FG_pct: 0.427, FG3_pct: 0.360, FT_pct: 0.826 },
      1999: { team: 'HOU', age: 28, G: 32, MP: 1100, MP_pct: 0.856, PER: 28.9, TS_pct: 0.539, ThrPAr: 0.2, FTr: 0.249, ORB_pct: 6.1, TRB_pct: 12.1, AST_pct: 25.7, STL_pct: 4, BLK_pct: 3.6, TOV_pct: 13.3, USG_pct: 27.7, OWS: 5, DWS: 3.1, WS: 8.1, WS40: 0.294, MIN_pg: 34.4, PTS_pg: 18.3, REB_pg: 6.3, AST_pg: 4.0, STL_pg: 2.4, BLK_pg: 1.4, FG_pct: 0.462, FG3_pct: 0.337, FT_pct: 0.820 },
      2000: { team: 'HOU', age: 29, G: 31, MP: 1090, MP_pct: 0.842, PER: 32, TS_pct: 0.587, ThrPAr: 0.188, FTr: 0.3, ORB_pct: 5.4, TRB_pct: 12.2, AST_pct: 23.6, STL_pct: 4.6, BLK_pct: 2.6, TOV_pct: 13, USG_pct: 28.6, OWS: 6.3, DWS: 3.6, WS: 9.8, WS40: 0.361, MIN_pg: 35.2, PTS_pg: 20.7, REB_pg: 6.3, AST_pg: 3.8, STL_pg: 2.8, BLK_pg: 1.1, FG_pct: 0.506, FG3_pct: 0.374, FT_pct: 0.821 },
      2002: { team: 'HOU', age: 31, G: 32, MIN_pg: 36.1, PTS_pg: 18.5, REB_pg: 4.9, AST_pg: 3.3, STL_pg: 2.8, BLK_pg: 0.7, FG_pct: 0.434, FG3_pct: 0.288, FT_pct: 0.825 },
      2003: { team: 'HOU', age: 32, G: 31, MIN_pg: 35.0, PTS_pg: 15.6, REB_pg: 4.6, AST_pg: 3.9, STL_pg: 2.5, BLK_pg: 0.8, FG_pct: 0.406, FG3_pct: 0.304, FT_pct: 0.887 },
      2004: { team: 'HOU', age: 33, G: 31, MIN_pg: 34.5, PTS_pg: 14.8, REB_pg: 4.9, AST_pg: 2.9, STL_pg: 1.5, BLK_pg: 0.5, FG_pct: 0.422, FG3_pct: 0.308, FT_pct: 0.856 },
      2005: { team: 'HOU', age: 34, G: 33, MIN_pg: 37.1, PTS_pg: 18.6, REB_pg: 3.6, AST_pg: 4.3, STL_pg: 2.0, BLK_pg: 0.8, FG_pct: 0.447, FG3_pct: 0.360, FT_pct: 0.850 },
      2006: { team: 'HOU', age: 35, G: 31, MIN_pg: 35.8, PTS_pg: 15.5, REB_pg: 5.9, AST_pg: 3.7, STL_pg: 2.1, BLK_pg: 0.3, FG_pct: 0.413, FG3_pct: 0.278, FT_pct: 0.764 },
      2007: { team: 'HOU', age: 36, G: 3,  MIN_pg: 35.3, PTS_pg: 7.7, REB_pg: 5.7, AST_pg: 3.7, STL_pg: 1.7, BLK_pg: 0.3, FG_pct: 0.360, FG3_pct: 0.143, FT_pct: 1.000 },
      2008: { team: 'SEA', age: 37, G: 29, MIN_pg: 24.3, PTS_pg: 7.1, REB_pg: 4.3, AST_pg: 2.1, STL_pg: 1.5, BLK_pg: 0.3, FG_pct: 0.391, FG3_pct: 0.222, FT_pct: 0.695 },
      2011: { team: 'TUL', age: 40, G: 33, MIN_pg: 29.9, PTS_pg: 8.2, REB_pg: 4.1, AST_pg: 2.3, STL_pg: 0.8, BLK_pg: 0.3, FG_pct: 0.398, FG3_pct: 0.319, FT_pct: 0.870 },
    },
  },
  'tateso01w': {
    id: 'tateso01w',
    name: 'Sonja Tate',
    position: 'G',
    retired: true,
    seasons: {
      1999: { team: 'MIN', age: 27, G: 32, MP: 828, MP_pct: 0.639, PER: 10.3, TS_pct: 0.446, ThrPAr: 0.456, FTr: 0.204, ORB_pct: 7.3, TRB_pct: 10.3, AST_pct: 23.5, STL_pct: 2.6, BLK_pct: 0.4, TOV_pct: 28.9, USG_pct: 13.7, OWS: -0.2, DWS: 1.1, WS: 0.9, WS40: 0.044, MIN_pg: 25.9, PTS_pg: 4.5, REB_pg: 4, AST_pg: 3.1, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 2, FG_pct: 0.354, FG3_pct: 0.239, FT_pct: 0.767 },
      2000: { team: 'MIN', age: 28, G: 8, MP: 94, MP_pct: 0.073, PER: 11.3, TS_pct: 0.59, ThrPAr: 0.5, FTr: 0.091, ORB_pct: 8.8, TRB_pct: 9.6, AST_pct: 10.8, STL_pct: 1.8, BLK_pct: 0, TOV_pct: 23.4, USG_pct: 15.8, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.085, MIN_pg: 11.8, PTS_pg: 3.4, REB_pg: 1.6, AST_pg: 0.6, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 0.9, FG_pct: 0.455, FG3_pct: 0.545, FT_pct: 0.500 },
    },
  },
  'taylope01w': {
    id: 'taylope01w',
    name: 'Penny Taylor',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'CLE', age: 20, G: 32, MP: 561, MP_pct: 0.437, PER: 21.1, TS_pct: 0.469, ThrPAr: 0.324, FTr: 0.204, ORB_pct: 9.3, TRB_pct: 13.9, AST_pct: 17.8, STL_pct: 3.9, BLK_pct: 1.9, TOV_pct: 13.4, USG_pct: 26.6, OWS: 1.1, DWS: 1.9, WS: 3, WS40: 0.212, MIN_pg: 17.5, PTS_pg: 7.2, REB_pg: 3.5, AST_pg: 1.4, STL_pg: 1, BLK_pg: 0.3, TOV_pg: 1.1, FG_pct: 0.382, FG3_pct: 0.301, FT_pct: 0.783 },
    },
  },
  'thomast01w': {
    id: 'thomast01w',
    name: 'Stacey Thomas',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'POR', age: 21, G: 32, MP: 863, MP_pct: 0.661, PER: 10.8, TS_pct: 0.417, ThrPAr: 0.074, FTr: 0.454, ORB_pct: 7.6, TRB_pct: 10.1, AST_pct: 22.7, STL_pct: 3.5, BLK_pct: 1.6, TOV_pct: 25.8, USG_pct: 14.6, OWS: -0.5, DWS: 1.2, WS: 0.7, WS40: 0.034, MIN_pg: 27, PTS_pg: 5.1, REB_pg: 3.9, AST_pg: 3.2, STL_pg: 1.7, BLK_pg: 0.5, TOV_pg: 2.1, FG_pct: 0.356, FG3_pct: 0.250, FT_pct: 0.595 },
      2001: { team: 'POR', age: 22, G: 32, MP: 413, MP_pct: 0.316, PER: 8.9, TS_pct: 0.391, ThrPAr: 0.117, FTr: 0.583, ORB_pct: 9.2, TRB_pct: 10.5, AST_pct: 19.5, STL_pct: 4.2, BLK_pct: 2.1, TOV_pct: 34.7, USG_pct: 13.7, OWS: -0.7, DWS: 0.7, WS: 0, WS40: -0.002, MIN_pg: 12.9, PTS_pg: 1.8, REB_pg: 2.2, AST_pg: 1.3, STL_pg: 0.9, BLK_pg: 0.3, TOV_pg: 1.3, FG_pct: 0.367, FG3_pct: 0.000, FT_pct: 0.429 },
    },
  },
  'thompal01w': {
    id: 'thompal01w',
    name: 'Alicia Thompson',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'NYL', age: 22, G: 19, MP: 126, MP_pct: 0.104, PER: 4.2, TS_pct: 0.327, ThrPAr: 0.026, FTr: 0.487, ORB_pct: 7.2, TRB_pct: 12.6, AST_pct: 5.7, STL_pct: 0.4, BLK_pct: 1.4, TOV_pct: 14.5, USG_pct: 20.8, OWS: -0.3, DWS: 0.2, WS: -0.1, WS40: -0.04, MIN_pg: 6.6, PTS_pg: 1.6, REB_pg: 1.3, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0.1, TOV_pg: 0.4, FG_pct: 0.231, FG3_pct: 1.000, FT_pct: 0.632 },
      2000: { team: 'IND', age: 24, G: 31, MP: 792, MP_pct: 0.616, PER: 17.4, TS_pct: 0.567, ThrPAr: 0.157, FTr: 0.165, ORB_pct: 8.5, TRB_pct: 13.5, AST_pct: 11.4, STL_pct: 1.7, BLK_pct: 0.4, TOV_pct: 16.2, USG_pct: 20.3, OWS: 1.8, DWS: 0.4, WS: 2.2, WS40: 0.113, MIN_pg: 25.5, PTS_pg: 10, REB_pg: 5.1, AST_pg: 1.3, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.7, FG_pct: 0.514, FG3_pct: 0.450, FT_pct: 0.714 },
      2001: { team: 'IND', age: 25, G: 22, MP: 381, MP_pct: 0.294, PER: 21.2, TS_pct: 0.505, ThrPAr: 0.247, FTr: 0.132, ORB_pct: 7.5, TRB_pct: 11.3, AST_pct: 16.9, STL_pct: 1.4, BLK_pct: 1.6, TOV_pct: 10.7, USG_pct: 27.2, OWS: 1.1, DWS: 0, WS: 1.1, WS40: 0.117, MIN_pg: 17.3, PTS_pg: 8.5, REB_pg: 2.9, AST_pg: 1.1, STL_pg: 0.4, BLK_pg: 0.3, TOV_pg: 1, FG_pct: 0.437, FG3_pct: 0.395, FT_pct: 0.739 },
    },
  },
  'thompti01w': {
    id: 'thompti01w',
    name: 'Tina Thompson',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 22, G: 28, MP: 885, MP_pct: 0.783, PER: 18.6, TS_pct: 0.524, ThrPAr: 0.314, FTr: 0.252, ORB_pct: 9.8, TRB_pct: 13.7, AST_pct: 7.7, STL_pct: 1.3, BLK_pct: 2.7, TOV_pct: 14.9, USG_pct: 22, OWS: 3.2, DWS: 1.1, WS: 4.3, WS40: 0.195, MIN_pg: 31.6, PTS_pg: 13.2, REB_pg: 6.6, AST_pg: 1.1, STL_pg: 0.8, BLK_pg: 1.0, FG_pct: 0.418, FG3_pct: 0.370, FT_pct: 0.838 },
      1998: { team: 'HOU', age: 23, G: 27, MP: 874, MP_pct: 0.719, PER: 19.2, TS_pct: 0.532, ThrPAr: 0.356, FTr: 0.256, ORB_pct: 9.7, TRB_pct: 14.2, AST_pct: 5.3, STL_pct: 2, BLK_pct: 2.4, TOV_pct: 12.8, USG_pct: 20.1, OWS: 2.9, DWS: 2, WS: 5, WS40: 0.228, MIN_pg: 32.4, PTS_pg: 12.7, REB_pg: 7.1, AST_pg: 0.9, STL_pg: 1.2, BLK_pg: 0.9, FG_pct: 0.419, FG3_pct: 0.359, FT_pct: 0.851 },
      1999: { team: 'HOU', age: 24, G: 32, MP: 1074, MP_pct: 0.836, PER: 15.7, TS_pct: 0.518, ThrPAr: 0.327, FTr: 0.257, ORB_pct: 8.7, TRB_pct: 12.6, AST_pct: 5, STL_pct: 1.7, BLK_pct: 2.5, TOV_pct: 16, USG_pct: 20.4, OWS: 1.8, DWS: 2, WS: 3.8, WS40: 0.142, MIN_pg: 33.6, PTS_pg: 12.2, REB_pg: 6.4, AST_pg: 0.9, STL_pg: 1.0, BLK_pg: 1.0, FG_pct: 0.419, FG3_pct: 0.351, FT_pct: 0.782 },
      2000: { team: 'HOU', age: 25, G: 32, MP: 1087, MP_pct: 0.839, PER: 23.9, TS_pct: 0.586, ThrPAr: 0.324, FTr: 0.302, ORB_pct: 9.2, TRB_pct: 15.4, AST_pct: 8.6, STL_pct: 2.5, BLK_pct: 2, TOV_pct: 15.4, USG_pct: 24.9, OWS: 4.3, DWS: 2.9, WS: 7.2, WS40: 0.264, MIN_pg: 34.0, PTS_pg: 16.9, REB_pg: 7.7, AST_pg: 1.5, STL_pg: 1.5, BLK_pg: 0.8, FG_pct: 0.469, FG3_pct: 0.417, FT_pct: 0.837 },
      2001: { team: 'HOU', age: 26, G: 30, MP: 1102, MP_pct: 0.854, PER: 22.2, TS_pct: 0.483, ThrPAr: 0.284, FTr: 0.309, ORB_pct: 9.5, TRB_pct: 13.4, AST_pct: 13.2, STL_pct: 1.6, BLK_pct: 1.8, TOV_pct: 12.7, USG_pct: 31.1, OWS: 3.2, DWS: 1.7, WS: 5, WS40: 0.18, MIN_pg: 36.7, PTS_pg: 19.3, REB_pg: 7.8, AST_pg: 1.9, STL_pg: 1.0, BLK_pg: 0.7, FG_pct: 0.377, FG3_pct: 0.293, FT_pct: 0.840 },
      2002: { team: 'HOU', age: 27, G: 29, MIN_pg: 36.3, PTS_pg: 16.7, REB_pg: 7.5, AST_pg: 2.1, STL_pg: 0.9, BLK_pg: 0.7, FG_pct: 0.431, FG3_pct: 0.370, FT_pct: 0.823 },
      2003: { team: 'HOU', age: 28, G: 28, MIN_pg: 34.8, PTS_pg: 16.9, REB_pg: 5.9, AST_pg: 1.7, STL_pg: 0.6, BLK_pg: 0.8, FG_pct: 0.413, FG3_pct: 0.342, FT_pct: 0.779 },
      2004: { team: 'HOU', age: 29, G: 26, MIN_pg: 36.3, PTS_pg: 20.0, REB_pg: 6.0, AST_pg: 1.8, STL_pg: 0.8, BLK_pg: 0.9, FG_pct: 0.402, FG3_pct: 0.407, FT_pct: 0.789 },
      2005: { team: 'HOU', age: 30, G: 15, MIN_pg: 29.3, PTS_pg: 10.1, REB_pg: 3.8, AST_pg: 1.5, STL_pg: 0.8, BLK_pg: 0.3, FG_pct: 0.413, FG3_pct: 0.300, FT_pct: 0.762 },
      2006: { team: 'HOU', age: 31, G: 21, MIN_pg: 33.1, PTS_pg: 18.7, REB_pg: 5.6, AST_pg: 2.2, STL_pg: 1.0, BLK_pg: 0.6, FG_pct: 0.457, FG3_pct: 0.417, FT_pct: 0.804 },
      2007: { team: 'HOU', age: 32, G: 34, MIN_pg: 36.3, PTS_pg: 18.8, REB_pg: 6.7, AST_pg: 2.8, STL_pg: 0.9, BLK_pg: 0.7, FG_pct: 0.420, FG3_pct: 0.400, FT_pct: 0.834 },
      2008: { team: 'HOU', age: 33, G: 30, MIN_pg: 35.8, PTS_pg: 18.1, REB_pg: 6.9, AST_pg: 2.2, STL_pg: 1.1, BLK_pg: 0.7, FG_pct: 0.413, FG3_pct: 0.406, FT_pct: 0.859 },
      2009: { team: 'LAS', age: 34, G: 34, MIN_pg: 34.8, PTS_pg: 13.0, REB_pg: 5.9, AST_pg: 2.3, STL_pg: 0.8, BLK_pg: 0.7, FG_pct: 0.385, FG3_pct: 0.369, FT_pct: 0.867 },
      2010: { team: 'LAS', age: 35, G: 33, MIN_pg: 33.2, PTS_pg: 16.6, REB_pg: 6.2, AST_pg: 1.8, STL_pg: 1.2, BLK_pg: 0.7, FG_pct: 0.446, FG3_pct: 0.352, FT_pct: 0.872 },
      2011: { team: 'LAS', age: 36, G: 34, MIN_pg: 25.0, PTS_pg: 9.9,  REB_pg: 4.6, AST_pg: 1.1, STL_pg: 1.2, BLK_pg: 0.7, FG_pct: 0.386, FG3_pct: 0.339, FT_pct: 0.833 },
      2012: { team: 'SEA', age: 37, G: 29, MIN_pg: 19.0, PTS_pg: 8.9,  REB_pg: 3.4, AST_pg: 0.5, STL_pg: 0.5, BLK_pg: 0.8, FG_pct: 0.442, FG3_pct: 0.427, FT_pct: 0.833 },
      2013: { team: 'SEA', age: 38, G: 34, MIN_pg: 28.7, PTS_pg: 14.1, REB_pg: 5.8, AST_pg: 1.1, STL_pg: 0.5, BLK_pg: 0.6, FG_pct: 0.410, FG3_pct: 0.370, FT_pct: 0.874 },
    },
  },
  'threaro01w': {
    id: 'threaro01w',
    name: 'Robin Threatt-Elliott',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 29, G: 20, MP: 377, MP_pct: 0.291, PER: 11.6, TS_pct: 0.45, ThrPAr: 0.236, FTr: 0.223, ORB_pct: 3.5, TRB_pct: 6.1, AST_pct: 13.4, STL_pct: 2.1, BLK_pct: 0.7, TOV_pct: 14.8, USG_pct: 27.7, OWS: -0.5, DWS: 0.2, WS: -0.3, WS40: -0.034 },
    },
  },
  'timmsmi01w': {
    id: 'timmsmi01w',
    name: 'Michele Timms',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 32, G: 27, MP: 966, MP_pct: 0.851, PER: 16.2, TS_pct: 0.478, ThrPAr: 0.481, FTr: 0.353, ORB_pct: 2.8, TRB_pct: 6.3, AST_pct: 29.6, STL_pct: 3.9, BLK_pct: 0.3, TOV_pct: 19, USG_pct: 19.6, OWS: 1.8, DWS: 2.1, WS: 4, WS40: 0.164, MIN_pg: 37.5, PTS_pg: 7.6, REB_pg: 4.1, AST_pg: 4.8, STL_pg: 1.9, BLK_pg: 0, TOV_pg: 4.4, FG_pct: 0.352, FG3_pct: 0.189, FT_pct: 0.744 },
      1998: { team: 'PHO', age: 33, G: 30, MP: 934, MP_pct: 0.769, PER: 10.7, TS_pct: 0.423, ThrPAr: 0.466, FTr: 0.22, ORB_pct: 2.4, TRB_pct: 5.1, AST_pct: 29.6, STL_pct: 2.2, BLK_pct: 0.3, TOV_pct: 22, USG_pct: 15.4, OWS: 0.5, DWS: 1.3, WS: 1.8, WS40: 0.076, MIN_pg: 25.3, PTS_pg: 5.5, REB_pg: 2.2, AST_pg: 3.6, STL_pg: 0.8, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.364, FG3_pct: 0.367, FT_pct: 0.759 },
      1999: { team: 'PHO', age: 34, G: 30, MP: 804, MP_pct: 0.628, PER: 12.6, TS_pct: 0.48, ThrPAr: 0.464, FTr: 0.255, ORB_pct: 2.7, TRB_pct: 6.2, AST_pct: 36.8, STL_pct: 3.1, BLK_pct: 0.7, TOV_pct: 29.4, USG_pct: 18, OWS: 0, DWS: 0.9, WS: 0.9, WS40: 0.046, MIN_pg: 9.6, PTS_pg: 1.1, REB_pg: 1, AST_pg: 1.1, STL_pg: 0.3, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.310, FG3_pct: 0.250, FT_pct: 1.000 },
      2000: { team: 'PHO', age: 35, G: 8, MP: 176, MP_pct: 0.137, PER: 8.5, TS_pct: 0.472, ThrPAr: 0.567, FTr: 0.133, ORB_pct: 1.6, TRB_pct: 6.3, AST_pct: 18.2, STL_pct: 5, BLK_pct: 1, TOV_pct: 36.2, USG_pct: 14.4, OWS: -0.3, DWS: 0.4, WS: 0.1, WS40: 0.019, MIN_pg: 12.7, PTS_pg: 2, REB_pg: 1.4, AST_pg: 2, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.353, FG3_pct: 0.444, FT_pct: 0.625 },
      2001: { team: 'PHO', age: 36, G: 21, MP: 408, MP_pct: 0.316, PER: 12.7, TS_pct: 0.428, ThrPAr: 0.418, FTr: 0.091, ORB_pct: 3.5, TRB_pct: 7.2, AST_pct: 42.5, STL_pct: 2.9, BLK_pct: 0.4, TOV_pct: 26.9, USG_pct: 18.5, OWS: -0.1, DWS: 0.4, WS: 0.2, WS40: 0.023 },
    },
  },
  'tolerpe01w': {
    id: 'tolerpe01w',
    name: 'Penny Toler',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 31, G: 28, MP: 907, MP_pct: 0.792, PER: 16.2, TS_pct: 0.489, ThrPAr: 0.112, FTr: 0.257, ORB_pct: 3.6, TRB_pct: 6.3, AST_pct: 29.5, STL_pct: 2.1, BLK_pct: 0.3, TOV_pct: 22.1, USG_pct: 23.6, OWS: 1.4, DWS: 0.7, WS: 2.1, WS40: 0.093, MIN_pg: 32.4, PTS_pg: 13.1, REB_pg: 3.4, AST_pg: 5.1, STL_pg: 1.3, BLK_pg: 0.1, TOV_pg: 3.8, FG_pct: 0.426, FG3_pct: 0.184, FT_pct: 0.839 },
      1998: { team: 'LAS', age: 32, G: 30, MP: 945, MP_pct: 0.784, PER: 15.3, TS_pct: 0.485, ThrPAr: 0.172, FTr: 0.212, ORB_pct: 4.7, TRB_pct: 6.7, AST_pct: 29.8, STL_pct: 1.8, BLK_pct: 0.3, TOV_pct: 20.9, USG_pct: 22.8, OWS: 1.3, DWS: 0.4, WS: 1.7, WS40: 0.072, MIN_pg: 31.5, PTS_pg: 12.3, REB_pg: 3.5, AST_pg: 4.8, STL_pg: 1.1, BLK_pg: 0.1, TOV_pg: 3.3, FG_pct: 0.415, FG3_pct: 0.417, FT_pct: 0.743 },
      1999: { team: 'LAS', age: 33, G: 30, MP: 427, MP_pct: 0.33, PER: 11.5, TS_pct: 0.421, ThrPAr: 0.087, FTr: 0.3, ORB_pct: 3.5, TRB_pct: 6.2, AST_pct: 27.2, STL_pct: 1.7, BLK_pct: 0, TOV_pct: 19.1, USG_pct: 22.5, OWS: 0, DWS: 0.2, WS: 0.3, WS40: 0.024, MIN_pg: 14.2, PTS_pg: 4.8, REB_pg: 1.4, AST_pg: 2.2, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.3, FG_pct: 0.340, FG3_pct: 0.154, FT_pct: 0.867 },
    },
  },
  'torniel01w': {
    id: 'torniel01w',
    name: 'Elena Tornikidou',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 34, G: 11, MP: 86, MP_pct: 0.066, PER: 3.2, TS_pct: 0.39, ThrPAr: 0, FTr: 0.261, ORB_pct: 4.2, TRB_pct: 6.6, AST_pct: 18.5, STL_pct: 0.6, BLK_pct: 1, TOV_pct: 30, USG_pct: 19.8, OWS: -0.3, DWS: 0, WS: -0.3, WS40: -0.128 },
      2000: { team: 'DET', age: 35, G: 32, MP: 869, MP_pct: 0.676, PER: 17.4, TS_pct: 0.585, ThrPAr: 0.033, FTr: 0.386, ORB_pct: 6.2, TRB_pct: 8.3, AST_pct: 17.6, STL_pct: 1.8, BLK_pct: 1.2, TOV_pct: 19.4, USG_pct: 18.4, OWS: 2.5, DWS: 0.3, WS: 2.8, WS40: 0.128 },
      2001: { team: 'DET', age: 36, G: 32, MP: 777, MP_pct: 0.593, PER: 16.8, TS_pct: 0.548, ThrPAr: 0.197, FTr: 0.285, ORB_pct: 4.6, TRB_pct: 6.7, AST_pct: 16.1, STL_pct: 1.4, BLK_pct: 1.6, TOV_pct: 17.4, USG_pct: 21.6, OWS: 1.9, DWS: -0.1, WS: 1.8, WS40: 0.093 },
    },
  },
  'torrele01w': {
    id: 'torrele01w',
    name: 'Levys Torres',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'MIA', age: 23, G: 2, MP: 8, MP_pct: 0.006, PER: -16.3, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 100, USG_pct: 13.3, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.44, MIN_pg: 4, PTS_pg: 0, REB_pg: 0, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 1 },
    },
  },
  'traviti01w': {
    id: 'traviti01w',
    name: 'Tiffany Travis',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'CHA', age: 22, G: 32, MP: 574, MP_pct: 0.443, PER: 12.6, TS_pct: 0.508, ThrPAr: 0.158, FTr: 0.177, ORB_pct: 5.6, TRB_pct: 9.5, AST_pct: 9, STL_pct: 3.1, BLK_pct: 0.6, TOV_pct: 15.8, USG_pct: 17.2, OWS: 0.5, DWS: 0.1, WS: 0.5, WS40: 0.035 },
      1998: { G: 3, MIN_pg: 8.3, PTS_pg: 1.3, REB_pg: 1, AST_pg: 0, STL_pg: 0, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.167, FT_pct: 0.500 },
    },
  },
  'tremich01w': {
    id: 'tremich01w',
    name: 'Chantel Tremitiere',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 27, G: 28, MP: 1051, MP_pct: 0.93, PER: 8.8, TS_pct: 0.45, ThrPAr: 0.189, FTr: 0.459, ORB_pct: 2.9, TRB_pct: 6.8, AST_pct: 23, STL_pct: 2.8, BLK_pct: 0.1, TOV_pct: 34.1, USG_pct: 15.2, OWS: -0.9, DWS: -0.3, WS: -1.1, WS40: -0.042, MIN_pg: 22.6, PTS_pg: 3, REB_pg: 2, AST_pg: 3.7, STL_pg: 0.9, BLK_pg: 0, TOV_pg: 1.8, FG_pct: 0.236, FG3_pct: 0.194, FT_pct: 0.794 },
      1998: { team: 'UTA', age: 28, G: 28, MP: 709, MP_pct: 0.586, PER: 11.7, TS_pct: 0.498, ThrPAr: 0.371, FTr: 0.409, ORB_pct: 2.2, TRB_pct: 5.2, AST_pct: 25, STL_pct: 1.7, BLK_pct: 0.2, TOV_pct: 21.2, USG_pct: 12.7, OWS: 1.1, DWS: -0.3, WS: 0.8, WS40: 0.045, MIN_pg: 13.2, PTS_pg: 1.9, REB_pg: 0.9, AST_pg: 2.3, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.279, FG3_pct: 0.250, FT_pct: 0.724 },
      1999: { team: 'UTA', age: 29, G: 20, MP: 191, MP_pct: 0.147, PER: 3.5, TS_pct: 0.357, ThrPAr: 0.276, FTr: 0.034, ORB_pct: 2, TRB_pct: 6.4, AST_pct: 19.1, STL_pct: 1.7, BLK_pct: 0, TOV_pct: 30.6, USG_pct: 10.2, OWS: -0.2, DWS: 0, WS: -0.3, WS40: -0.059, MIN_pg: 15.4, PTS_pg: 2.2, REB_pg: 1.3, AST_pg: 2, STL_pg: 0.8, BLK_pg: 0, TOV_pg: 1.5, FG_pct: 0.273, FG3_pct: 0.136, FT_pct: 0.647 },
      2000: { team: 'IND', age: 30, G: 25, MP: 318, MP_pct: 0.247, PER: 7.5, TS_pct: 0.431, ThrPAr: 0.176, FTr: 0.314, ORB_pct: 2.6, TRB_pct: 6.6, AST_pct: 28.5, STL_pct: 1.8, BLK_pct: 0.3, TOV_pct: 34.1, USG_pct: 13.6, OWS: -0.3, DWS: 0, WS: -0.2, WS40: -0.027 },
    },
  },
  'tricetr01w': {
    id: 'tricetr01w',
    name: 'Trena Trice',
    position: 'F-C',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 31, G: 28, MP: 340, MP_pct: 0.3, PER: 12.9, TS_pct: 0.599, ThrPAr: 0.087, FTr: 0.489, ORB_pct: 11.6, TRB_pct: 12.3, AST_pct: 1.2, STL_pct: 1.4, BLK_pct: 2.2, TOV_pct: 26.4, USG_pct: 20.1, OWS: 0.4, DWS: 0.5, WS: 0.9, WS40: 0.11 },
      1998: { team: 'NYL', age: 32, G: 10, MP: 77, MP_pct: 0.064, PER: 8.3, TS_pct: 0.481, ThrPAr: 0, FTr: 0.647, ORB_pct: 11.7, TRB_pct: 15.4, AST_pct: 2.4, STL_pct: 0, BLK_pct: 3.4, TOV_pct: 24.3, USG_pct: 17.7, OWS: 0, DWS: 0.1, WS: 0.1, WS40: 0.046 },
    },
  },
  'tutermo01w': {
    id: 'tutermo01w',
    name: 'Molly Tuter',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 21, G: 3, MP: 3, MP_pct: 0.003, PER: -25, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 30, OWS: 0, DWS: 0, WS: 0, WS40: -0.648 },
    },
  },
  'tuvicsl01w': {
    id: 'tuvicsl01w',
    name: 'Slobodanka Tuvic',
    position: 'C',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 23, G: 30, MP: 325, MP_pct: 0.252, PER: 7.4, TS_pct: 0.397, ThrPAr: 0, FTr: 1.405, ORB_pct: 7.2, TRB_pct: 12.7, AST_pct: 9.4, STL_pct: 2.8, BLK_pct: 4.5, TOV_pct: 29.2, USG_pct: 14.3, OWS: -0.7, DWS: 0.5, WS: -0.1, WS40: -0.013 },
    },
  },
  'tzekopo01w': {
    id: 'tzekopo01w',
    name: 'Polina Tzekova',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'HOU', age: 31, G: 32, MP: 778, MP_pct: 0.605, PER: 10.4, TS_pct: 0.498, ThrPAr: 0.249, FTr: 0.226, ORB_pct: 9.7, TRB_pct: 13.8, AST_pct: 7.4, STL_pct: 1, BLK_pct: 2.1, TOV_pct: 21.1, USG_pct: 15.4, OWS: 0.6, DWS: 1.3, WS: 1.9, WS40: 0.099 },
    },
  },
  'udokamf01w': {
    id: 'udokamf01w',
    name: 'Mfon Udoka',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'DET', age: 22, G: 3, MP: 25, MP_pct: 0.021, PER: -2.4, TS_pct: 0.258, ThrPAr: 0, FTr: 0.667, ORB_pct: 4.7, TRB_pct: 7.1, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 11.4, USG_pct: 15.9, OWS: -0.1, DWS: 0, WS: -0.1, WS40: -0.114 },
      2001: { G: 25, MIN_pg: 18.2, PTS_pg: 3, REB_pg: 1.7, AST_pg: 1.7, STL_pg: 1, BLK_pg: 0.2, TOV_pg: 1.6, FG_pct: 0.297, FG3_pct: 0.115, FT_pct: 0.292 },
      2002: { G: 15, MIN_pg: 11, PTS_pg: 1.6, REB_pg: 0.7, AST_pg: 1.2, STL_pg: 0.5, BLK_pg: 0.1, TOV_pg: 1, FG_pct: 0.417, FG3_pct: 0.200, FT_pct: 0.600 },
    },
  },
  'valdeam01w': {
    id: 'valdeam01w',
    name: 'Amaya Valdemoro',
    position: 'F',
    retired: true,
    seasons: {
      1998: { team: 'HOU', age: 21, G: 16, MP: 61, MP_pct: 0.05, PER: 18.1, TS_pct: 0.639, ThrPAr: 0.313, FTr: 1.063, ORB_pct: 4.3, TRB_pct: 10.6, AST_pct: 21.9, STL_pct: 6.4, BLK_pct: 1.4, TOV_pct: 42, USG_pct: 31.7, OWS: -0.1, DWS: 0.2, WS: 0.1, WS40: 0.084 },
      1999: { team: 'HOU', age: 22, G: 17, MP: 92, MP_pct: 0.072, PER: 17.2, TS_pct: 0.476, ThrPAr: 0.143, FTr: 0.457, ORB_pct: 6, TRB_pct: 9.3, AST_pct: 19.1, STL_pct: 6.9, BLK_pct: 0, TOV_pct: 22.2, USG_pct: 28.6, OWS: 0, DWS: 0.3, WS: 0.3, WS40: 0.125 },
      2000: { team: 'HOU', age: 23, G: 22, MP: 171, MP_pct: 0.132, PER: 11.8, TS_pct: 0.455, ThrPAr: 0.483, FTr: 0.1, ORB_pct: 2.6, TRB_pct: 8.4, AST_pct: 13.3, STL_pct: 2.7, BLK_pct: 2, TOV_pct: 17.2, USG_pct: 21.9, OWS: 0, DWS: 0.4, WS: 0.4, WS40: 0.093 },
    },
  },
  'vanemal01w': {
    id: 'vanemal01w',
    name: 'Sandra Van Embricqs',
    position: 'F-C',
    retired: true,
    seasons: {
      1998: { team: 'LAS', age: 30, G: 28, MP: 470, MP_pct: 0.39, PER: 10.9, TS_pct: 0.489, ThrPAr: 0, FTr: 0.18, ORB_pct: 8.7, TRB_pct: 9.5, AST_pct: 6, STL_pct: 2.7, BLK_pct: 1.5, TOV_pct: 16.5, USG_pct: 11, OWS: 0.5, DWS: 0.5, WS: 1, WS40: 0.082 },
    },
  },
  'vangomi01w': {
    id: 'vangomi01w',
    name: 'Michele Van Gorp',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'NYL', age: 22, G: 21, MP: 117, MP_pct: 0.09, PER: 5.9, TS_pct: 0.382, ThrPAr: 0, FTr: 0.208, ORB_pct: 5.6, TRB_pct: 9.9, AST_pct: 11, STL_pct: 0.5, BLK_pct: 2.5, TOV_pct: 10.3, USG_pct: 12.4, OWS: 0, DWS: 0.1, WS: 0.2, WS40: 0.06, MIN_pg: 4.1, PTS_pg: 1.6, REB_pg: 1.2, AST_pg: 0.2, STL_pg: 0.1, BLK_pg: 0, TOV_pg: 0.3, FG_pct: 0.231, FG3_pct: 0.000, FT_pct: 0.833 },
      2000: { team: 'POR', age: 23, G: 28, MP: 199, MP_pct: 0.152, PER: 7.4, TS_pct: 0.528, ThrPAr: 0, FTr: 0.7, ORB_pct: 11, TRB_pct: 14.6, AST_pct: 5.5, STL_pct: 0.8, BLK_pct: 1.9, TOV_pct: 31.4, USG_pct: 22.9, OWS: -0.4, DWS: 0.2, WS: -0.3, WS40: -0.053, MIN_pg: 25.6, PTS_pg: 11.9, REB_pg: 5.3, AST_pg: 1.3, STL_pg: 0.4, BLK_pg: 1.6, TOV_pg: 2.4, FG_pct: 0.561, FG3_pct: 0.000, FT_pct: 0.740 },
      2001: { team: 'MIN', age: 24, G: 22, MP: 243, MP_pct: 0.188, PER: 4.6, TS_pct: 0.42, ThrPAr: 0.025, FTr: 0.5, ORB_pct: 8, TRB_pct: 9, AST_pct: 10.8, STL_pct: 0.7, BLK_pct: 2.2, TOV_pct: 26.9, USG_pct: 13.5, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.029, MIN_pg: 12.2, PTS_pg: 4.9, REB_pg: 2.4, AST_pg: 0.5, STL_pg: 0.1, BLK_pg: 0.8, TOV_pg: 1.1, FG_pct: 0.470, FG3_pct: 0.000, FT_pct: 0.806 },
    },
  },
  'vealkr01w': {
    id: 'vealkr01w',
    name: 'Kristen Veal',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'PHO', age: 19, G: 29, MP: 658, MP_pct: 0.51, PER: 8.3, TS_pct: 0.404, ThrPAr: 0.4, FTr: 0.336, ORB_pct: 2.8, TRB_pct: 6, AST_pct: 35.1, STL_pct: 2.9, BLK_pct: 0.5, TOV_pct: 36.4, USG_pct: 16.5, OWS: -1.3, DWS: 0.5, WS: -0.8, WS40: -0.049, MIN_pg: 9, PTS_pg: 2.4, REB_pg: 1.4, AST_pg: 0.3, STL_pg: 0.4, BLK_pg: 0.3, TOV_pg: 0.5, FG_pct: 0.325, FG3_pct: 0.333, FT_pct: 0.680 },
    },
  },
  'viglida01w': {
    id: 'viglida01w',
    name: 'Danielle Viglione',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 22, G: 7, MP: 30, MP_pct: 0.027, PER: 5.7, TS_pct: 0.318, ThrPAr: 0.364, FTr: 0, ORB_pct: 4.1, TRB_pct: 8.4, AST_pct: 6.4, STL_pct: 1.8, BLK_pct: 0, TOV_pct: 0, USG_pct: 16.4, OWS: 0, DWS: 0, WS: 0, WS40: -0.01 },
      1998: { G: 15, MIN_pg: 4.7, PTS_pg: 1.7, REB_pg: 0.7, AST_pg: 0.4, STL_pg: 0.3, BLK_pg: 0.1, TOV_pg: 0.6, FG_pct: 0.240, FG3_pct: 0.273, FT_pct: 0.667 },
    },
  },
  'vodicka01w': {
    id: 'vodicka01w',
    name: 'Kamila Vodichkova',
    position: 'F-C',
    retired: true,
    seasons: {
      2000: { team: 'SEA', age: 27, G: 23, MP: 489, MP_pct: 0.378, PER: 13.5, TS_pct: 0.487, ThrPAr: 0.117, FTr: 0.456, ORB_pct: 7.6, TRB_pct: 14.3, AST_pct: 12, STL_pct: 1.6, BLK_pct: 2.3, TOV_pct: 21.7, USG_pct: 27.7, OWS: -0.6, DWS: 0.6, WS: 0, WS40: -0.001 },
      2001: { team: 'SEA', age: 28, G: 29, MP: 405, MP_pct: 0.309, PER: 16.7, TS_pct: 0.531, ThrPAr: 0.205, FTr: 0.361, ORB_pct: 7.6, TRB_pct: 11.8, AST_pct: 14.2, STL_pct: 2.4, BLK_pct: 1.6, TOV_pct: 19.4, USG_pct: 22.5, OWS: 0.7, DWS: 0.5, WS: 1.2, WS40: 0.116 },
    },
  },
  'vukadmi01w': {
    id: 'vukadmi01w',
    name: 'Milica Vukadinovic',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 28, G: 1, MP: 14, MP_pct: 0.013, PER: 8.5, TS_pct: 1.5, ThrPAr: 1, FTr: 0, ORB_pct: 0, TRB_pct: 4.4, AST_pct: 12.5, STL_pct: 3.9, BLK_pct: 0, TOV_pct: 75, USG_pct: 13.6, OWS: -0.1, DWS: 0, WS: 0, WS40: -0.102 },
    },
  },
  'walkede01w': {
    id: 'walkede01w',
    name: 'DeMya Walker',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'POR', age: 22, G: 30, MP: 311, MP_pct: 0.238, PER: 7.5, TS_pct: 0.423, ThrPAr: 0.023, FTr: 0.534, ORB_pct: 12.7, TRB_pct: 10.4, AST_pct: 13, STL_pct: 3.1, BLK_pct: 2.1, TOV_pct: 24.4, USG_pct: 22.1, OWS: -0.7, DWS: 0.3, WS: -0.3, WS40: -0.04, MIN_pg: 18.7, PTS_pg: 6.2, REB_pg: 4, AST_pg: 1.2, STL_pg: 0.6, BLK_pg: 0.7, TOV_pg: 1.9, FG_pct: 0.523, FG3_pct: 0.000, FT_pct: 0.741 },
      2001: { team: 'POR', age: 23, G: 21, MP: 297, MP_pct: 0.228, PER: 11.7, TS_pct: 0.48, ThrPAr: 0.03, FTr: 0.4, ORB_pct: 12, TRB_pct: 12.1, AST_pct: 8.1, STL_pct: 1.3, BLK_pct: 3.4, TOV_pct: 22.9, USG_pct: 25.2, OWS: -0.3, DWS: 0.3, WS: 0, WS40: -0.003, MIN_pg: 25.9, PTS_pg: 9.8, REB_pg: 4.8, AST_pg: 1.5, STL_pg: 0.7, BLK_pg: 0.5, TOV_pg: 2, FG_pct: 0.569, FG3_pct: 0.000, FT_pct: 0.800 },
    },
  },
  'walsema01w': {
    id: 'walsema01w',
    name: 'Maren Walseth',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'SAC', age: 22, G: 4, MP: 8, MP_pct: 0.006, PER: 12.5, TS_pct: 0.694, ThrPAr: 0, FTr: 1, ORB_pct: 31.5, TRB_pct: 15.5, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 41, USG_pct: 29.1, OWS: 0, DWS: 0, WS: 0, WS40: 0.049 },
    },
  },
  'washico01w': {
    id: 'washico01w',
    name: 'Coquese Washington',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'NYL', age: 27, G: 28, MP: 226, MP_pct: 0.187, PER: 8.8, TS_pct: 0.424, ThrPAr: 0.412, FTr: 0.51, ORB_pct: 2.8, TRB_pct: 7.6, AST_pct: 34.8, STL_pct: 4.2, BLK_pct: 0, TOV_pct: 37.2, USG_pct: 20.8, OWS: -0.6, DWS: 0.5, WS: -0.1, WS40: -0.013 },
      1999: { team: 'NYL', age: 28, G: 19, MP: 77, MP_pct: 0.059, PER: 4.9, TS_pct: 0.318, ThrPAr: 0.278, FTr: 0.111, ORB_pct: 1.7, TRB_pct: 6.2, AST_pct: 35.5, STL_pct: 6.8, BLK_pct: 0, TOV_pct: 40.8, USG_pct: 20.6, OWS: -0.4, DWS: 0.2, WS: -0.2, WS40: -0.091, MIN_pg: 24.6, PTS_pg: 6.5, REB_pg: 6.7, AST_pg: 1.6, STL_pg: 1.3, BLK_pg: 1, TOV_pg: 1.5, FG_pct: 0.380, FG3_pct: 0.000, FT_pct: 0.455 },
      2000: { team: 'HOU', age: 29, G: 25, MP: 236, MP_pct: 0.182, PER: 10, TS_pct: 0.514, ThrPAr: 0.455, FTr: 0.606, ORB_pct: 1.9, TRB_pct: 5.5, AST_pct: 16, STL_pct: 3.9, BLK_pct: 0, TOV_pct: 31.3, USG_pct: 12.8, OWS: 0, DWS: 0.5, WS: 0.6, WS40: 0.094 },
      2001: { team: 'HOU', age: 30, G: 32, MP: 1013, MP_pct: 0.785, PER: 12.9, TS_pct: 0.453, ThrPAr: 0.458, FTr: 0.124, ORB_pct: 2.5, TRB_pct: 7.4, AST_pct: 23.3, STL_pct: 4.1, BLK_pct: 0.8, TOV_pct: 23.4, USG_pct: 12, OWS: 0.5, DWS: 2.1, WS: 2.6, WS40: 0.102, MIN_pg: 17.8, PTS_pg: 3.4, REB_pg: 3.2, AST_pg: 0.6, STL_pg: 0.6, BLK_pg: 0.5, TOV_pg: 1.3, FG_pct: 0.267, FG3_pct: 0.000, FT_pct: 0.741 },
    },
  },
  'washito01w': {
    id: 'washito01w',
    name: 'Tonya Massaline',
    position: 'F',
    retired: true,
    seasons: {
      2000: { team: 'WAS', age: 22, G: 19, MP: 103, MP_pct: 0.08, PER: 9.5, TS_pct: 0.411, ThrPAr: 0.483, FTr: 0.207, ORB_pct: 8.2, TRB_pct: 9.4, AST_pct: 8.5, STL_pct: 1.1, BLK_pct: 0, TOV_pct: 11.2, USG_pct: 17.2, OWS: 0, DWS: 0, WS: 0.1, WS40: 0.02 },
      2001: { team: 'WAS', age: 23, G: 30, MP: 336, MP_pct: 0.258, PER: 11.3, TS_pct: 0.425, ThrPAr: 0.254, FTr: 0.096, ORB_pct: 6.7, TRB_pct: 7.8, AST_pct: 6.7, STL_pct: 0.7, BLK_pct: 0.5, TOV_pct: 10.5, USG_pct: 19.5, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.026 },
    },
  },
  'wautean01w': {
    id: 'wautean01w',
    name: 'Ann Wauters',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'CLE', age: 19, G: 32, MP: 598, MP_pct: 0.46, PER: 16, TS_pct: 0.57, ThrPAr: 0.013, FTr: 0.389, ORB_pct: 11, TRB_pct: 15.5, AST_pct: 12.6, STL_pct: 2.1, BLK_pct: 3.7, TOV_pct: 26.5, USG_pct: 19.7, OWS: 0.5, DWS: 1.2, WS: 1.7, WS40: 0.115, MIN_pg: 18.7, PTS_pg: 6.2, REB_pg: 4, AST_pg: 1.2, STL_pg: 0.6, BLK_pg: 0.7, TOV_pg: 1.9, FG_pct: 0.523, FG3_pct: 0.000, FT_pct: 0.741 },
      2001: { team: 'CLE', age: 20, G: 24, MP: 622, MP_pct: 0.484, PER: 20.2, TS_pct: 0.629, ThrPAr: 0.013, FTr: 0.49, ORB_pct: 8.1, TRB_pct: 12.7, AST_pct: 12.4, STL_pct: 1.7, BLK_pct: 2, TOV_pct: 21.2, USG_pct: 20, OWS: 2.1, DWS: 1.6, WS: 3.6, WS40: 0.234, MIN_pg: 22.1, PTS_pg: 6, REB_pg: 4, AST_pg: 1, STL_pg: 0.6, BLK_pg: 0.5, TOV_pg: 1.6, FG_pct: 0.523, FG3_pct: 0.000, FT_pct: 0.741 },
    },
  },
  'weathte01w': {
    id: 'weathte01w',
    name: 'Teresa Weatherspoon',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 31, G: 28, MP: 924, MP_pct: 0.814, PER: 16.3, TS_pct: 0.541, ThrPAr: 0.255, FTr: 0.73, ORB_pct: 3.3, TRB_pct: 7.7, AST_pct: 33.6, STL_pct: 5, BLK_pct: 0.2, TOV_pct: 34.2, USG_pct: 13.4, OWS: 1.1, DWS: 2.4, WS: 3.4, WS40: 0.149, MIN_pg: 33.0, PTS_pg: 7.0, REB_pg: 4.1, AST_pg: 6.2, STL_pg: 3.0, BLK_pg: 0.1, FG_pct: 0.467, FG3_pct: 0.086, FT_pct: 0.650 },
      1998: { team: 'NYL', age: 32, G: 30, MP: 1002, MP_pct: 0.828, PER: 15.3, TS_pct: 0.467, ThrPAr: 0.261, FTr: 0.367, ORB_pct: 2.6, TRB_pct: 7.9, AST_pct: 34.4, STL_pct: 5.6, BLK_pct: 0, TOV_pct: 30.5, USG_pct: 14.8, OWS: 0.3, DWS: 2.7, WS: 3, WS40: 0.118, MIN_pg: 33.4, PTS_pg: 6.8, REB_pg: 4.0, AST_pg: 6.4, STL_pg: 3.3, BLK_pg: 0.0, FG_pct: 0.388, FG3_pct: 0.327, FT_pct: 0.609 },
      1999: { team: 'NYL', age: 33, G: 32, MP: 1086, MP_pct: 0.832, PER: 16.3, TS_pct: 0.533, ThrPAr: 0.432, FTr: 0.295, ORB_pct: 2.6, TRB_pct: 6.5, AST_pct: 35, STL_pct: 4.2, BLK_pct: 0.3, TOV_pct: 27.2, USG_pct: 13.5, OWS: 2, DWS: 2.2, WS: 4.2, WS40: 0.154, MIN_pg: 33.9, PTS_pg: 7.2, REB_pg: 3.3, AST_pg: 6.4, STL_pg: 2.4, BLK_pg: 0.1, FG_pct: 0.421, FG3_pct: 0.378, FT_pct: 0.679 },
      2000: { team: 'NYL', age: 34, G: 32, MP: 1078, MP_pct: 0.839, PER: 15, TS_pct: 0.543, ThrPAr: 0.288, FTr: 0.529, ORB_pct: 2, TRB_pct: 6.8, AST_pct: 34.3, STL_pct: 3.6, BLK_pct: 0.4, TOV_pct: 31.3, USG_pct: 12.9, OWS: 1.5, DWS: 2.2, WS: 3.7, WS40: 0.138, MIN_pg: 33.7, PTS_pg: 6.4, REB_pg: 3.4, AST_pg: 6.4, STL_pg: 2.0, BLK_pg: 0.2, FG_pct: 0.438, FG3_pct: 0.250, FT_pct: 0.741 },
      2001: { team: 'NYL', age: 35, G: 32, MP: 974, MP_pct: 0.761, PER: 16.5, TS_pct: 0.513, ThrPAr: 0.156, FTr: 0.473, ORB_pct: 4.1, TRB_pct: 8.2, AST_pct: 36.1, STL_pct: 3.3, BLK_pct: 0.4, TOV_pct: 28.6, USG_pct: 15, OWS: 2, DWS: 1.2, WS: 3.2, WS40: 0.132, MIN_pg: 30.4, PTS_pg: 6.5, REB_pg: 3.7, AST_pg: 6.3, STL_pg: 1.7, BLK_pg: 0.1, FG_pct: 0.431, FG3_pct: 0.385, FT_pct: 0.671 },
      2002: { team: 'NYL', age: 36, G: 32, MIN_pg: 29.8, PTS_pg: 3.4, REB_pg: 2.7, AST_pg: 5.7, STL_pg: 1.3, BLK_pg: 0.1, FG_pct: 0.342, FG3_pct: 0.100, FT_pct: 0.519 },
      2003: { team: 'NYL', age: 37, G: 34, MIN_pg: 24.2, PTS_pg: 2.9, REB_pg: 2.9, AST_pg: 4.4, STL_pg: 0.8, BLK_pg: 0.1, FG_pct: 0.385, FG3_pct: 0.000, FT_pct: 0.750 },
      2004: { team: 'LAS', age: 38, G: 34, MIN_pg: 8.6, PTS_pg: 0.5, REB_pg: 0.9, AST_pg: 0.9, STL_pg: 0.4, BLK_pg: 0.0, FG_pct: 0.320, FG3_pct: 0.333 },
    },
  },
  'webbum01w': {
    id: 'webbum01w',
    name: 'Umeki Webb',
    position: 'G-F',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 22, G: 28, MP: 775, MP_pct: 0.683, PER: 10.2, TS_pct: 0.376, ThrPAr: 0.095, FTr: 0.424, ORB_pct: 6.3, TRB_pct: 9.3, AST_pct: 16.8, STL_pct: 4.7, BLK_pct: 0.9, TOV_pct: 22.7, USG_pct: 14.1, OWS: -0.5, DWS: 2.1, WS: 1.6, WS40: 0.083 },
      1998: { team: 'PHO', age: 23, G: 30, MP: 846, MP_pct: 0.696, PER: 11.9, TS_pct: 0.431, ThrPAr: 0.087, FTr: 0.366, ORB_pct: 7, TRB_pct: 8.9, AST_pct: 18.8, STL_pct: 3, BLK_pct: 2, TOV_pct: 18, USG_pct: 12.3, OWS: 0.9, DWS: 1.6, WS: 2.6, WS40: 0.123 },
      2000: { team: 'MIA', age: 25, G: 13, MP: 195, MP_pct: 0.151, PER: 3.3, TS_pct: 0.422, ThrPAr: 0.2, FTr: 0.625, ORB_pct: 2, TRB_pct: 4.9, AST_pct: 16, STL_pct: 2.2, BLK_pct: 2, TOV_pct: 31.1, USG_pct: 19, OWS: -0.6, DWS: 0.3, WS: -0.3, WS40: -0.051 },
    },
  },
  'whitiva01w': {
    id: 'whitiva01w',
    name: 'Val Whiting-Raymond',
    position: 'C-F',
    retired: true,
    seasons: {
      1999: { team: 'DET', age: 27, G: 31, MP: 764, MP_pct: 0.588, PER: 14.5, TS_pct: 0.407, ThrPAr: 0, FTr: 0.55, ORB_pct: 10.3, TRB_pct: 17.1, AST_pct: 12.6, STL_pct: 2.9, BLK_pct: 3.4, TOV_pct: 15.6, USG_pct: 17.9, OWS: -0.3, DWS: 1.7, WS: 1.4, WS40: 0.075 },
      2001: { team: 'MIN', age: 29, G: 26, MP: 462, MP_pct: 0.357, PER: 6.2, TS_pct: 0.387, ThrPAr: 0.011, FTr: 0.6, ORB_pct: 7, TRB_pct: 11.5, AST_pct: 7.4, STL_pct: 1.9, BLK_pct: 2.7, TOV_pct: 23, USG_pct: 15.7, OWS: -0.7, DWS: 0.6, WS: -0.1, WS40: -0.011 },
      1997: { G: 28, MIN_pg: 19.9, PTS_pg: 9.3, REB_pg: 4.4, AST_pg: 0.6, STL_pg: 0.4, BLK_pg: 0.7, TOV_pg: 1.6, FG_pct: 0.618, FT_pct: 0.661 },
      1998: { G: 6, MIN_pg: 16.3, PTS_pg: 7.5, REB_pg: 4.3, AST_pg: 0.5, STL_pg: 0, BLK_pg: 0.2, TOV_pg: 1, FG_pct: 0.625, FT_pct: 0.714 },
    },
  },
  'whitmta01w': {
    id: 'whitmta01w',
    name: 'Tamika Whitmore',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'NYL', age: 22, G: 27, MP: 573, MP_pct: 0.439, PER: 11.7, TS_pct: 0.49, ThrPAr: 0.043, FTr: 0.424, ORB_pct: 9.8, TRB_pct: 11.4, AST_pct: 6.6, STL_pct: 1.6, BLK_pct: 1, TOV_pct: 20.4, USG_pct: 23.8, OWS: -0.1, DWS: 0.8, WS: 0.7, WS40: 0.051, MIN_pg: 32.3, PTS_pg: 11.8, REB_pg: 2.1, AST_pg: 1.6, STL_pg: 1.9, BLK_pg: 0.3, TOV_pg: 2.3, FG_pct: 0.383, FG3_pct: 0.341, FT_pct: 0.704 },
      2000: { team: 'NYL', age: 23, G: 32, MP: 689, MP_pct: 0.536, PER: 12.9, TS_pct: 0.478, ThrPAr: 0.012, FTr: 0.332, ORB_pct: 6.8, TRB_pct: 10.3, AST_pct: 6.3, STL_pct: 1.5, BLK_pct: 2.3, TOV_pct: 15.5, USG_pct: 25.2, OWS: 0.1, DWS: 1.2, WS: 1.2, WS40: 0.072, MIN_pg: 29.2, PTS_pg: 9.8, REB_pg: 2.2, AST_pg: 2.5, STL_pg: 1.3, BLK_pg: 0.2, TOV_pg: 2.3, FG_pct: 0.439, FG3_pct: 0.361, FT_pct: 0.697 },
      2001: { team: 'NYL', age: 24, G: 32, MP: 752, MP_pct: 0.588, PER: 10.7, TS_pct: 0.457, ThrPAr: 0.009, FTr: 0.261, ORB_pct: 5.3, TRB_pct: 8.7, AST_pct: 4.8, STL_pct: 1.3, BLK_pct: 1.2, TOV_pct: 11.8, USG_pct: 19.2, OWS: 0.2, DWS: 0.5, WS: 0.7, WS40: 0.039, MIN_pg: 27.3, PTS_pg: 10.1, REB_pg: 2.3, AST_pg: 2.2, STL_pg: 1.8, BLK_pg: 0.2, TOV_pg: 2.1, FG_pct: 0.442, FG3_pct: 0.393, FT_pct: 0.683 },
    },
  },
  'whittje01w': {
    id: 'whittje01w',
    name: 'Jennifer Whittle',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'WAS', age: 25, G: 3, MP: 18, MP_pct: 0.014, PER: -13.7, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 0, TRB_pct: 10.7, AST_pct: 0, STL_pct: 3.2, BLK_pct: 4.5, TOV_pct: 71.4, USG_pct: 18.9, OWS: -0.3, DWS: 0, WS: -0.2, WS40: -0.486 },
      2001: { team: 'WAS', age: 27, G: 4, MP: 20, MP_pct: 0.015, PER: -18.2, TS_pct: 0, ThrPAr: 1, FTr: 2, ORB_pct: 5.9, TRB_pct: 3.1, AST_pct: 0, STL_pct: 0, BLK_pct: 4.2, TOV_pct: 61.5, USG_pct: 12.1, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.353 },
    },
  },
  'wickssu01w': {
    id: 'wickssu01w',
    name: 'Sue Wicks',
    position: 'F',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 30, G: 28, MP: 332, MP_pct: 0.293, PER: 12.3, TS_pct: 0.411, ThrPAr: 0.065, FTr: 0.308, ORB_pct: 13.3, TRB_pct: 17.4, AST_pct: 17.2, STL_pct: 2.8, BLK_pct: 4.5, TOV_pct: 27.5, USG_pct: 22.7, OWS: -0.6, DWS: 0.9, WS: 0.4, WS40: 0.046, MIN_pg: 11.9, PTS_pg: 3.6, REB_pg: 3.4, AST_pg: 1.0, STL_pg: 0.6, BLK_pg: 0.6, FG_pct: 0.355, FG3_pct: 0.286, FT_pct: 0.667 },
      1998: { team: 'NYL', age: 31, G: 30, MP: 444, MP_pct: 0.367, PER: 12.1, TS_pct: 0.505, ThrPAr: 0.028, FTr: 0.421, ORB_pct: 11.6, TRB_pct: 12.3, AST_pct: 15.5, STL_pct: 2, BLK_pct: 2, TOV_pct: 27.5, USG_pct: 18.6, OWS: 0.2, DWS: 0.7, WS: 0.9, WS40: 0.084, MIN_pg: 14.8, PTS_pg: 4.3, REB_pg: 2.8, AST_pg: 1.2, STL_pg: 0.5, BLK_pg: 0.3, FG_pct: 0.430, FG3_pct: 0.000, FT_pct: 0.800 },
      1999: { team: 'NYL', age: 32, G: 32, MP: 938, MP_pct: 0.719, PER: 12.5, TS_pct: 0.434, ThrPAr: 0.066, FTr: 0.23, ORB_pct: 10.6, TRB_pct: 16.1, AST_pct: 9.3, STL_pct: 2.6, BLK_pct: 4.5, TOV_pct: 20.2, USG_pct: 16.5, OWS: -0.3, DWS: 2.3, WS: 2, WS40: 0.085, MIN_pg: 29.3, PTS_pg: 6.8, REB_pg: 7.0, AST_pg: 1.4, STL_pg: 1.3, BLK_pg: 1.3, FG_pct: 0.403, FG3_pct: 0.133, FT_pct: 0.615 },
      2000: { team: 'NYL', age: 33, G: 32, MP: 680, MP_pct: 0.529, PER: 12.1, TS_pct: 0.458, ThrPAr: 0.035, FTr: 0.434, ORB_pct: 9.9, TRB_pct: 14.8, AST_pct: 5.8, STL_pct: 2.3, BLK_pct: 5.3, TOV_pct: 22.7, USG_pct: 16.4, OWS: -0.3, DWS: 1.7, WS: 1.4, WS40: 0.082, MIN_pg: 21.3, PTS_pg: 4.9, REB_pg: 4.7, AST_pg: 0.7, STL_pg: 0.8, BLK_pg: 1.2, FG_pct: 0.385, FG3_pct: 0.200, FT_pct: 0.726 },
      2001: { team: 'NYL', age: 34, G: 30, MP: 602, MP_pct: 0.47, PER: 16.1, TS_pct: 0.513, ThrPAr: 0.054, FTr: 0.4, ORB_pct: 8.2, TRB_pct: 15.5, AST_pct: 11.2, STL_pct: 3.5, BLK_pct: 4.7, TOV_pct: 22, USG_pct: 16.8, OWS: 0.6, DWS: 1.4, WS: 2, WS40: 0.132, MIN_pg: 20.1, PTS_pg: 5.2, REB_pg: 4.6, AST_pg: 1.2, STL_pg: 1.2, BLK_pg: 1.0, FG_pct: 0.469, FG3_pct: 0.000, FT_pct: 0.673 },
      2002: { team: 'NYL', age: 35, G: 30, MIN_pg: 14.3, PTS_pg: 2.2, REB_pg: 3.4, AST_pg: 0.5, STL_pg: 0.7, BLK_pg: 0.5, FG_pct: 0.343, FG3_pct: 0.000, FT_pct: 0.667 },
    },
  },
  'widemja01w': {
    id: 'widemja01w',
    name: 'Jamila Wideman',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 21, G: 28, MP: 633, MP_pct: 0.553, PER: 7.3, TS_pct: 0.347, ThrPAr: 0.34, FTr: 0.321, ORB_pct: 3.3, TRB_pct: 5.4, AST_pct: 24.9, STL_pct: 2, BLK_pct: 0.1, TOV_pct: 29.7, USG_pct: 12, OWS: -0.4, DWS: 0.4, WS: 0, WS40: -0.001, MIN_pg: 22.6, PTS_pg: 3, REB_pg: 2, AST_pg: 3.7, STL_pg: 0.9, BLK_pg: 0, TOV_pg: 1.8, FG_pct: 0.236, FG3_pct: 0.194, FT_pct: 0.794 },
      1998: { team: 'LAS', age: 22, G: 25, MP: 329, MP_pct: 0.273, PER: 6.7, TS_pct: 0.43, ThrPAr: 0.279, FTr: 0.674, ORB_pct: 1.8, TRB_pct: 4, AST_pct: 27.7, STL_pct: 1.6, BLK_pct: 0.2, TOV_pct: 37.9, USG_pct: 12.2, OWS: -0.3, DWS: 0.1, WS: -0.2, WS40: -0.023, MIN_pg: 13.2, PTS_pg: 1.9, REB_pg: 0.9, AST_pg: 2.3, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.4, FG_pct: 0.279, FG3_pct: 0.250, FT_pct: 0.724 },
      1999: { team: 'CLE', age: 23, G: 26, MP: 401, MP_pct: 0.313, PER: 5, TS_pct: 0.331, ThrPAr: 0.286, FTr: 0.221, ORB_pct: 2.7, TRB_pct: 5.5, AST_pct: 23.3, STL_pct: 2.8, BLK_pct: 0, TOV_pct: 32.1, USG_pct: 15.1, OWS: -1.2, DWS: 0.3, WS: -0.9, WS40: -0.089, MIN_pg: 15.4, PTS_pg: 2.2, REB_pg: 1.3, AST_pg: 2, STL_pg: 0.8, BLK_pg: 0, TOV_pg: 1.5, FG_pct: 0.273, FG3_pct: 0.136, FT_pct: 0.647 },
      2000: { team: 'POR', age: 24, G: 5, MP: 35, MP_pct: 0.027, PER: -4.9, TS_pct: 0, ThrPAr: 0, FTr: 0, ORB_pct: 7.8, TRB_pct: 7.9, AST_pct: 9.8, STL_pct: 3.2, BLK_pct: 0, TOV_pct: 75, USG_pct: 10.9, OWS: -0.2, DWS: 0, WS: -0.2, WS40: -0.245, MIN_pg: 7, PTS_pg: 0, REB_pg: 0.8, AST_pg: 0.4, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.000 },
    },
  },
  'williad01w': {
    id: 'williad01w',
    name: 'Adrian Williams-Strong',
    position: 'C-F',
    retired: true,
    seasons: {
      2000: { team: 'PHO', age: 23, G: 28, MP: 351, MP_pct: 0.273, PER: 9, TS_pct: 0.44, ThrPAr: 0, FTr: 0.528, ORB_pct: 9.7, TRB_pct: 14, AST_pct: 8.4, STL_pct: 2.3, BLK_pct: 1, TOV_pct: 24.6, USG_pct: 17.1, OWS: -0.4, DWS: 0.6, WS: 0.2, WS40: 0.024 },
      2001: { team: 'PHO', age: 24, G: 25, MP: 375, MP_pct: 0.291, PER: 6.5, TS_pct: 0.383, ThrPAr: 0, FTr: 0.248, ORB_pct: 7.2, TRB_pct: 13.1, AST_pct: 5.9, STL_pct: 2.3, BLK_pct: 1.1, TOV_pct: 21.3, USG_pct: 20.5, OWS: -1, DWS: 0.5, WS: -0.5, WS40: -0.058, MIN_pg: 20.3, PTS_pg: 3.4, REB_pg: 3.8, AST_pg: 1.2, STL_pg: 0.8, BLK_pg: 0.5, TOV_pg: 1.6, FG_pct: 0.328, FG3_pct: 0.162, FT_pct: 0.714 },
    },
  },
  'willibe01w': {
    id: 'willibe01w',
    name: 'Beverly Williams',
    position: 'G',
    retired: true,
    seasons: {
      2000: { team: 'IND', age: 34, G: 1, MP: 3, MP_pct: 0.002, PER: -13.2, TS_pct: null, ThrPAr: null, FTr: null, ORB_pct: 0, TRB_pct: 0, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: null, USG_pct: 0, OWS: 0, DWS: 0, WS: 0, WS40: -0.031 },
    },
  },
  'willide01w': {
    id: 'willide01w',
    name: 'Debra Williams',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CHA', age: 24, G: 10, MP: 116, MP_pct: 0.104, PER: 4.4, TS_pct: 0.308, ThrPAr: 0.419, FTr: 0.047, ORB_pct: 3.3, TRB_pct: 7, AST_pct: 14.2, STL_pct: 1, BLK_pct: 0, TOV_pct: 12, USG_pct: 20.4, OWS: -0.2, DWS: 0.1, WS: -0.2, WS40: -0.062 },
    },
  },
  'williki01w': {
    id: 'williki01w',
    name: 'Kim Williams',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'UTA', age: 22, G: 28, MP: 608, MP_pct: 0.538, PER: 14.2, TS_pct: 0.448, ThrPAr: 0.148, FTr: 0.231, ORB_pct: 6.2, TRB_pct: 7.7, AST_pct: 22.2, STL_pct: 3.3, BLK_pct: 0.9, TOV_pct: 18.4, USG_pct: 22.7, OWS: 0.4, DWS: 0, WS: 0.4, WS40: 0.026 },
      1998: { team: 'UTA', age: 23, G: 30, MP: 543, MP_pct: 0.449, PER: 13.6, TS_pct: 0.464, ThrPAr: 0.126, FTr: 0.22, ORB_pct: 5.4, TRB_pct: 6.4, AST_pct: 17.9, STL_pct: 4.2, BLK_pct: 0.9, TOV_pct: 21.3, USG_pct: 26.1, OWS: -0.4, DWS: 0.3, WS: -0.1, WS40: -0.008 },
    },
  },
  'willina01w': {
    id: 'willina01w',
    name: 'Natalie Williams',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'UTA', age: 28, G: 28, MP: 954, MP_pct: 0.734, PER: 24.8, TS_pct: 0.585, ThrPAr: 0.006, FTr: 0.55, ORB_pct: 14.8, TRB_pct: 17.2, AST_pct: 5.7, STL_pct: 2.2, BLK_pct: 2, TOV_pct: 13.6, USG_pct: 24, OWS: 4.4, DWS: 0.6, WS: 4.9, WS40: 0.207, MIN_pg: 34.1, PTS_pg: 18.0, REB_pg: 9.2, AST_pg: 0.9, STL_pg: 1.4, BLK_pg: 0.8, FG_pct: 0.519, FG3_pct: 0.000, FT_pct: 0.754 },
      2000: { team: 'UTA', age: 29, G: 29, MP: 1039, MP_pct: 0.812, PER: 25.7, TS_pct: 0.583, ThrPAr: 0.014, FTr: 0.625, ORB_pct: 17.2, TRB_pct: 20.8, AST_pct: 9.9, STL_pct: 1.8, BLK_pct: 1.5, TOV_pct: 14.5, USG_pct: 24.1, OWS: 5.4, DWS: 1, WS: 6.4, WS40: 0.246, MIN_pg: 35.8, PTS_pg: 18.7, REB_pg: 11.6, AST_pg: 1.8, STL_pg: 1.2, BLK_pg: 0.6, FG_pct: 0.490, FG3_pct: 0.600, FT_pct: 0.798 },
      2001: { team: 'UTA', age: 30, G: 31, MP: 1064, MP_pct: 0.822, PER: 21.3, TS_pct: 0.539, ThrPAr: 0.011, FTr: 0.381, ORB_pct: 14.6, TRB_pct: 18.3, AST_pct: 11.1, STL_pct: 2.2, BLK_pct: 0.8, TOV_pct: 14.7, USG_pct: 22, OWS: 3.6, DWS: 1.5, WS: 5.1, WS40: 0.193, MIN_pg: 34.3, PTS_pg: 14.2, REB_pg: 9.9, AST_pg: 1.8, STL_pg: 1.3, BLK_pg: 0.3, FG_pct: 0.490, FG3_pct: 0.000, FT_pct: 0.729 },
      2002: { team: 'UTA', age: 31, G: 31, MIN_pg: 32.5, PTS_pg: 11.3, REB_pg: 8.2, AST_pg: 1.2, STL_pg: 1.2, BLK_pg: 0.5, FG_pct: 0.435, FG3_pct: 0.417, FT_pct: 0.742 },
      2003: { team: 'IND', age: 32, G: 34, MIN_pg: 31.0, PTS_pg: 13.4, REB_pg: 7.5, AST_pg: 1.4, STL_pg: 1.3, BLK_pg: 0.6, FG_pct: 0.485, FG3_pct: 0.000, FT_pct: 0.709 },
      2004: { team: 'IND', age: 33, G: 34, MIN_pg: 28.1, PTS_pg: 10.3, REB_pg: 6.9, AST_pg: 1.8, STL_pg: 1.2, BLK_pg: 0.7, FG_pct: 0.454, FG3_pct: 0.000, FT_pct: 0.697 },
      2005: { team: 'IND', age: 34, G: 34, MIN_pg: 23.6, PTS_pg: 7.4, REB_pg: 5.5, AST_pg: 0.9, STL_pg: 1.0, BLK_pg: 0.4, FG_pct: 0.415, FG3_pct: 0.000, FT_pct: 0.672 },
    },
  },
  'williri01w': {
    id: 'williri01w',
    name: 'Rita Williams',
    position: 'G',
    retired: true,
    seasons: {
      1998: { team: 'WAS', age: 22, G: 30, MP: 712, MP_pct: 0.591, PER: 8.9, TS_pct: 0.43, ThrPAr: 0.433, FTr: 0.472, ORB_pct: 2.1, TRB_pct: 5.9, AST_pct: 17.9, STL_pct: 4.6, BLK_pct: 0.2, TOV_pct: 31, USG_pct: 13.8, OWS: -1, DWS: 0.2, WS: -0.9, WS40: -0.048, MIN_pg: 8.1, PTS_pg: 1.9, REB_pg: 0.9, AST_pg: 1.6, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 1.3, FG_pct: 0.294, FG3_pct: 0.238, FT_pct: 0.692 },
      1999: { team: 'WAS', age: 23, G: 31, MP: 312, MP_pct: 0.241, PER: 17.4, TS_pct: 0.668, ThrPAr: 0.548, FTr: 0.581, ORB_pct: 3.1, TRB_pct: 7.6, AST_pct: 19.8, STL_pct: 3.8, BLK_pct: 0.3, TOV_pct: 25, USG_pct: 16.2, OWS: 0.8, DWS: 0.4, WS: 1.3, WS40: 0.163, MIN_pg: 4.1, PTS_pg: 0.6, REB_pg: 0.4, AST_pg: 0.8, STL_pg: 0.5, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.278, FG3_pct: 0.000, FT_pct: 1.000 },
      2000: { team: 'IND', age: 24, G: 32, MP: 1014, MP_pct: 0.789, PER: 17.6, TS_pct: 0.547, ThrPAr: 0.478, FTr: 0.394, ORB_pct: 3, TRB_pct: 6.4, AST_pct: 19.6, STL_pct: 4.3, BLK_pct: 0.3, TOV_pct: 17.7, USG_pct: 19, OWS: 2.3, DWS: 0.9, WS: 3.2, WS40: 0.127, MIN_pg: 9.4, PTS_pg: 1.7, REB_pg: 0.8, AST_pg: 1, STL_pg: 0.6, BLK_pg: 0, TOV_pg: 0.8, FG_pct: 0.364, FG3_pct: 0.200, FT_pct: 0.800 },
      2001: { team: 'IND', age: 25, G: 32, MP: 1042, MP_pct: 0.805, PER: 18.2, TS_pct: 0.543, ThrPAr: 0.372, FTr: 0.444, ORB_pct: 3.3, TRB_pct: 6.8, AST_pct: 22.9, STL_pct: 4, BLK_pct: 0.9, TOV_pct: 22.2, USG_pct: 21.7, OWS: 2.1, DWS: 0.7, WS: 2.8, WS40: 0.107, MIN_pg: 31.7, PTS_pg: 5.3, REB_pg: 3.7, AST_pg: 3.8, STL_pg: 2.2, BLK_pg: 0.3, TOV_pg: 1.8, FG_pct: 0.356, FG3_pct: 0.358, FT_pct: 0.636 },
    },
  },
  'willita01w': {
    id: 'willita01w',
    name: 'Tara Williams',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'PHO', age: 22, G: 12, MP: 84, MP_pct: 0.074, PER: 13.8, TS_pct: 0.474, ThrPAr: 0.282, FTr: 0, ORB_pct: 1.4, TRB_pct: 5.9, AST_pct: 9.1, STL_pct: 1.9, BLK_pct: 0, TOV_pct: 9.3, USG_pct: 23, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.11 },
      2000: { team: 'POR', age: 25, G: 26, MP: 174, MP_pct: 0.133, PER: 17.7, TS_pct: 0.552, ThrPAr: 0.594, FTr: 0.116, ORB_pct: 3.9, TRB_pct: 6.7, AST_pct: 18.4, STL_pct: 2.6, BLK_pct: 1.1, TOV_pct: 12.1, USG_pct: 22.7, OWS: 0.5, DWS: 0.2, WS: 0.6, WS40: 0.141 },
      2001: { G: 4, MIN_pg: 2.3, PTS_pg: 1, REB_pg: 1, AST_pg: 0, STL_pg: 0, BLK_pg: 0.3, TOV_pg: 0.5, FG_pct: 0.500, FT_pct: 1.000 },
    },
  },
  'williwe01w': {
    id: 'williwe01w',
    name: 'Wendi Willits',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'LAS', age: 22, G: 13, MP: 47, MP_pct: 0.036, PER: 11.2, TS_pct: 0.391, ThrPAr: 0.65, FTr: 0.2, ORB_pct: 2.8, TRB_pct: 6.8, AST_pct: 11, STL_pct: 1.2, BLK_pct: 0, TOV_pct: 8.4, USG_pct: 24, OWS: 0, DWS: 0, WS: 0, WS40: 0.031 },
      1997: { G: 28, MIN_pg: 21.7, PTS_pg: 8.1, REB_pg: 2.9, AST_pg: 2.1, STL_pg: 1.4, BLK_pg: 0.3, TOV_pg: 2, FG_pct: 0.384, FG3_pct: 0.265, FT_pct: 0.774 },
      1998: { G: 30, MIN_pg: 18.1, PTS_pg: 7.6, REB_pg: 1.9, AST_pg: 1.5, STL_pg: 1.4, BLK_pg: 0.2, TOV_pg: 2.2, FG_pct: 0.408, FG3_pct: 0.321, FT_pct: 0.735 },
    },
  },
  'wilsoam01w': {
    id: 'wilsoam01w',
    name: 'Amanda Wilson',
    position: 'F',
    retired: true,
    seasons: {
      1999: { team: 'PHO', age: 22, G: 12, MP: 34, MP_pct: 0.027, PER: 15.8, TS_pct: 0.45, ThrPAr: 0.417, FTr: 0.25, ORB_pct: 14.7, TRB_pct: 11.2, AST_pct: 12.3, STL_pct: 1.7, BLK_pct: 2.5, TOV_pct: 13.1, USG_pct: 21.6, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.102 },
      2000: { team: 'PHO', age: 23, G: 3, MP: 9, MP_pct: 0.007, PER: 6.1, TS_pct: 0.362, ThrPAr: 0, FTr: 4, ORB_pct: 0, TRB_pct: 7.7, AST_pct: 17.8, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 15.6, OWS: 0, DWS: 0, WS: 0, WS40: 0.062 },
    },
  },
  'witheso01w': {
    id: 'witheso01w',
    name: 'Sophia Witherspoon',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'NYL', age: 27, G: 28, MP: 867, MP_pct: 0.764, PER: 18.3, TS_pct: 0.517, ThrPAr: 0.365, FTr: 0.322, ORB_pct: 4.3, TRB_pct: 5.9, AST_pct: 16, STL_pct: 3, BLK_pct: 0.7, TOV_pct: 16.4, USG_pct: 24.5, OWS: 2.3, DWS: 1.4, WS: 3.6, WS40: 0.168, MIN_pg: 31, PTS_pg: 14.5, REB_pg: 3, AST_pg: 2.3, STL_pg: 1.8, BLK_pg: 0.3, TOV_pg: 2.8, FG_pct: 0.406, FG3_pct: 0.349, FT_pct: 0.748 },
      1998: { team: 'NYL', age: 28, G: 30, MP: 898, MP_pct: 0.742, PER: 17.1, TS_pct: 0.503, ThrPAr: 0.267, FTr: 0.326, ORB_pct: 4.7, TRB_pct: 6.7, AST_pct: 13.6, STL_pct: 2.5, BLK_pct: 0.4, TOV_pct: 15.1, USG_pct: 25.4, OWS: 1.9, DWS: 1.2, WS: 3.1, WS40: 0.138, MIN_pg: 29.9, PTS_pg: 13.8, REB_pg: 3, AST_pg: 1.9, STL_pg: 1.3, BLK_pg: 0.1, TOV_pg: 2.4, FG_pct: 0.401, FG3_pct: 0.344, FT_pct: 0.786 },
      1999: { team: 'NYL', age: 29, G: 32, MP: 581, MP_pct: 0.445, PER: 16.6, TS_pct: 0.492, ThrPAr: 0.318, FTr: 0.282, ORB_pct: 4.5, TRB_pct: 5.5, AST_pct: 14.3, STL_pct: 3.3, BLK_pct: 0.3, TOV_pct: 14.8, USG_pct: 27.6, OWS: 0.6, DWS: 0.9, WS: 1.5, WS40: 0.104, MIN_pg: 18.2, PTS_pg: 8.5, REB_pg: 1.5, AST_pg: 1.2, STL_pg: 1, BLK_pg: 0.1, TOV_pg: 1.5, FG_pct: 0.396, FG3_pct: 0.359, FT_pct: 0.710 },
      2000: { team: 'POR', age: 30, G: 32, MP: 1061, MP_pct: 0.813, PER: 17.3, TS_pct: 0.517, ThrPAr: 0.357, FTr: 0.322, ORB_pct: 3, TRB_pct: 6.8, AST_pct: 15.3, STL_pct: 2, BLK_pct: 0.7, TOV_pct: 14.5, USG_pct: 27.4, OWS: 2.2, DWS: 0.7, WS: 3, WS40: 0.112, MIN_pg: 33.2, PTS_pg: 16.8, REB_pg: 3.3, AST_pg: 2.1, STL_pg: 1.2, BLK_pg: 0.3, TOV_pg: 2.8, FG_pct: 0.384, FG3_pct: 0.368, FT_pct: 0.871 },
      2001: { team: 'POR', age: 31, G: 31, MP: 862, MP_pct: 0.661, PER: 13.4, TS_pct: 0.461, ThrPAr: 0.508, FTr: 0.296, ORB_pct: 2.8, TRB_pct: 5.3, AST_pct: 14.5, STL_pct: 2, BLK_pct: 0.8, TOV_pct: 15.1, USG_pct: 27.1, OWS: 0.3, DWS: 0.4, WS: 0.7, WS40: 0.032, MIN_pg: 27.8, PTS_pg: 12, REB_pg: 2.4, AST_pg: 1.7, STL_pg: 1, BLK_pg: 0.3, TOV_pg: 2.3, FG_pct: 0.316, FG3_pct: 0.313, FT_pct: 0.849 },
    },
  },
  'wolteka01w': {
    id: 'wolteka01w',
    name: 'Kara Wolters',
    position: 'C',
    retired: true,
    seasons: {
      1999: { team: 'HOU', age: 23, G: 10, MP: 41, MP_pct: 0.032, PER: 13.1, TS_pct: 0.438, ThrPAr: 0, FTr: 0.923, ORB_pct: 17, TRB_pct: 19.2, AST_pct: 8.4, STL_pct: 1.4, BLK_pct: 0, TOV_pct: 14.1, USG_pct: 25.3, OWS: 0.1, DWS: 0.1, WS: 0.2, WS40: 0.166, MIN_pg: 16.2, PTS_pg: 4.9, REB_pg: 3.6, AST_pg: 0.7, STL_pg: 0.4, BLK_pg: 0.4, TOV_pg: 0.7, FG_pct: 0.479, FG3_pct: 0.143, FT_pct: 0.538 },
      2000: { team: 'IND', age: 24, G: 31, MP: 793, MP_pct: 0.617, PER: 20.9, TS_pct: 0.601, ThrPAr: 0, FTr: 0.379, ORB_pct: 8.1, TRB_pct: 14.1, AST_pct: 11.4, STL_pct: 0.9, BLK_pct: 5.3, TOV_pct: 19.2, USG_pct: 23.7, OWS: 2.1, DWS: 0.6, WS: 2.7, WS40: 0.137, MIN_pg: 26.4, PTS_pg: 7.6, REB_pg: 4.8, AST_pg: 2.1, STL_pg: 0.7, BLK_pg: 0.7, TOV_pg: 1.6, FG_pct: 0.450, FG3_pct: 0.211, FT_pct: 0.702 },
      2001: { team: 'SAC', age: 25, G: 31, MP: 378, MP_pct: 0.29, PER: 15.3, TS_pct: 0.511, ThrPAr: 0, FTr: 0.231, ORB_pct: 7, TRB_pct: 12.2, AST_pct: 9.5, STL_pct: 0.6, BLK_pct: 5.4, TOV_pct: 18.3, USG_pct: 22.8, OWS: 0.4, DWS: 0.6, WS: 1, WS40: 0.106, MIN_pg: 26.9, PTS_pg: 5.6, REB_pg: 7.7, AST_pg: 1.4, STL_pg: 0.6, BLK_pg: 1.1, TOV_pg: 1.2, FG_pct: 0.428, FG3_pct: 0.417, FT_pct: 0.825 },
    },
  },
  'wolvean01w': {
    id: 'wolvean01w',
    name: 'Angelina Wolvert',
    position: 'F-C',
    retired: true,
    seasons: {
      2001: { team: 'CLE', age: 22, G: 1, MP: 5, MP_pct: 0.004, PER: 9.6, TS_pct: 0.333, ThrPAr: 0, FTr: 0, ORB_pct: 28.8, TRB_pct: 13.9, AST_pct: 0, STL_pct: 0, BLK_pct: 0, TOV_pct: 0, USG_pct: 31.6, OWS: 0, DWS: 0, WS: 0, WS40: 0.031 },
    },
  },
  'woodaly01w': {
    id: 'woodaly01w',
    name: 'Lynette Woodard',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'CLE', age: 37, G: 28, MP: 712, MP_pct: 0.627, PER: 14.5, TS_pct: 0.441, ThrPAr: 0.032, FTr: 0.294, ORB_pct: 7.1, TRB_pct: 10.5, AST_pct: 18.2, STL_pct: 3.5, BLK_pct: 1.2, TOV_pct: 21.9, USG_pct: 20.6, OWS: 0, DWS: 1.1, WS: 1.1, WS40: 0.062, MIN_pg: 23.4, PTS_pg: 8.7, REB_pg: 6.9, AST_pg: 1.7, STL_pg: 1.4, BLK_pg: 0.3, TOV_pg: 2.4, FG_pct: 0.459, FG3_pct: 0.200, FT_pct: 0.739 },
      1998: { team: 'DET', age: 38, G: 27, MP: 383, MP_pct: 0.319, PER: 11.1, TS_pct: 0.429, ThrPAr: 0, FTr: 0.43, ORB_pct: 9.6, TRB_pct: 10.2, AST_pct: 10.5, STL_pct: 3.1, BLK_pct: 0.6, TOV_pct: 21.9, USG_pct: 16.8, OWS: -0.1, DWS: 0.6, WS: 0.5, WS40: 0.049 },
      1999: { G: 32, MIN_pg: 22, PTS_pg: 9.2, REB_pg: 5.3, AST_pg: 1, STL_pg: 1.1, BLK_pg: 0.2, TOV_pg: 1.9, FG_pct: 0.537, FG3_pct: 0.000, FT_pct: 0.565 },
    },
  },
  'wooslti01w': {
    id: 'wooslti01w',
    name: 'Tiffany Woosley',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'HOU', age: 24, G: 26, MP: 397, MP_pct: 0.351, PER: 7.3, TS_pct: 0.415, ThrPAr: 0.568, FTr: 0.091, ORB_pct: 2.6, TRB_pct: 4.7, AST_pct: 13.4, STL_pct: 2.5, BLK_pct: 0.2, TOV_pct: 24.7, USG_pct: 14.3, OWS: -0.2, DWS: 0.3, WS: 0.1, WS40: 0.007 },
      1998: { team: 'HOU', age: 25, G: 18, MP: 96, MP_pct: 0.079, PER: 7, TS_pct: 0.422, ThrPAr: 0.522, FTr: 0.304, ORB_pct: 4.1, TRB_pct: 4.7, AST_pct: 16.1, STL_pct: 4.7, BLK_pct: 0, TOV_pct: 33.3, USG_pct: 19.4, OWS: -0.2, DWS: 0.2, WS: 0, WS40: -0.011 },
    },
  },
  'wyckobr01w': {
    id: 'wyckobr01w',
    name: 'Brooke Wyckoff',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'ORL', age: 21, G: 32, MP: 648, MP_pct: 0.502, PER: 7.2, TS_pct: 0.393, ThrPAr: 0.296, FTr: 0.224, ORB_pct: 9.4, TRB_pct: 12.5, AST_pct: 10.7, STL_pct: 2.3, BLK_pct: 2.1, TOV_pct: 26.7, USG_pct: 13.8, OWS: -0.7, DWS: 0.5, WS: -0.2, WS40: -0.011, MIN_pg: 12.2, PTS_pg: 3.8, REB_pg: 2.8, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0.1, TOV_pg: 0.9, FG_pct: 0.368, FG3_pct: 0.000, FT_pct: 0.673 },
      2002: { G: 6, MIN_pg: 6.3, PTS_pg: 1.3, REB_pg: 1, AST_pg: 0.3, STL_pg: 0.2, BLK_pg: 0, TOV_pg: 1, FG_pct: 0.167, FT_pct: 0.750 },
    },
  },
  'wynneda01w': {
    id: 'wynneda01w',
    name: 'Dana Wynne',
    position: 'F',
    retired: true,
    seasons: {
      2001: { team: 'SAC', age: 26, G: 1, MP: 3, MP_pct: 0.002, PER: 51.7, TS_pct: 1.136, ThrPAr: null, FTr: null, ORB_pct: 42, TRB_pct: 20.7, AST_pct: 0, STL_pct: 0, BLK_pct: 27.1, TOV_pct: 0, USG_pct: 14, OWS: 0.1, DWS: 0, WS: 0.1, WS40: 0.999 },
    },
  },
  'yasenco01w': {
    id: 'yasenco01w',
    name: 'Corissa Yasen',
    position: 'G',
    retired: true,
    seasons: {
      1997: { team: 'SAC', age: 23, G: 19, MP: 188, MP_pct: 0.166, PER: 11.1, TS_pct: 0.417, ThrPAr: 0.018, FTr: 0.211, ORB_pct: 7.8, TRB_pct: 6.7, AST_pct: 6.4, STL_pct: 5.1, BLK_pct: 0.8, TOV_pct: 20.4, USG_pct: 18.6, OWS: -0.2, DWS: 0.1, WS: -0.1, WS40: -0.022, MIN_pg: 15.3, PTS_pg: 2.9, REB_pg: 1.1, AST_pg: 1.1, STL_pg: 0.7, BLK_pg: 0, TOV_pg: 1.2, FG_pct: 0.330, FG3_pct: 0.320, FT_pct: 0.250 },
      1998: { G: 18, MIN_pg: 5.3, PTS_pg: 1.2, REB_pg: 0.4, AST_pg: 0.5, STL_pg: 0.4, BLK_pg: 0, TOV_pg: 0.7, FG_pct: 0.304, FG3_pct: 0.250, FT_pct: 0.714 },
    },
  },
  'youngca01w': {
    id: 'youngca01w',
    name: 'Carolyn Young',
    position: 'G',
    retired: true,
    seasons: {
      2001: { team: 'POR', age: 31, G: 23, MP: 279, MP_pct: 0.214, PER: 13.2, TS_pct: 0.481, ThrPAr: 0.343, FTr: 0.374, ORB_pct: 4.4, TRB_pct: 7.6, AST_pct: 12.5, STL_pct: 2.9, BLK_pct: 0.3, TOV_pct: 19, USG_pct: 25, OWS: 0, DWS: 0.3, WS: 0.2, WS40: 0.034 },
    },
  },
  'zakalok01w': {
    id: 'zakalok01w',
    name: 'Oksana Zakaluzhnaya',
    position: 'C',
    retired: true,
    seasons: {
      2000: { team: 'DET', age: 22, G: 23, MP: 258, MP_pct: 0.201, PER: 12.6, TS_pct: 0.572, ThrPAr: 0.096, FTr: 0.151, ORB_pct: 7.6, TRB_pct: 11.7, AST_pct: 1.5, STL_pct: 1, BLK_pct: 4.1, TOV_pct: 19.6, USG_pct: 17.1, OWS: 0.3, DWS: 0.2, WS: 0.5, WS40: 0.071 },
    },
  },
  'zhengha01w': {
    id: 'zhengha01w',
    name: 'Haixia Zheng',
    position: 'C',
    retired: true,
    seasons: {
      1997: { team: 'LAS', age: 30, G: 28, MP: 557, MP_pct: 0.486, PER: 20.2, TS_pct: 0.635, ThrPAr: 0, FTr: 0.331, ORB_pct: 7.4, TRB_pct: 13.4, AST_pct: 6.2, STL_pct: 1, BLK_pct: 2.8, TOV_pct: 18.4, USG_pct: 19.9, OWS: 2, DWS: 0.8, WS: 2.7, WS40: 0.195, MIN_pg: 9.9, PTS_pg: 2.7, REB_pg: 1.1, AST_pg: 0.3, STL_pg: 0.9, BLK_pg: 0.1, TOV_pg: 0.8, FG_pct: 0.404, FG3_pct: 0.000, FT_pct: 0.500 },
      1998: { team: 'LAS', age: 31, G: 6, MP: 98, MP_pct: 0.081, PER: 21.1, TS_pct: 0.641, ThrPAr: 0, FTr: 0.219, ORB_pct: 9.8, TRB_pct: 15.8, AST_pct: 6.7, STL_pct: 0, BLK_pct: 0.8, TOV_pct: 14.6, USG_pct: 18.8, OWS: 0.4, DWS: 0.1, WS: 0.5, WS40: 0.193 },
    },
  },
};

/**
 * Detect a bulk-legacy BBRef id. They look like 'staleda01w' — lowercase letters with a numeric
 * tail and a trailing 'w'. Old synthetic legacy ids contain hyphens; ESPN ids are pure integers.
 */
function isBulkLegacyId(id) {
  return typeof id === 'string' && /^[a-z]{2,8}\d{2}w$/.test(id);
}

/**
 * Retired synthetic ids (lastname-firstname-birthyear) used by the deleted legacyPlayerStats.js
 * map. Kept for backward-compat so old shared URLs resolve. Resolution path: api.js translates
 * the synthetic id to the BBRef id before any data lookup.
 */
const LEGACY_ID_REDIRECTS = Object.freeze({
  'cooper-cynthia-1963':   'coopecy01w',
  'swoopes-sheryl-1971':   'swoopsh01w',
  'leslie-lisa-1972':      'leslili01w',
  'jackson-lauren-1981':   'jacksla01w',
  'griffith-yolanda-1970': 'griffyo01w',
  'thompson-tina-1975':    'thompti01w',
  'dixon-tamecka-1975':    'dixonta01w',
  'wicks-sue-1966':        'wickssu01w',
});

/**
 * Translate a retired synthetic id to its BBRef counterpart. Returns the id unchanged if it
 * isn't in the redirect map. Use this at the entry of any /api/players/:id-style route so a
 * single check covers profile, detailed-stats, and graded-report.
 */
function resolveLegacyId(id) {
  return LEGACY_ID_REDIRECTS[id] ?? id;
}

function getBulkLegacyPlayer(id) {
  return LEGACY_PLAYERS_BULK[id] ?? null;
}

/**
 * Substring case-insensitive name search. Returns search-shaped hits with legacy + dataSource flags
 * so the /api/search response can mix them in alongside active and ESPN-retired results.
 * Each hit carries the BBRef player_ID — the same id /api/players/:id will resolve.
 */
function searchBulkLegacyPlayers(q) {
  const needle = String(q || '').toLowerCase().trim();
  if (!needle) return [];
  return Object.values(LEGACY_PLAYERS_BULK)
    .filter(p => p.name.toLowerCase().includes(needle))
    .map(p => ({
      id:         p.id,
      name:       p.name,
      position:   p.position,
      headshot:   null,
      retired:    true,
      legacy:     true,
      dataSource: 'legacy-bulk',
    }));
}

/**
 * Build a player profile shaped like /api/players/:id returns for ESPN-backed players.
 * teamName comes from the most-recent season's team abbreviation (left as the BBRef code;
 * api.js resolves the display name via getBulkLegacyTeamDisplay).
 */
function buildBulkLegacyProfile(player) {
  const years = Object.keys(player.seasons).map(Number).sort();
  const lastYear = years.length ? years[years.length - 1] : null;
  const lastSeason = lastYear ? player.seasons[lastYear] : null;
  return {
    id:           player.id,
    name:         player.name,
    position:     player.position,
    positionName: player.position,
    jersey:       null,
    headshot:     null,
    height:       null,
    weight:       null,
    age:          lastSeason?.age ?? null,
    college:      null,
    birthPlace:   null,
    experience:   years.length,
    teamId:       null,                                  // resolved per-season; profile has no single team
    teamName:     lastSeason?.team ?? null,              // BBRef tricode — caller may want to map
    teamAbbr:     lastSeason?.team ?? null,
    careerYears:  years,
    retired:      true,
    dataSource:   'legacy-bulk',
  };
}

/**
 * Per-game headers — match the ESPN/legacy detailed-stats table shape so the same client renderer
 * works for both. Only the fields Wikipedia / hand-curated data provide are non-null.
 */
const BULK_PG_HEADERS = Object.freeze([
  'SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'GS', 'MIN',
  'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT',
  'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB',
  'AST', 'STL', 'BLK', 'TOV', 'PF', 'PTS',
]);

// One season's per-game line as an array aligned to BULK_PG_HEADERS.
// Returns null when the season has no per-game stats at all (advanced-only row).
function bulkPgRow(year, s) {
  if (s.PTS_pg == null && s.REB_pg == null && s.AST_pg == null) return null;
  return [
    String(year),
    s.team ?? null,
    s.G ?? null,
    null,                          // GS — not tracked
    s.MIN_pg ?? null,
    null, null, s.FG_pct ?? null,  // FGM/FGA not tracked, only %
    null, null, s.FG3_pct ?? null,
    null, null, s.FT_pct ?? null,
    s.OREB_pg ?? null, s.DREB_pg ?? null, s.REB_pg ?? null,
    s.AST_pg ?? null, s.STL_pg ?? null, s.BLK_pg ?? null,
    s.TOV_pg ?? null, null,        // PF not tracked
    s.PTS_pg ?? null,
  ];
}

// GP-weighted career averages across rows that have per-game data. Skips advanced-only rows.
function buildBulkPgCareerRow(player) {
  const seasons = Object.values(player.seasons).filter(s => s.PTS_pg != null || s.REB_pg != null || s.AST_pg != null);
  const totalGp = seasons.reduce((sum, s) => sum + (s.G ?? 0), 0);
  if (totalGp === 0) return null;

  const wAvg = (key) => {
    let sum = 0; let weight = 0;
    for (const s of seasons) {
      const v = s[key]; const g = s.G ?? 0;
      if (v == null || g === 0) continue;
      sum += v * g; weight += g;
    }
    return weight ? Number((sum / weight).toFixed(3)) : null;
  };

  return [
    'Career', '', totalGp, null, wAvg('MIN_pg'),
    null, null, wAvg('FG_pct'),
    null, null, wAvg('FG3_pct'),
    null, null, wAvg('FT_pct'),
    wAvg('OREB_pg'), wAvg('DREB_pg'), wAvg('REB_pg'),
    wAvg('AST_pg'), wAvg('STL_pg'), wAvg('BLK_pg'),
    wAvg('TOV_pg'), null,
    wAvg('PTS_pg'),
  ];
}

/**
 * Build the detailed-stats payload for a bulk-legacy player. Returns both per-game and advanced
 * splits when present. Per-game rows are emitted for any season with PTS_pg/REB_pg/AST_pg set
 * (hand-curated legends — and any other player Wikipedia enrichment populates). Advanced rows
 * are emitted for any season with PER/WS data (1997-2001 CSV coverage). The two splits may
 * cover different year sets — e.g., a player's 2002+ seasons are per-game-only.
 *
 * advancedOnly stays true only when no per-game data exists, so the frontend can hide the
 * per-game tab in that case.
 */
function buildBulkLegacyDetailedStats(player) {
  const years = Object.keys(player.seasons).map(Number).sort();

  // Advanced rows — emitted only when PER is present (advanced-only or merged season).
  const advRows = years
    .filter(y => player.seasons[y].PER != null)
    .map(y => {
      const s = player.seasons[y];
      return {
        year:    String(y),
        team:    s.team,
        age:     s.age,
        G:       s.G,
        MP:      s.MP,
        PER:     s.PER,
        TS_pct:  s.TS_pct,
        ORB_pct: s.ORB_pct,
        TRB_pct: s.TRB_pct,
        AST_pct: s.AST_pct,
        STL_pct: s.STL_pct,
        BLK_pct: s.BLK_pct,
        TOV_pct: s.TOV_pct,
        USG_pct: s.USG_pct,
        OWS:     s.OWS,
        DWS:     s.DWS,
        WS:      s.WS,
        WS40:    s.WS40,
      };
    });

  // Per-game rows — emitted for any season with at least one per-game stat.
  const pgRows = years
    .map(y => bulkPgRow(y, player.seasons[y]))
    .filter(Boolean);
  const careerPgRow = buildBulkPgCareerRow(player);

  const pgTable     = pgRows.length     ? toColumnTable({ headers: BULK_PG_HEADERS, rows: pgRows }) : null;
  const pgCareerTbl = careerPgRow       ? toColumnTable({ headers: BULK_PG_HEADERS, rows: [careerPgRow] }) : null;

  return {
    source:        'legacy-bulk',
    advancedOnly:  !pgTable,                                     // false when per-game data exists
    dataSource:    'legacy-bulk',
    perGame: {
      regular:       pgTable,
      regularCareer: pgCareerTbl,
      playoffs:      null,
      playoffCareer: null,
    },
    totals:        { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per36:         { regular: null, regularCareer: null, playoffs: null, playoffCareer: null },
    per100:        null,
    advanced:      { regular: advRows.length ? advRows : null, playoffs: null },
  };
}

module.exports = {
  LEGACY_PLAYERS_BULK,
  LEGACY_ID_REDIRECTS,
  isBulkLegacyId,
  resolveLegacyId,
  getBulkLegacyPlayer,
  searchBulkLegacyPlayers,
  buildBulkLegacyProfile,
  buildBulkLegacyDetailedStats,
};
