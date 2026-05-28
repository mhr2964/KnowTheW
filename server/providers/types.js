// The normalized domain shapes that cross the provider boundary. These are the contract every
// provider returns; downstream code (routes, stat math, client) depends on THESE names, never on a
// source's raw field names. Documented as JSDoc @typedefs now (zero-dep, editor IntelliSense); Zod
// schemas mirroring these get added at the provider boundary in M7 to catch silent source drift.
//
// As later milestones absorb the leaky boundaries, their shapes get added here:
//   - GameSummary / OnCourtStats       (M5)
//   - LeagueStatLine / PercentileEntry (M6)
//   - STAT_COLUMNS column metadata      (client-decoupling milestone)

/**
 * @typedef {Object} GameLogColumn
 * @property {string} key    Stat identifier (also the key under each game's `stats`).
 * @property {string} label  Display label, e.g. "PTS".
 * @property {'pct'|'num'} kind  'pct' values are 0-100 (client renders as a 3-dp fraction).
 */

/**
 * @typedef {Object} GameLogResponse
 * @property {GameLogColumn[]} columns  Render order + presentation metadata for the stat columns.
 * @property {Array<{date:string, opponent:string, atVs:'vs'|'@', result:string,
 *   teamScore:number, oppScore:number, stats:Object<string,*>}>} games  Sorted ascending by date;
 *   each game's `stats` is keyed by column key (no positional arrays).
 */

/**
 * @typedef {Object} Team
 * @property {string|number} id
 * @property {string} name
 * @property {string} [shortName]
 * @property {string} abbreviation  Canonical tricode (ESPN: derived from logo filename).
 * @property {string} color         Hex without '#'.
 * @property {string|null} logo
 * @property {string} [slug]
 * @property {string|null} [location]
 * @property {string} [record]      "W-L"; omitted before any games played.
 * @property {string} [seedLabel]   e.g. "1st"; omitted before any games played.
 * @property {string} [conference]
 */

/**
 * @typedef {Object} RosterPlayer
 * @property {string|number} id
 * @property {string|null} name
 * @property {string} position       Abbreviation, e.g. "G".
 * @property {string} positionName   Full name, e.g. "Guard".
 * @property {string|null} jersey
 * @property {string|null} headshot
 * @property {string|null} height
 * @property {string|null} weight
 * @property {number|null} age
 * @property {string|null} college
 * @property {string|null} birthPlace  Pre-joined "City, State, Country".
 * @property {number|null} experience  Years.
 * @property {string|number} teamId
 * @property {string|null} teamName
 */

/**
 * @typedef {Object} TeamStats  Per-game team stats. Any field may be null. `{noData:true}` means
 *   the source confirmed an empty season (cacheable); a null return means a transient error.
 * @property {number|null} fgaPg
 * @property {number|null} fgmPg
 * @property {number|null} fgPct
 * @property {number|null} fg3mPg
 * @property {number|null} fg3Pct
 * @property {number|null} ftaPg
 * @property {number|null} ftmPg
 * @property {number|null} ftPct
 * @property {number|null} ptsPg
 * @property {number|null} orbPg
 * @property {number|null} drbPg
 * @property {number|null} tovPg
 * @property {number|null} astPg
 */

/**
 * @typedef {Object} ScheduleEvent
 * @property {string} id
 * @property {string|null} date
 * @property {{id:string, abbreviation:string, logo:string|null}|null} opponent
 * @property {'vs'|'@'} atVs
 * @property {'W'|'L'|null} result
 * @property {number|null} teamScore
 * @property {number|null} oppScore
 * @property {boolean|null} winner
 * @property {string|null} [roundLabel]  Playoffs only.
 */

/**
 * @typedef {Object} PlayerBasics
 * @property {string} id
 * @property {string} name
 * @property {string} position       Abbreviation.
 * @property {string} [positionName]
 * @property {string|null} [headshot]
 */

/**
 * @typedef {Object} OnCourtStats  Team + opponent counting stats accumulated while the target
 *   player is on the floor (from play-by-play). Keys listed in PBP_OC_KEYS.
 */

/**
 * The key set of an OnCourtStats object (team stats + opponent `o*` stats). Part of the contract so
 * consumers (advancedStats) can iterate it without importing a source-specific module.
 */
const PBP_OC_KEYS = [
  'fga', 'fgm', 'fg3a', 'fg3m', 'fta', 'ftm', 'orb', 'drb', 'tov', 'ast',
  'oFga', 'oFgm', 'oFg3a', 'oFta', 'oOrb', 'oDrb', 'oTov',
  'pts', 'oPts',
  'badPassTov', 'lostBallTov',
  'foulCommitShoot', 'foulCommitOff',
  'foulDrawnShoot', 'foulDrawnOff',
  'pga', 'and1', 'blkd',
];

module.exports = { PBP_OC_KEYS };
