// Unit tests for the pure identity-resolution logic in server/providers/balldontlie/idMap.js.
// The Mongo-cache-aside and in-process-memoization wrappers (resolveBdlTeamId/resolveBdlPlayerId)
// are thin glue over already-tested cache-aside patterns (teamSeasonCache.js); the real correctness
// risk this file guards -- name-based player matching, and which BDL teams count as real
// franchises -- is covered here directly against the pure, network-free functions.

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  isRealFranchise,
  buildTeamMapFromLists,
  matchPlayerCandidate,
} = require('../server/providers/balldontlie/idMap');

test('isRealFranchise: a real conference means a real franchise', () => {
  assert.strictEqual(isRealFranchise({ conference: 'Western Conference' }), true);
});

test('isRealFranchise: exhibition/All-Star/placeholder entries have conference:null', () => {
  assert.strictEqual(isRealFranchise({ conference: null, full_name: 'Team WNBA' }), false);
  assert.strictEqual(isRealFranchise({}), false);
});

test('buildTeamMapFromLists: matches ESPN teams to BDL teams by abbreviation, excluding non-franchise entries', () => {
  const espnTeams = [
    { id: '17', abbreviation: 'LV' },
    { id: '3', abbreviation: 'NY' },
    { id: '99', abbreviation: 'ZZ' }, // no BDL match at all
  ];
  const bdlTeams = [
    { id: 8, abbreviation: 'LV', conference: 'Western Conference' },
    { id: 1, abbreviation: 'NY', conference: 'Eastern Conference' },
    { id: 40, abbreviation: 'LV', conference: null }, // exhibition entry sharing LV's abbreviation -- must not win
  ];
  assert.deepStrictEqual(buildTeamMapFromLists(espnTeams, bdlTeams), {
    '17': 8,
    '3': 1,
  });
});

test('buildTeamMapFromLists: abbreviation match is case-insensitive', () => {
  const espnTeams = [{ id: '17', abbreviation: 'lv' }];
  const bdlTeams = [{ id: 8, abbreviation: 'LV', conference: 'Western Conference' }];
  assert.deepStrictEqual(buildTeamMapFromLists(espnTeams, bdlTeams), { '17': 8 });
});

test('buildTeamMapFromLists: returns {} when BDL teams could not be fetched (transient error)', () => {
  assert.deepStrictEqual(buildTeamMapFromLists([{ id: '17', abbreviation: 'LV' }], null), {});
});

test('matchPlayerCandidate: a single exact full-name match resolves', () => {
  const candidates = [
    { id: 535, first_name: "A'ja", last_name: 'Wilson' },
    { id: 900, first_name: 'Some', last_name: 'OtherWilson' },
  ];
  assert.deepStrictEqual(matchPlayerCandidate("A'ja Wilson", candidates), { id: 535, ambiguous: false });
});

test('matchPlayerCandidate: matching is case-insensitive', () => {
  const candidates = [{ id: 535, first_name: "A'JA", last_name: 'WILSON' }];
  assert.deepStrictEqual(matchPlayerCandidate("a'ja wilson", candidates), { id: 535, ambiguous: false });
});

test('matchPlayerCandidate: zero matches is unresolved, not ambiguous', () => {
  const candidates = [{ id: 900, first_name: 'Some', last_name: 'OtherPerson' }];
  assert.deepStrictEqual(matchPlayerCandidate('Nobody Here', candidates), { id: null, ambiguous: false });
});

test('matchPlayerCandidate: two players sharing the exact same full name is a real ambiguous collision, not a guess', () => {
  const candidates = [
    { id: 100, first_name: 'A', last_name: 'Johnson' },
    { id: 200, first_name: 'A', last_name: 'Johnson' },
  ];
  assert.deepStrictEqual(matchPlayerCandidate('A Johnson', candidates), { id: null, ambiguous: true });
});

test('matchPlayerCandidate: handles an empty/missing candidate list', () => {
  assert.deepStrictEqual(matchPlayerCandidate('Nobody Here', undefined), { id: null, ambiguous: false });
});
