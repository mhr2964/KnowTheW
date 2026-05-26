// Zod schemas mirroring the JSDoc @typedefs in ./types.js — the runtime half of the contract.
//
// Why this exists: ESPN is an undocumented source with a documented history of silent shape drift
// (pre-2003 standings corruption, a `?season=` param that's ignored, seasonType/season field
// drift). Without a boundary check, drift surfaces as a `NaN` deep in the stat math or a blank
// field in the UI — far from the cause. These schemas turn that into a logged alarm naming the
// exact method and field. They validate the NORMALIZED object the provider built, not raw ESPN
// JSON, so they describe our contract, not ESPN's wire format.
//
// Leniency is deliberate. The goal is to catch STRUCTURAL drift (a key vanished, an array became
// an object, a number became a string) without false-alarming on the many legitimately-null fields
// the typedefs already allow. Extra keys pass (Zod objects strip unknowns, they don't reject them),
// so ESPN adding fields never trips the alarm — only a normalized shape we'd actually mishandle does.
//
// SCHEMA_BY_METHOD maps a provider method name to the schema for its resolved return value. Methods
// absent from the map are intentionally unvalidated: the *Raw fetches and getPlayerSeasonStats still
// return source-raw JSON by design (see HANDOFF), and the numeric league-stat maps have no stable
// typedef yet. Add a method here when its return shape is normalized and documented in types.js.

const { z } = require('zod');

// ESPN ids arrive as either strings or numbers depending on the endpoint; the contract accepts both.
const id = z.union([z.string(), z.number()]);
const num = z.number().nullable();
const str = z.string().nullable();

const Team = z.object({
  id,
  name: z.string(),
  shortName: z.string().optional(),
  abbreviation: z.string(),
  color: z.string(),
  logo: z.string().nullable(),
  slug: z.string().optional(),
  location: str.optional(),
  record: z.string().optional(),
  seedLabel: z.string().optional(),
  conference: z.string().optional(),
});

const RosterPlayer = z.object({
  id,
  name: str,
  position: z.string(),
  positionName: z.string(),
  jersey: str,
  headshot: str,
  height: str,
  weight: str,
  age: num,
  college: str,
  birthPlace: str,
  experience: num,
  teamId: id,
  teamName: str.optional(),
});

// fetchHistoricalRoster returns only the fields it can get from the historical endpoint.
const HistoricalRosterEntry = z.object({ id: z.string(), position: z.string() });

const TeamStats = z.object({
  fgaPg: num, fgmPg: num, fgPct: num, fg3mPg: num, fg3Pct: num,
  ftaPg: num, ftmPg: num, ftPct: num, ptsPg: num,
  orbPg: num, drbPg: num, tovPg: num, astPg: num,
});
// getTeamStats has three legitimate returns: null (transient error), {noData:true} (confirmed
// empty season), or the per-game stats object.
const TeamStatsReturn = z.union([z.null(), z.object({ noData: z.literal(true) }), TeamStats]);

const ScheduleEvent = z.object({
  id: z.string(),
  date: str,
  opponent: z.object({
    id: z.string(),
    abbreviation: z.string().nullable().optional(),
    logo: z.string().nullable(),
  }).nullable(),
  atVs: z.enum(['vs', '@']),
  result: z.enum(['W', 'L']).nullable(),
  teamScore: num,
  oppScore: num,
  winner: z.boolean().nullable(),
  roundLabel: str.optional(), // playoffs only; undefined for regular-season events
});

const PlayerBasics = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
});

const GameLogColumn = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['pct', 'num']),
});
// Gamelog scores come from parseInt(), which yields NaN when a score field is absent — that's not
// drift worth alarming on, so these tolerate NaN (unlike ScheduleEvent's real numeric score.value).
const gameScore = z.union([z.number(), z.nan(), z.null()]);
const GameLogGame = z.object({
  date: z.string().nullable().optional(),
  opponent: z.string(),
  atVs: z.string(),
  result: z.string(),
  teamScore: gameScore,
  oppScore: gameScore,
  stats: z.record(z.string(), z.any()),
});
const GameLogResponse = z.object({
  columns: z.array(GameLogColumn),
  games: z.array(GameLogGame),
});

const SCHEMA_BY_METHOD = {
  getTeams: z.array(Team),
  getRoster: z.array(RosterPlayer),
  getSeasonRoster: z.array(RosterPlayer),
  getHistoricalRoster: z.array(HistoricalRosterEntry),
  getTeamStats: TeamStatsReturn,
  getTeamSchedule: z.array(ScheduleEvent).nullable(),
  getPlayoffSchedule: z.array(ScheduleEvent).nullable(),
  getPlayerBasics: PlayerBasics.nullable(),
  getPlayerGameLog: GameLogResponse.nullable(),
};

module.exports = {
  SCHEMA_BY_METHOD,
  // Exported individually so tests and future features can reuse them without the method map.
  schemas: {
    Team, RosterPlayer, HistoricalRosterEntry, TeamStats, TeamStatsReturn,
    ScheduleEvent, PlayerBasics, GameLogResponse,
  },
};
