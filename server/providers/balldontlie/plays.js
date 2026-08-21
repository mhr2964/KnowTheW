// BallDontLie play-by-play extraction. NOT a structural port of espn/gameSummary.js: ESPN attributes
// every play to a player via a structured field (play.participants[].athlete.id); BDL's /plays has
// no such field -- every play only has a free-text `text` description (e.g. "Rhyne Howard makes
// 23-foot three point jumper (Te-Hina Paopao assists)"). Attribution here is name-based: every
// player mentioned in a play's text is matched against a per-game roster dictionary (from
// /player_stats?game_ids[]=<id>, which lists every player who appeared with their real name+id,
// scoped to that one game -- a small, reliable pool to match against, even though the plays
// themselves are prose, not IDs).
//
// There is also no starter/lineup field anywhere on BDL's API (confirmed by inspecting every field
// on /player_stats). Starting-five seeding uses a first-appearance-before-first-substitution
// heuristic (first 5 distinct players a team's plays name, before that team's first Substitution
// event, are treated as starters) -- an approximation, unlike ESPN's clean boxscore starter flag.
// See docs/design/provider-architecture.md and the plan's "Phase 2 scope-up" note for the full
// reasoning behind why this file looks nothing like a copy of gameSummary.js despite doing the same
// job.
//
// computeOnCourtStatsBdl / extractBoxscoreTeamStatsBdl are exported for characterization testing
// against captured fixtures -- same regression-net rationale as the ESPN version.

const { bdlFetch } = require('./client');
const { getCachedRawGameData } = require('../gamePbpCache');

// --- per-game roster + name matching ---

async function fetchGameRoster(bdlGameId) {
  const data = await bdlFetch('/player_stats', { 'game_ids[]': [bdlGameId], per_page: 100 });
  return (data?.data ?? []).map(r => ({
    id: String(r.player.id),
    name: `${r.player.first_name} ${r.player.last_name}`,
    teamId: String(r.team.id),
  }));
}

// Longest-name-first so e.g. "Kiki Iriafen" is preferred over a hypothetical shorter substring
// match; a small, per-game-scoped roster keeps false-positive substring collisions unlikely.
function buildNameMatcher(roster) {
  const sorted = [...roster].sort((a, b) => b.name.length - a.name.length);
  return (text) => sorted.find(p => text.includes(p.name)) ?? null;
}

function findAllMentioned(text, matcher, roster) {
  return roster.filter(p => text.includes(p.name));
}

// --- type/text classification (era-agnostic: strips ALL whitespace before matching, so both the
// pre-2020ish PascalCase taxonomy ("PersonalFoul") and the modern spaced taxonomy ("Personal Foul")
// -- plus the observed literal-newline artifact ("Bad Pass\nTurnover") -- match the same token) ---

function normType(type) {
  return (type ?? '').replace(/\s+/g, '');
}

function isFreeThrow(play) {
  return normType(play.type).includes('FreeThrow');
}

// Shot attempts (make or miss) are detected from the natural-language "makes"/"misses" phrasing
// rather than enumerating every shot-type keyword (Jump Shot, Layup, Hook Shot, Pullup, ...) across
// both taxonomy eras -- the phrasing is consistent where the type strings aren't. Blocked shots are
// a third phrasing ("<blocker> blocks <shooter>'s <shot description>") that names the blocker first
// but still carries `play.team` as the SHOOTER's team (confirmed empirically) -- a block is always a
// miss, so `made` (derived from `scoring_play`) comes out correctly without extra handling.
function isShotAttempt(play) {
  if (isFreeThrow(play)) return false;
  return /\b(makes|misses|blocks)\b/i.test(play.text ?? '');
}

function isThreePointAttempt(play) {
  return play.score_value === 3 || /three point/i.test(play.text ?? '');
}

// FT "N of M" -- extracted via regex rather than exact-string match so it survives the
// "Free Throw 1 of 2" vs "Free Throw - 1 of 2" era difference.
function parseFtPosition(play) {
  const m = (play.type ?? '').match(/(\d+)\s*of\s*(\d+)/i);
  return m ? { n: Number(m[1]), of: Number(m[2]) } : null;
}

function isTechnicalFt(play) {
  return /technical/i.test(play.type ?? '') || /technical/i.test(play.text ?? '');
}

function isTeamRebound(play) {
  return /team rebound/i.test(play.text ?? '');
}

function isOffensiveRebound(play) {
  return normType(play.type) === 'OffensiveRebound';
}
function isDefensiveRebound(play) {
  return normType(play.type) === 'DefensiveRebound';
}

