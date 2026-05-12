// legacyTeamRosters.js — pre-2002 team rosters, keyed by BBRef tricode.
//
// Derived from the same CSV as legacyPlayerBulk.js. Each entry is the list of BBRef player_IDs
// that appear in the FiveThirtyEight stats CSV for that (team, year) tuple.
//
// Tricode mapping (BBREF_TO_ESPN): maps the BBRef tricode to ESPN's current team ID where the
// franchise still exists (e.g., DET → Detroit Shock's modern Dallas Wings (id 3)). Tricodes for
// franchises that folded use LEGACY_DEFUNCT_TEAMS instead — those resolve to synthetic ids like
// 'legacy-cleveland-rockers' so direct URLs work but no current /api/teams entry exists.
//
// Multi-team seasons: when a player played for both teams in a year (~16 cases in 1997-2001),
// they appear on BOTH rosters. This mirrors historical reality; the player's own profile
// records only the last team they played for that year.
//
// Generated 2026-05-12 from 1997-2001 CSV rows.

'use strict';

const LEGACY_TEAM_ROSTERS = {
  'CHA': {
    1997: ['artiska01w', 'bullevi01w', 'congran01w', 'hopsosu01w', 'levesni01w', 'mannish01w', 'mapprh01w', 'moorepe01w', 'stinsan01w', 'suberto01w', 'vukadmi01w', 'willide01w'],
    1998: ['bouchke01w', 'bullevi01w', 'chaseso01w', 'congran01w', 'johnspo01w', 'mannish01w', 'mapprh01w', 'paschti01w', 'reidtr01w', 'smithch01w', 'stinsan01w', 'suberto01w'],
    1999: ['bauerca01w', 'brazian01w', 'bullevi01w', 'chaseso01w', 'johnsni01w', 'mannish01w', 'mapprh01w', 'mccarst01w', 'reidtr01w', 'smithch01w', 'smithch02w', 'staleda01w', 'stinsan01w'],
    2000: ['bauerca01w', 'brazian01w', 'enissh01w', 'erbsu01w', 'hillec01w', 'johnsni01w', 'jonesla01w', 'mapprh01w', 'reidtr01w', 'smithch02w', 'staleda01w', 'stinsan01w', 'traviti01w'],
    2001: ['anderke01w', 'bristre01w', 'edwarto01w', 'enissh01w', 'erbsu01w', 'feastal01w', 'machacl01w', 'milleke01w', 'smithch02w', 'staleda01w', 'stinsan01w', 'suttota01w'],
  },
  'CLE': {
    1997: ['alberma01w', 'bouceje01w', 'braxtja01w', 'brownru01w', 'edwarmi01w', 'fijalis01w', 'johnsad01w', 'jonesme01w', 'maxwean01w', 'nemcoev01w', 'nichoti01w', 'woodaly01w'],
    1998: ['beviltu01w', 'blodgci01w', 'braxtja01w', 'brownru01w', 'edwarmi01w', 'fijalis01w', 'johnsad01w', 'jonesme01w', 'kostita01w', 'mcconsu01w', 'nemcoev01w', 'scottra01w'],
    1999: ['andrame01w', 'badertr01w', 'braxtja01w', 'brownru01w', 'burraal01w', 'edwarmi01w', 'hendetr01w', 'howarje01w', 'jollyke01w', 'jonesme01w', 'mcconsu01w', 'melvich01w', 'nemcoev01w', 'nygaava01w', 'widemja01w'],
    2000: ['andrame01w', 'badertr01w', 'barnead01w', 'brownru01w', 'darlihe01w', 'edwarmi01w', 'hallvi01w', 'johnspo01w', 'jonesme01w', 'mcconsu01w', 'melvich01w', 'nemcoev01w', 'wautean01w'],
    2001: ['andrame01w', 'badertr01w', 'barnead01w', 'brownru01w', 'darlihe01w', 'hallvi01w', 'johnspo01w', 'jonesme01w', 'melvich01w', 'nemcoev01w', 'rizzoje01w', 'sauerpa01w', 'taylope01w', 'wautean01w', 'wolvean01w'],
  },
  'DET': {
    1998: ['abrahta01w', 'bladerh01w', 'boydca01w', 'branzge01w', 'brcanra01w', 'brondsa01w', 'brownci01w', 'hamblan01w', 'hledeko01w', 'kausaan01w', 'spornra01w', 'udokamf01w', 'woodaly01w'],
    1999: ['azzije01w', 'boydca01w', 'brondsa01w', 'brownci01w', 'brownle01w', 'cantydo01w', 'guytowa01w', 'hledeko01w', 'ndiayas01w', 'nevescl01w', 'palmewe01w', 'scottol01w', 'spornra01w', 'torniel01w', 'whitiva01w'],
    2000: ['browned01w', 'cantydo01w', 'deforan01w', 'farriba01w', 'holmejo01w', 'jacksta02w', 'ndiayas01w', 'nevescl01w', 'palmewe01w', 'scottol01w', 'slaisma01w', 'torniel01w', 'zakalok01w'],
    2001: ['boydca01w', 'browned01w', 'cantydo01w', 'farriba01w', 'kingija01w', 'ndiayas01w', 'nevescl01w', 'nolande01w', 'palmewe01w', 'santoke01w', 'spornra01w', 'torniel01w'],
  },
  'HOU': {
    1997: ['arcaija01w', 'coopecy01w', 'gaypi01w', 'guytowa01w', 'harrifr01w', 'jacksta01w', 'mooreyo01w', 'perroki01w', 'pollica01w', 'swoopsh01w', 'thompti01w', 'wooslti01w'],
    1998: ['arcaija01w', 'bookeka01w', 'coopecy01w', 'guytowa01w', 'jacksta01w', 'lambmo01w', 'mooreyo01w', 'perroki01w', 'roberny01w', 'swoopsh01w', 'thompti01w', 'valdeam01w', 'wooslti01w'],
    1999: ['arcaija01w', 'coopecy01w', 'henniso01w', 'jacksta01w', 'lambmo01w', 'nikolmi01w', 'rizzoje01w', 'roberny01w', 'swoopsh01w', 'thompti01w', 'tzekopo01w', 'valdeam01w', 'wolteka01w'],
    2000: ['arcaija01w', 'coopecy01w', 'gibsoke01w', 'jacksta01w', 'johnsti01w', 'lambmo01w', 'rizzoje01w', 'shakiel01w', 'swoopsh01w', 'thompti01w', 'valdeam01w', 'washico01w'],
    2001: ['arcaija01w', 'gibsoke01w', 'hendene01w', 'jacksta01w', 'johnsti01w', 'lassiam01w', 'lewisty01w', 'shakiel01w', 'stafftr01w', 'thompti01w', 'washico01w'],
  },
  'IND': {
    2000: ['gaithka01w', 'gilmous01w', 'grubigo01w', 'harrido01w', 'maxwemo01w', 'mccarst01w', 'mcculda01w', 'quinnte01w', 'santoal01w', 'streiju01w', 'thompal01w', 'tremich01w', 'willibe01w', 'williri01w', 'wolteka01w'],
    2001: ['brazian01w', 'grubigo01w', 'hallvi01w', 'iveyni01w', 'malcona01w', 'maxwemo01w', 'mccarst01w', 'mcculda01w', 'schumke01w', 'scottol01w', 'streiju01w', 'thompal01w', 'williri01w'],
  },
  'LAS': {
    1997: ['burgehe01w', 'burgeli01w', 'charlda01w', 'colleka01w', 'dixonta01w', 'ganttr01w', 'gessiki01w', 'leslili01w', 'mabikmw01w', 'tolerpe01w', 'widemja01w', 'zhengha01w'],
    1998: ['alexaer01w', 'blueoc01w', 'colleka01w', 'dixonta01w', 'feastal01w', 'leslili01w', 'mabikmw01w', 'mcgeepa01w', 'reedmi01w', 'rycraeu01w', 'tolerpe01w', 'vanemal01w', 'widemja01w', 'zhengha01w'],
    1999: ['bjedoni01w', 'dixonta01w', 'feastal01w', 'figgsuk01w', 'frettla01w', 'grubigo01w', 'leslili01w', 'mabikmw01w', 'machacl01w', 'miltode01w', 'tolerpe01w'],
    2000: ['dixonta01w', 'feastal01w', 'figgsuk01w', 'frettla01w', 'grginve01w', 'leslili01w', 'mabikmw01w', 'machacl01w', 'mccrini01w', 'miltode01w', 'sauerpa01w'],
    2001: ['byearla01w', 'dixonta01w', 'figgsuk01w', 'grginve01w', 'leslili01w', 'levanni01w', 'mabikmw01w', 'mapprh01w', 'mccrini01w', 'miltode01w', 'williwe01w'],
  },
  'MIA': {
    2000: ['askamma01w', 'blackde01w', 'cassija01w', 'colleka01w', 'floremi01w', 'fordki01w', 'jonesja01w', 'kostita01w', 'mannish01w', 'owenssh01w', 'rasmukr01w', 'samsh01w', 'webbum01w'],
    2001: ['askamma01w', 'baranel01w', 'blackde01w', 'brondsa01w', 'brumfma01w', 'colleka01w', 'fordki01w', 'rasmukr01w', 'reidtr01w', 'rileyru01w', 'samsh01w', 'torrele01w'],
  },
  'MIN': {
    1999: ['barnead01w', 'burgean01w', 'edwarto01w', 'fallotr01w', 'folklkr01w', 'lloydan01w', 'potthan01w', 'reedbr01w', 'smithch03w', 'smithka01w', 'tateso01w'],
    2000: ['aycocan01w', 'brumfma01w', 'daleygr01w', 'dickeke01w', 'folklkr01w', 'lennobe01w', 'lloydan01w', 'martima01w', 'payeka01w', 'potthan01w', 'smithka01w', 'stiresh01w', 'tateso01w'],
    2001: ['abrossv01w', 'burseja01w', 'harrokr01w', 'lennobe01w', 'martima01w', 'payeka01w', 'perpeer01w', 'pridely01w', 'schwege01w', 'smithka01w', 'stiresh01w', 'vangomi01w', 'whitiva01w'],
  },
  'NYL': {
    1997: ['bladerh01w', 'crumpca01w', 'fordki01w', 'hamptky01w', 'johnsvi01w', 'lobore01w', 'perazja01w', 'tricetr01w', 'weathte01w', 'wickssu01w', 'witheso01w'],
    1998: ['branzal01w', 'cebriel01w', 'fordki01w', 'hamptky01w', 'johnsvi01w', 'lobore01w', 'thompal01w', 'tricetr01w', 'washico01w', 'weathte01w', 'wickssu01w', 'witheso01w'],
    1999: ['hammobe01w', 'hamptky01w', 'johnsvi01w', 'lacyve01w', 'lobore01w', 'robincr01w', 'vangomi01w', 'washico01w', 'weathte01w', 'whitmta01w', 'wickssu01w', 'witheso01w'],
    2000: ['bibbyje01w', 'ferrama01w', 'firsool01w', 'francde01w', 'hammobe01w', 'johnsvi01w', 'lacyve01w', 'mahonsh01w', 'phillta01w', 'robincr01w', 'weathte01w', 'whitmta01w', 'wickssu01w'],
    2001: ['amachma01w', 'coopeca01w', 'daleygr01w', 'fordst01w', 'hammobe01w', 'johnsvi01w', 'lazicka01w', 'lobore01w', 'nagyan01w', 'phillta01w', 'radunha01w', 'robincr01w', 'weathte01w', 'whitmta01w', 'wickssu01w'],
  },
  'ORL': {
    1999: ['congran01w', 'fordki01w', 'johnsad01w', 'johnssh01w', 'mcgheca01w', 'mcwilta01w', 'mooreyo01w', 'phillta01w', 'powelel01w', 'salesny01w', 'samsh01w', 'suberto01w'],
    2000: ['dossaci01w', 'gaydeco01w', 'hamzoro01w', 'hicksje01w', 'johnsad01w', 'johnssh01w', 'mccaiti01w', 'mcgheca01w', 'mcwilta01w', 'powelel01w', 'rolanja01w', 'salesny01w', 'smithla01w'],
    2001: ['alhalta01w', 'dossaci01w', 'douglka01w', 'hicksje01w', 'johnsja01w', 'johnssh01w', 'mccaiti01w', 'mcgheca01w', 'mcwilta01w', 'powelel01w', 'salesny01w', 'wyckobr01w'],
  },
  'PHO': {
    1997: ['ambermo01w', 'askamma01w', 'becenry01w', 'fosteto01w', 'gilloje01w', 'hagiwmi01w', 'jacksti01w', 'liebena01w', 'pettibr01w', 'timmsmi01w', 'tutermo01w', 'webbum01w', 'willita01w'],
    1998: ['askamma01w', 'brogami01w', 'fosteto01w', 'gilloje01w', 'hagiwmi01w', 'harrokr01w', 'jordapa01w', 'kukloan01w', 'pettibr01w', 'reedbr01w', 'stepama01w', 'timmsmi01w', 'webbum01w'],
    1999: ['askamma01w', 'aycocan01w', 'campbed01w', 'daviscl01w', 'fosteto01w', 'gilloje01w', 'harrili01w', 'harrokr01w', 'kukloan01w', 'langeme01w', 'pettibr01w', 'stepama01w', 'timmsmi01w', 'wilsoam01w'],
    2000: ['brogami01w', 'clearmi01w', 'edwarto01w', 'gilloje01w', 'harrili01w', 'headde01w', 'kubikni01w', 'pettibr01w', 'reedbr01w', 'sarenra01w', 'stepama01w', 'timmsmi01w', 'williad01w', 'wilsoam01w'],
    2001: ['clearmi01w', 'edwarto01w', 'fallotr01w', 'gilloje01w', 'harrili01w', 'hillec01w', 'korstil01w', 'kubikni01w', 'luckepa01w', 'moisead01w', 'pettibr01w', 'reedbr01w', 'saundja01w', 'stepama01w', 'timmsmi01w', 'tuvicsl01w', 'vealkr01w', 'williad01w'],
  },
  'POR': {
    2000: ['beviltu01w', 'burraal01w', 'crawlsy01w', 'marcimi01w', 'nygaava01w', 'pridely01w', 'thomast01w', 'vangomi01w', 'walkede01w', 'widemja01w', 'willita01w', 'witheso01w'],
    2001: ['barksla01w', 'beviltu01w', 'burraal01w', 'crawlsy01w', 'folklkr01w', 'jacksta02w', 'moweje01w', 'nygaava01w', 'stileja01w', 'thomast01w', 'walkede01w', 'witheso01w', 'youngca01w'],
  },
  'SAC': {
    1997: ['abrahta01w', 'angelyv01w', 'boltoru01w', 'byearla01w', 'clarkma01w', 'gordobr01w', 'gravede01w', 'hagiwmi01w', 'mcgeepa01w', 'mosleju01w', 'savasla01w', 'tremich01w', 'viglida01w', 'yasenco01w'],
    1998: ['barnead01w', 'barnequ01w', 'boltoru01w', 'burgeli01w', 'byearla01w', 'domonna01w', 'gordobr01w', 'groomla01w', 'johnsti01w', 'jordapa01w', 'penicti01w', 'pricefr01w', 'smithta01w', 'stephre01w'],
    1999: ['blodgci01w', 'boltoru01w', 'burgehe02w', 'burgeli01w', 'byearla01w', 'griffyo01w', 'groomla01w', 'hollake01w', 'penicti01w', 'smithta01w', 'starbka01w'],
    2000: ['banchrh01w', 'blodgci01w', 'boltoru01w', 'burgeli01w', 'byearla01w', 'clinest01w', 'griffyo01w', 'groomla01w', 'hollake01w', 'penicti01w', 'smithta01w', 'stedika01w'],
    2001: ['blodgci01w', 'boltoru01w', 'campbed01w', 'clinest01w', 'frettla01w', 'griffyo01w', 'groomla01w', 'hollake01w', 'penicti01w', 'smithta01w', 'walsema01w', 'wolteka01w', 'wynneda01w'],
  },
  'SEA': {
    2000: ['aycocan01w', 'barnequ01w', 'campbed01w', 'edwarmi01w', 'edwarsi01w', 'garnean01w', 'henniso01w', 'hibbeka01w', 'lovelst01w', 'reddja01w', 'sampsch01w', 'smithch03w', 'threaro01w', 'vodicka01w'],
    2001: ['barnequ01w', 'edwarmi01w', 'edwarsi01w', 'henniso01w', 'jacksla01w', 'lovelst01w', 'marcimi01w', 'randase01w', 'reddja01w', 'santoal01w', 'smithch03w', 'stedika01w', 'vodicka01w'],
  },
  'UTA': {
    1997: ['baranel01w', 'bookeka01w', 'cartede01w', 'compame01w', 'groomla01w', 'headde01w', 'hicksje01w', 'kossgr01w', 'palmewe01w', 'reissta01w', 'scottra01w', 'williki01w'],
    1998: ['alexaer01w', 'badertr01w', 'baranel01w', 'dydekma01w', 'harrifr01w', 'headde01w', 'johnsla01w', 'palmewe01w', 'reissta01w', 'scottol01w', 'tremich01w', 'williki01w'],
    1999: ['badertr01w', 'baranel01w', 'blackde01w', 'brownci01w', 'campbmi01w', 'dydekma01w', 'goodsad01w', 'hledeko01w', 'ivanyda01w', 'johnsla01w', 'larakr01w', 'palmewe01w', 'scottol01w', 'tremich01w', 'willina01w'],
    2000: ['azzije01w', 'dydekma01w', 'fresest01w', 'gaithka01w', 'goodsad01w', 'herriam01w', 'hledeko01w', 'hopeky01w', 'ivanyda01w', 'johnsla01w', 'mulitna01w', 'rasmukr01w', 'starbka01w', 'willina01w'],
    2001: ['azzije01w', 'consuca01w', 'dickeke01w', 'dydekma01w', 'ferdima01w', 'goodsad01w', 'herriam01w', 'hledeko01w', 'johnsla01w', 'pavlimi01w', 'starbka01w', 'willina01w'],
  },
  'WAS': {
    1998: ['brownla01w', 'burgehe01w', 'cartede01w', 'chacoke01w', 'grahama01w', 'jacksan01w', 'jacksta01w', 'johnsle01w', 'mccrani01w', 'moorepe01w', 'pagemu01w', 'santoal01w', 'shulead01w', 'sobrale01w', 'williri01w'],
    1999: ['aldrima01w', 'enissh01w', 'holdsch01w', 'maxwemo01w', 'mccrani01w', 'moorepe01w', 'nagyan01w', 'owenhe01w', 'pagemu01w', 'roberny01w', 'santoal01w', 'stillva01w', 'whittje01w', 'williri01w'],
    2000: ['aldrima01w', 'anderke01w', 'bullevi01w', 'campbmi01w', 'cunnibe01w', 'holdsch01w', 'mccrani01w', 'millsta01w', 'nagyan01w', 'owenhe01w', 'pagemu01w', 'robinre01w', 'washito01w'],
    2001: ['aldrima01w', 'bauerca01w', 'bullevi01w', 'burgean01w', 'holdsch01w', 'luzhe01w', 'mccrani01w', 'milleco01w', 'millsta01w', 'pagemu01w', 'saureau01w', 'stockta01w', 'washito01w', 'whittje01w'],
  },
};

