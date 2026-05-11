// WNBA Champions by year. Update once per October when the Finals conclude — it's a two-line PR.
// Team names must match ESPN's team.name (team.displayName) exactly for the join in historyAggregator.
// Defunct franchises (Houston Comets, Detroit Shock, Sacramento Monarchs) no longer appear in
// /api/teams but are kept here under their historically-recognized names; the aggregator matches
// by string equality so those years produce champion:true only when the team name matches.
// If ESPN's champion constant and the playoff-schedule-derived result disagree, the constant wins —
// it is the audit-trail source of truth.
//
// FRANCHISE_ALIASES is DERIVED from WNBA_FRANCHISE_LINEAGE — do not hand-edit it.
// To add a relocation, edit server/constants/wnbaFranchiseLineage.js instead.
// A module-load assertion guards against derivation drift (throws at boot if the derived set
// diverges from the expected snapshot).

const { WNBA_FRANCHISE_LINEAGE } = require('./wnbaFranchiseLineage');

const WNBA_CHAMPIONS = Object.freeze({
  1997: { team: 'Houston Comets' },
  1998: { team: 'Houston Comets' },
  1999: { team: 'Houston Comets' },
  2000: { team: 'Houston Comets' },
  2001: { team: 'Los Angeles Sparks' },
  2002: { team: 'Los Angeles Sparks' },
  2003: { team: 'Detroit Shock' },
  2004: { team: 'Seattle Storm' },
  2005: { team: 'Sacramento Monarchs' },
  2006: { team: 'Detroit Shock' },
  2007: { team: 'Phoenix Mercury' },
  2008: { team: 'Detroit Shock' },
  2009: { team: 'Phoenix Mercury' },
  2010: { team: 'Seattle Storm' },
  2011: { team: 'Minnesota Lynx' },
  2012: { team: 'Indiana Fever' },
  2013: { team: 'Minnesota Lynx' },
  2014: { team: 'Phoenix Mercury' },
  2015: { team: 'Minnesota Lynx' },
  2016: { team: 'Los Angeles Sparks' },
  2017: { team: 'Minnesota Lynx' },
  2018: { team: 'Seattle Storm' },
  2019: { team: 'Washington Mystics' },
  2020: { team: 'Seattle Storm' },
  2021: { team: 'Chicago Sky' },
  2022: { team: 'Las Vegas Aces' },
  2023: { team: 'Las Vegas Aces' },
  2024: { team: 'New York Liberty' },
  2025: { team: 'New York Liberty' },
});

// Derive FRANCHISE_ALIASES from WNBA_FRANCHISE_LINEAGE.
// For each team, aliases = all historical names (entries where endYear !== null).
// The last entry (endYear: null) is the current identity — not an alias of itself.
function deriveAliasesFromLineage(lineage) {
  const result = {};
  for (const [, entries] of Object.entries(lineage)) {
    // The entry with endYear: null is the current name
    const currentEntry = entries.find(e => e.endYear === null);
    if (!currentEntry) continue; // shouldn't happen with well-formed lineage
    const currentName = currentEntry.name;
    const aliases = entries
      .filter(e => e.endYear !== null) // historical entries only
      .map(e => e.name);
    if (aliases.length > 0) {
      result[currentName] = aliases;
    }
  }
  return result;
}

const _derived = deriveAliasesFromLineage(WNBA_FRANCHISE_LINEAGE);

// Module-load assertion: derived aliases must match the expected snapshot (the prior hand-maintained
// set). This throws at boot if a lineage edit silently changes the alias set so isChampion() sees
// the same names the champions constant was written against.
// Expected set (Wikipedia-confirmed, 2026-05-11):
//   Dallas Wings      → ['Detroit Shock', 'Tulsa Shock']
//   Las Vegas Aces    → ['Utah Starzz', 'San Antonio Silver Stars', 'San Antonio Stars']
//   Connecticut Sun   → ['Orlando Miracle']
const EXPECTED_ALIAS_SNAPSHOT = {
  'Dallas Wings':    ['Detroit Shock', 'Tulsa Shock'],
  'Las Vegas Aces':  ['Utah Starzz', 'San Antonio Silver Stars', 'San Antonio Stars'],
  'Connecticut Sun': ['Orlando Miracle'],
};

(function assertAliasesMatchSnapshot() {
  const derivedKeys   = Object.keys(_derived).sort();
  const expectedKeys  = Object.keys(EXPECTED_ALIAS_SNAPSHOT).sort();

  if (JSON.stringify(derivedKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `[wnbaChampions] FRANCHISE_ALIASES derivation mismatch — key sets differ.\n` +
      `  Derived keys:  ${derivedKeys.join(', ')}\n` +
      `  Expected keys: ${expectedKeys.join(', ')}\n` +
      `Update EXPECTED_ALIAS_SNAPSHOT in wnbaChampions.js after verifying the lineage change.`
    );
  }

  for (const key of derivedKeys) {
    const derivedSet  = new Set(_derived[key]);
    const expectedSet = new Set(EXPECTED_ALIAS_SNAPSHOT[key]);
    const onlyInDerived  = [...derivedSet].filter(v => !expectedSet.has(v));
    const onlyInExpected = [...expectedSet].filter(v => !derivedSet.has(v));
    if (onlyInDerived.length > 0 || onlyInExpected.length > 0) {
      throw new Error(
        `[wnbaChampions] FRANCHISE_ALIASES derivation mismatch for "${key}".\n` +
        `  Only in derived:  ${onlyInDerived.join(', ') || '(none)'}\n` +
        `  Only in expected: ${onlyInExpected.join(', ') || '(none)'}\n` +
        `Update EXPECTED_ALIAS_SNAPSHOT in wnbaChampions.js after verifying the lineage change.`
      );
    }
  }
})();

const FRANCHISE_ALIASES = Object.freeze(
  Object.fromEntries(Object.entries(_derived).map(([k, v]) => [k, Object.freeze(v)]))
);

module.exports = { WNBA_CHAMPIONS, FRANCHISE_ALIASES };