function isTurnover(play) {
  return normType(play.type).includes('Turnover');
}
function isBadPassTurnover(play) {
  const t = normType(play.type);
  return t.includes('BadPass') || /bad pass/i.test(play.text ?? '');
}
function isLostBallTurnover(play) {
  const t = normType(play.type);
  return t.includes('LostBall') || /lost ball/i.test(play.text ?? '');
}

function isFoulOrCharge(play) {
  const t = normType(play.type);
  return t.includes('Foul') || t.includes('Charge');
}
function isShootingFoul(play) {
  return normType(play.type).includes('Shooting');
}
function isOffensiveFoulOrCharge(play) {
  const t = normType(play.type);
  return t.includes('Offensive') || t.includes('Charge');
}

function isSubstitution(play) {
  return normType(play.type) === 'Substitution';
}

// Assist -- extracted from the "(<name> assists)" parenthetical BDL embeds in made-shot text.
function extractAssister(text, matcher) {
  const m = (text ?? '').match(/\(([^)]+?) assists?\)/i);
  if (!m) return null;
  return matcher(m[1]);
}

// --- starting lineup inference (no starter flag exists on BDL -- see file header) ---

function inferStartingFive(plays, roster) {
  const byTeam = {};
  for (const p of roster) {
    if (!byTeam[p.teamId]) byTeam[p.teamId] = new Set();
  }
  const teamIds = Object.keys(byTeam);
  const subbedTeams = new Set();

  for (const play of plays) {
    const playTeam = String(play.team?.id ?? '');
    if (isSubstitution(play)) {
      subbedTeams.add(playTeam);
      continue;
    }
    if (subbedTeams.size >= teamIds.length) break; // both teams have hit a substitution
    const mentioned = findAllMentioned(play.text ?? '', null, roster);
    for (const p of mentioned) {
      if (subbedTeams.has(p.teamId)) continue;
      if (byTeam[p.teamId].size < 5) byTeam[p.teamId].add(p.id);
    }
  }
  return byTeam; // { [teamId]: Set<playerId> }
}

// --- on-court accumulation (mirrors espn/gameSummary.js's oc shape/PBP_OC_KEYS exactly) ---

function computeOnCourtStatsBdl(plays, targetPlayerId, roster) {
  const pid = String(targetPlayerId);
  const target = roster.find(p => p.id === pid);
  if (!target) return null;
  const targetTeamId = target.teamId;

  const sorted = [...plays].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const onCourt = inferStartingFive(sorted, roster);
  const matcher = buildNameMatcher(roster);

  const oc = {
    fga: 0, fgm: 0, fg3a: 0, fg3m: 0, fta: 0, ftm: 0, orb: 0, drb: 0, tov: 0, ast: 0,
    oFga: 0, oFgm: 0, oFg3a: 0, oFta: 0, oOrb: 0, oDrb: 0, oTov: 0,
    pts: 0, oPts: 0,
    badPassTov: 0, lostBallTov: 0,
    foulCommitShoot: 0, foulCommitOff: 0,
    foulDrawnShoot: 0, foulDrawnOff: null,
    pga: 0, and1: 0, blkd: null,
  };

  for (const play of sorted) {
    const playTeam = String(play.team?.id ?? '');
    const text = play.text ?? '';

    if (isSubstitution(play)) {
      // "<in> enters the game for <out>" -- confirmed format by spike.
      const m = text.match(/^(.+?) enters the game for (.+)$/i);
      if (m && onCourt[playTeam]) {
        const inPlayer  = matcher(m[1]);
        const outPlayer = matcher(m[2]);
        if (inPlayer)  onCourt[playTeam].add(inPlayer.id);
        if (outPlayer) onCourt[playTeam].delete(outPlayer.id);
      }
      continue;
    }

    if (!onCourt[targetTeamId]?.has(pid)) continue;

    const actor = matcher(text); // the play's primary named player (shooter/rebounder/fouler/etc.)
    const isTargetsBall = playTeam === targetTeamId;

    if (isShotAttempt(play)) {
      const made = !!play.scoring_play;
      const is3  = isThreePointAttempt(play);
      const sv   = play.score_value ?? 0;
      if (isTargetsBall) {
        oc.fga++; if (is3) { oc.fg3a++; if (made) oc.fg3m++; } if (made) oc.fgm++;
        if (made) oc.pts += sv;
        if (made) {
          const assister = extractAssister(text, matcher);
          if (assister) { oc.ast++; oc.pga += sv; }
        }
      } else {
        oc.oFga++; if (is3) oc.oFg3a++; if (made) oc.oFgm++;
        if (made) oc.oPts += sv;
      }
      continue;
    }

    if (isFreeThrow(play)) {
      const made = !!play.scoring_play;
      const pos  = parseFtPosition(play);
      if (isTargetsBall) {
        oc.fta++; if (made) oc.ftm++; if (made) oc.pts += 1;
        // Foul drawn: target is the FT shooter on the first FT of a non-technical trip -- FTs are
        // the only reliable per-play signal for who was fouled (foul plays only name the fouler).
        if (pos && pos.n === 1 && !isTechnicalFt(play) && actor?.id === pid) {
          oc.foulDrawnShoot++;
          if (pos.of === 1) oc.and1++; // single-shot trip = And-1
        }
      } else {
        oc.oFta++;
      }
      continue;
    }

    if (isTurnover(play)) {
      if (isTargetsBall && actor?.id === pid) {
        oc.tov++;
        if (isBadPassTurnover(play)) oc.badPassTov++;
        else if (isLostBallTurnover(play)) oc.lostBallTov++;
      } else if (!isTargetsBall) {
        oc.oTov++;
      }
      continue;
    }

    if (isTeamRebound(play)) continue; // no individual to attribute, same exclusion ESPN applies

    if (isOffensiveRebound(play) || isDefensiveRebound(play)) {
      if (isTargetsBall && actor?.id === pid) {
        if (isOffensiveRebound(play)) oc.orb++; else oc.drb++;
      } else if (!isTargetsBall) {
        if (isOffensiveRebound(play)) oc.oOrb++; else oc.oDrb++;
      }
      continue;
    }

    if (isFoulOrCharge(play) && isTargetsBall && actor?.id === pid) {
      if (isShootingFoul(play)) oc.foulCommitShoot++;
      else if (isOffensiveFoulOrCharge(play)) oc.foulCommitOff++;
    }
  }

  return oc;
}