// Active-franchise tricodes → ESPN team ID (string).
// Use this when /api/teams/:id resolves a current franchise — the BBRef tricode is the lookup key.
const BBREF_TO_ESPN = {
  "DET": "3",
  "IND": "5",
  "LAS": "6",
  "MIN": "8",
  "NYL": "9",
  "PHO": "11",
  "SEA": "14",
  "WAS": "16",
  "UTA": "17",
  "ORL": "18"
};

// Defunct-franchise tricodes → synthetic team object. Keep id stable across deploys (used in URLs).
const LEGACY_DEFUNCT_TEAMS = {
  "CHA": {
    "id": "legacy-charlotte-sting",
    "name": "Charlotte Sting",
    "location": "Charlotte",
    "activeYears": [
      1997,
      2006
    ]
  },
  "CLE": {
    "id": "legacy-cleveland-rockers",
    "name": "Cleveland Rockers",
    "location": "Cleveland",
    "activeYears": [
      1997,
      2003
    ]
  },
  "HOU": {
    "id": "legacy-houston-comets",
    "name": "Houston Comets",
    "location": "Houston",
    "activeYears": [
      1997,
      2008
    ]
  },
  "MIA": {
    "id": "legacy-miami-sol",
    "name": "Miami Sol",
    "location": "Miami",
    "activeYears": [
      2000,
      2002
    ]
  },
  "POR": {
    "id": "legacy-portland-fire",
    "name": "Portland Fire",
    "location": "Portland",
    "activeYears": [
      2000,
      2002
    ]
  },
  "SAC": {
    "id": "legacy-sacramento-monarchs",
    "name": "Sacramento Monarchs",
    "location": "Sacramento",
    "activeYears": [
      1997,
      2009
    ]
  }
};

