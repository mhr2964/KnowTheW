// The data-source contract. Every external stats source (ESPN today, Sportradar later) is an
// implementation of this interface, so the rest of the app never touches a source SDK or raw
// source JSON directly — it calls getProvider() (see ./index.js) and uses these methods, which
// return the documented normalized shapes in ./types.js.
//
// Why a base class that throws rather than a bare interface: an implementation that forgets a
// method inherits the throwing default, so a partial provider (e.g. an in-progress Sportradar
// port) fails loudly at the exact missing call instead of returning undefined and corrupting
// data downstream. This is the safety net that makes the M8 `STATS_PROVIDER=sportradar` boot a
// real leak test.

class NotImplementedError extends Error {
  constructor(method, provider) {
    super(`${provider}.${method}() is not implemented`);
    this.name = 'NotImplementedError';
    this.method = method;
    this.provider = provider;
  }
}

class SportsDataProvider {
  /** Stable identifier for the source, e.g. 'espn' | 'sportradar'. */
  get name() { return 'base'; }

  _notImplemented(method) {
    throw new NotImplementedError(method, this.name);
  }

  // --- Teams & rosters ---  (param arity documented in ./types.js + the ESPN implementation)
  /** @returns {Promise<import('./types').Team[]>} active teams with current-season record. */
  getTeams() { return this._notImplemented('getTeams'); }
  /** getRoster(teamId, teamName) → {Promise<import('./types').RosterPlayer[]>} current roster. */
  getRoster() { return this._notImplemented('getRoster'); }
  /** getHistoricalRoster(teamId, season) → lightweight [{ id, position }]. ESPN ignores ?season=. */
  getHistoricalRoster() { return this._notImplemented('getHistoricalRoster'); }
  /** getSeasonRoster(teamId, season, teamName) → full historical roster in RosterPlayer shape. */
  getSeasonRoster() { return this._notImplemented('getSeasonRoster'); }

  // --- Team stats & schedule ---
  /** getTeamStats(teamId, year) → cached {Promise<import('./types').TeamStats|{noData:true}|null>}. */
  getTeamStats() { return this._notImplemented('getTeamStats'); }
  /** getTeamStatsRaw(teamId, year) → uncached (past-season callers route through the Mongo cache). */
  getTeamStatsRaw() { return this._notImplemented('getTeamStatsRaw'); }
  /** getTeamPointsAllowed(teamId, year) → cached avg opponent PPG (regular season). */
  getTeamPointsAllowed() { return this._notImplemented('getTeamPointsAllowed'); }
  /** getTeamPointsAllowedRaw(teamId, year) → uncached avg opponent PPG. */
  getTeamPointsAllowedRaw() { return this._notImplemented('getTeamPointsAllowedRaw'); }
  /** getTeamSchedule(teamId, season, seasontype) → {Promise<ScheduleEvent[]|null>}; 2=reg, 3=playoffs. */
  getTeamSchedule() { return this._notImplemented('getTeamSchedule'); }
  /** getPlayoffSchedule(teamId, season) → playoff schedule (seasontype=3). */
  getPlayoffSchedule() { return this._notImplemented('getPlayoffSchedule'); }
  /** getStandingsRaw(year) → raw standings `children` array (null year = current season). */
  getStandingsRaw() { return this._notImplemented('getStandingsRaw'); }

  // --- Player ---
  /** getGameSummary(eventId) → raw game summary (PBP). Normalized at the boundary in a later milestone. */
  getGameSummary() { return this._notImplemented('getGameSummary'); }
  /** getPlayerBasics(playerId) → minimal { id, name, position } | null. */
  getPlayerBasics() { return this._notImplemented('getPlayerBasics'); }
  /** getRetiredPlayer(playerId) → full retired-player profile | null (not in the active cache). */
  getRetiredPlayer() { return this._notImplemented('getRetiredPlayer'); }
  /** getPlayerSeasonStats(playerId) → { regData, postData } season-stats payloads. */
  getPlayerSeasonStats() { return this._notImplemented('getPlayerSeasonStats'); }

  // --- In-memory active-player index accessors ---
  // NOTE: these expose ESPN's startup-prefetch caches (active rosters + a player lookup). They are a
  // pragmatic seam for the migration; a later milestone should replace them with source-neutral
  // contract methods (e.g. getActivePlayers() / findCachedPlayer(id)) so a source without a prefetch
  // step can still satisfy the contract.
  /** getPlayerById(id) → the cached active-player record, or undefined. */
  getPlayerById() { return this._notImplemented('getPlayerById'); }
  /** @returns {Object<string, import('./types').RosterPlayer[]>} teamId → cached roster. */
  getRosterData() { return this._notImplemented('getRosterData'); }
  /** @returns {Object<string, import('./types').RosterPlayer>} the cached id → player index. */
  getPlayerIndex() { return this._notImplemented('getPlayerIndex'); }
  /** @returns {Object} the mutable current-season team-stats cache (passed into stat builders). */
  getTeamSeasonStatsCache() { return this._notImplemented('getTeamSeasonStatsCache'); }
}

module.exports = { SportsDataProvider, NotImplementedError };