function toTeamStatsRow(r) {
  return {
    fgm: r.fgm ?? 0, fga: r.fga ?? 0, fg3m: r.fg3m ?? 0,
    ftm: r.ftm ?? 0, fta: r.fta ?? 0,
    orb: r.oreb ?? 0, drb: r.dreb ?? 0,
    tov: r.turnovers ?? r.turnover ?? 0, ast: r.ast ?? 0,
    pts: 2 * (r.fgm ?? 0) + (r.fg3m ?? 0) + (r.ftm ?? 0),
  };
}

// Pure row-selection + field mapping, split out from the fetch below so it can be unit tested
// against captured /team_stats rows without a network call -- mirrors how espn/gameSummary.js's
// extractBoxscoreTeamStats takes an already-fetched summary object rather than fetching itself.
function buildBoxscoreFromRows(rows, targetTeamId) {
  const tmRow  = rows.find(r => String(r.team?.id) === targetTeamId);
  const oppRow = rows.find(r => String(r.team?.id) !== targetTeamId);
  if (!tmRow) return null;

  const tm = toTeamStatsRow(tmRow);
  const opp = oppRow ? toTeamStatsRow(oppRow) : null;
  return { tm, oppPts: opp?.pts ?? null, opp: opp ?? null };
}

// Team + opponent boxscore stats for one game, from /team_stats (per-game team box, confirmed to
// carry exact integers) -- preferred over summing /player_stats rows by team since it's one call
// instead of ~10-15.
async function extractBoxscoreTeamStatsBdl(bdlGameId, roster, targetPlayerId) {
  const pid = String(targetPlayerId);
  const target = roster.find(p => p.id === pid);
  if (!target) return null;

  const data = await bdlFetch('/team_stats', { 'game_ids[]': [bdlGameId] });
  const rows = data?.data ?? [];
  return buildBoxscoreFromRows(rows, target.teamId);
}

// --- public contract methods ---

// Trims one raw /plays row down to exactly the fields computeOnCourtStatsBdl/inferStartingFive/
// isFreeThrow/isShotAttempt/etc actually read (order, type, text, scoring_play, score_value, and
// team.id -- narrowed from BDL's full team object, which also carries conference/city/name/
// full_name/abbreviation on every single play). Caching the untrimmed row is real, avoidable bloat:
// confirmed live, a single 407-play game serialized to ~133KB (~87KB even after just narrowing
// `team`; game_id/scores/period/clock alone still added real weight repeated 407 times). At scale
// this filled the ENTIRE 512MB free-tier Mongo quota after only 59 of 459 players in the first
// pre-warm backfill run -- see gamePbpCache.js's header comment for the incident and the safety
// valve added because of it. Keeps the {team: {id}} nesting shape (not a flattened teamId) so
// computeOnCourtStatsBdl/inferStartingFive and their existing characterization-test fixtures don't
// need to change at all -- only the surrounding envelope shrinks.
function trimPlay(p) {
  return {
    order: p.order, type: p.type, text: p.text,
    scoring_play: p.scoring_play, score_value: p.score_value,
    team: p.team ? { id: p.team.id } : null,
  };
}