// Reverse-lookup: synthetic 'legacy-...' id → tricode. Used by /api/teams/:id when a request
// arrives for a defunct team page so we can find its roster in LEGACY_TEAM_ROSTERS.
const DEFUNCT_ID_TO_TRICODE = Object.fromEntries(
  Object.entries(LEGACY_DEFUNCT_TEAMS).map(([tri, t]) => [t.id, tri])
);

// Reverse-lookup: ESPN id → tricode. Used by /api/teams/:id/roster?season=YYYY for pre-2002
// seasons: take the requested ESPN team id, find its BBRef tricode, then look up LEGACY_TEAM_ROSTERS.
const ESPN_TO_BBREF = Object.fromEntries(
  Object.entries(BBREF_TO_ESPN).map(([tri, id]) => [id, tri])
);

/**
 * Get the player_IDs that played for tricode in year, or null if no entry exists.
 */
function getLegacyRoster(tricode, year) {
  return LEGACY_TEAM_ROSTERS[tricode]?.[year] ?? null;
}

/**
 * Resolve an ESPN team id to its BBRef tricode (for pre-2002 roster lookups on active franchises).
 */
function tricodeForEspnId(espnId) {
  return ESPN_TO_BBREF[String(espnId)] ?? null;
}

/**
 * Resolve a synthetic legacy-* id to its BBRef tricode (for defunct-team roster lookups).
 */
function tricodeForDefunctId(legacyId) {
  return DEFUNCT_ID_TO_TRICODE[legacyId] ?? null;
}

module.exports = {
  LEGACY_TEAM_ROSTERS,
  BBREF_TO_ESPN,
  ESPN_TO_BBREF,
  LEGACY_DEFUNCT_TEAMS,
  DEFUNCT_ID_TO_TRICODE,
  getLegacyRoster,
  tricodeForEspnId,
  tricodeForDefunctId,
};