// Same over-fetching pattern as trimPlay above on /team_stats rows, just a much smaller multiplier
// (2 rows per game, not ~400) -- trimmed for consistency, not because it's the real driver of bloat.
function trimTeamStatsRow(r) {
  return {
    fgm: r.fgm, fga: r.fga, fg3m: r.fg3m, ftm: r.ftm, fta: r.fta,
    oreb: r.oreb, dreb: r.dreb, turnovers: r.turnovers, turnover: r.turnover, ast: r.ast,
    team: r.team ? { id: r.team.id } : null,
  };
}

// The 3 BDL calls below (/plays, roster via /player_stats, /team_stats) are all per-GAME, not
// per-player -- nothing here reads bdlPlayerId. Split out so getCachedRawGameData (gamePbpCache.js)
// can cache this once per game and reuse it across every player who shares that game, instead of
// re-fetching identically for each player individually.
async function fetchRawGameDataBdl(bdlGameId) {
  const [plays, roster] = await Promise.all([
    bdlFetch('/plays', { game_id: bdlGameId, per_page: 100 }),
    fetchGameRoster(bdlGameId),
  ]);
  if (!plays?.data) return null;

  const teamStatsData = await bdlFetch('/team_stats', { 'game_ids[]': [bdlGameId] });
  return {
    plays: plays.data.map(trimPlay),
    roster,
    teamStatsRows: (teamStatsData?.data ?? []).map(trimTeamStatsRow),
  };
}

// Pure, local, no network -- the only part of this that's actually player-specific.
function computePlayerPbpStatsBdl(raw, bdlPlayerId) {
  if (!raw) return { fetched: false, onCourt: null, boxscore: null };
  const pid = String(bdlPlayerId);
  const target = raw.roster.find(p => p.id === pid);
  return {
    fetched: true,
    onCourt: computeOnCourtStatsBdl(raw.plays, bdlPlayerId, raw.roster),
    boxscore: target ? buildBoxscoreFromRows(raw.teamStatsRows, target.teamId) : null,
  };
}

async function getGamePbpStatsBdl(bdlGameId, bdlPlayerId, season) {
  const raw = await getCachedRawGameData('balldontlie', bdlGameId, season, () => fetchRawGameDataBdl(bdlGameId));
  return computePlayerPbpStatsBdl(raw, bdlPlayerId);
}

// Resolves the player's BDL team for the season from their own /player_stats response (self-
// contained, doesn't need ESPN team data threaded through), then filters /games to real
// regular/postseason franchise games -- both the postseason query param AND (unlike other BDL
// endpoints) any hoped-for server-side exhibition filter are unavailable, so filtering happens
// entirely client-side on each game's own `postseason` boolean and `conference !== null` fields
// (see docs/design/provider-architecture.md's spike findings).
async function getRegularSeasonEventIdsBdl(bdlPlayerId, season, seasontype = 2) {
  const seasonStats = await bdlFetch('/player_stats', { 'player_ids[]': [bdlPlayerId], 'seasons[]': [season], per_page: 100 });
  const teamId = seasonStats?.data?.[0]?.team?.id;
  if (teamId == null) return null;

  const games = await bdlFetch('/games', { 'team_ids[]': [teamId], 'seasons[]': [season], per_page: 100 });
  if (!games?.data) return null;

  const wantPostseason = seasontype === 3;
  return games.data
    .filter(g => !!g.postseason === wantPostseason)
    .filter(g => g.home_team?.conference != null && g.visitor_team?.conference != null)
    .map(g => `bdl:${g.id}`);
}

module.exports = {
  getGamePbpStatsBdl, getRegularSeasonEventIdsBdl,
  // exported for characterization tests:
  computeOnCourtStatsBdl, extractBoxscoreTeamStatsBdl, buildBoxscoreFromRows,
  inferStartingFive, fetchGameRoster, fetchRawGameDataBdl, computePlayerPbpStatsBdl,
};
