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
  /** getTeamFourFactors(teamId, season, seasontype) → {Promise<import('./types').TeamFourFactors|null>}
   *  Dean Oliver's Four Factors (eFG%/TOV%/OREB%/FT Rate) for the team and its opponents. BDL-only --
   *  no ESPN equivalent exists, same graceful-degradation posture as getPlayerSeasonRatings. */
  getTeamFourFactors() { return this._notImplemented('getTeamFourFactors'); }
  /** getTeamShotChart(teamId, season) → {Promise<{season, own:{zones}|null, opponent:{zones}|null}|null>}
   *  Zone-aggregated FG% for the team's own shots AND opponent shots faced while playing this team
   *  (the more novel defensive-tendency framing), same zone shape as getPlayerShotChart. BDL-only --
   *  no ESPN equivalent exists, same graceful-degradation posture as getPlayerSeasonRatings. */
  getTeamShotChart() { return this._notImplemented('getTeamShotChart'); }
  /** getTeamSchedule(teamId, season, seasontype) → {Promise<ScheduleEvent[]|null>}; 2=reg, 3=playoffs. */
  getTeamSchedule() { return this._notImplemented('getTeamSchedule'); }
  /** getPlayoffSchedule(teamId, season) → playoff schedule (seasontype=3). */
  getPlayoffSchedule() { return this._notImplemented('getPlayoffSchedule'); }
  /** getStandingsRaw(year) → raw standings `children` array (null year = current season). */
  getStandingsRaw() { return this._notImplemented('getStandingsRaw'); }
  /** getStandings(season) → {Promise<import('./types').StandingRow[]|null>}, current season if
   *  season is omitted. A live, sortable standings table -- distinct from getStandingsRaw above,
   *  which is ESPN-only raw JSON for historyAggregator.js's playoff-seed reconstruction, not a
   *  rendered table. */
  getStandings() { return this._notImplemented('getStandings'); }

  // --- Player ---
  /** getPlayerBasics(playerId) → minimal { id, name, position } | null. */
  getPlayerBasics() { return this._notImplemented('getPlayerBasics'); }
  /** getRetiredPlayer(playerId) → full retired-player profile | null (not in the active cache). */
  getRetiredPlayer() { return this._notImplemented('getRetiredPlayer'); }
  /** getPlayerSeasonStats(playerId) → {Promise<import('./types').PlayerSeasonStatsResponse>}. */
  getPlayerSeasonStats() { return this._notImplemented('getPlayerSeasonStats'); }
  /** getPlayerGameLog(playerId, season) → { columns:[{key,label,kind}], games:[...] } | null. */
  getPlayerGameLog() { return this._notImplemented('getPlayerGameLog'); }
  /** getGameLogEvents(playerId, season, seasontype) → [{eventId,seasonTypeName,eventNote,opponentId}] | null. */
  getGameLogEvents() { return this._notImplemented('getGameLogEvents'); }
  /** getPlayerGameAdvancedStats(playerId, gameId) → {misc, usage, scoring, advanced, fourFactors}
   *  (each a flat {key: number|null} bag) | null. gameId is the provider's own per-game id, as
   *  already exposed on each row returned by getPlayerGameLog (BDL-sourced rows only -- see
   *  gameLog.js). BDL-only, no ESPN equivalent -- a game log built from ESPN has no gameId on its
   *  rows, so this always returns null there. */
  getPlayerGameAdvancedStats() { return this._notImplemented('getPlayerGameAdvancedStats'); }
  /** getPlayerShotChart(playerId, season, postseason) → {season, zones:[{key,label,fga,fgm,fgPct}]}
   *  | null. Zone-aggregated FG stats per court zone, not per-shot coordinates. No ESPN equivalent
   *  exists -- a provider without shot-location data should return null, not throw (see
   *  espn/index.js). `postseason` is optional/falsy-default (regular season). */
  getPlayerShotChart() { return this._notImplemented('getPlayerShotChart'); }
  /** getLeagueShotZones(season, postseason) → {zoneKey: leagueAvgFgPct} | null. League-wide
   *  volume-weighted FG% per court zone, for anchoring Shot Chart's color scale to each zone's own
   *  average rather than a flat 50% (mid-range and 3PT have very different real averages -- see
   *  leagueShotZones.js). No ESPN equivalent exists, same as getPlayerShotChart. */
  getLeagueShotZones() { return this._notImplemented('getLeagueShotZones'); }
  /** getLeagueShotZoneLeaders(season, postseason) → {season, zones: [{key, label, leaders:
   *  [{bdlPlayerId, name, teamAbbr, fga, fgm, fgPct, playerId}]}]} | null. Per-zone top-N by FG%
   *  among players clearing a minimum-attempts floor in that zone (see leagueShotZoneLeaders.js).
   *  playerId is this site's ESPN id, resolved from the BDL name server-side (null if the name
   *  couldn't be linked -- see idMap.js's resolveEspnIdByName) -- routes/client never see a BDL id.
   *  No ESPN equivalent exists, same as getPlayerShotChart/getLeagueShotZones. */
  getLeagueShotZoneLeaders() { return this._notImplemented('getLeagueShotZoneLeaders'); }
  /** getPlayerInjuryStatus(playerId) → {status, returnDate, comment} | null. status/comment are
   *  observed strings, not a fixed enum ('Out'/'Day-To-Day' seen so far); returnDate is a raw
   *  free-text estimate from the source (e.g. "Aug 30", no year) -- not a parseable Date. null
   *  means the player has no current injury entry. No ESPN equivalent exists. */
  getPlayerInjuryStatus() { return this._notImplemented('getPlayerInjuryStatus'); }
  /** getTeamInjuries(teamId) → [{playerId, playerName, status, returnDate, comment}]. playerId is
   *  this site's ESPN id, resolved from the source's plain name server-side (null if unresolved --
   *  same identity-bridge posture as getLeagueShotZoneLeaders); [] when the team has no current
   *  injuries or has no source-side mapping. No ESPN equivalent exists. */
  getTeamInjuries() { return this._notImplemented('getTeamInjuries'); }
  /** getGameOdds(bdlGameIds) → {[gameId]: {vendor, spread:{home,away}, moneyline:{home,away},
   *  total:{value,over,under}, updatedAt}}. One representative sportsbook's line per game (see
   *  odds.js -- multiple books genuinely disagree, this isn't a consensus line). `bdlGameIds` are
   *  already this site's own schedule event ids once BDL-sourced (no ESPN-id resolution step,
   *  unlike other BDL methods). A game with no odds posted yet is simply absent from the result,
   *  not present with a null value. No ESPN equivalent exists. */
  getGameOdds() { return this._notImplemented('getGameOdds'); }
  /** getGamePbpStats(eventId, playerId, season) → {fetched, onCourt, boxscore} (raw summary stays in
   *  provider). `season` is only used for the per-game cache's isPastSeason gate (gamePbpCache.js),
   *  not sent upstream -- safe to omit for a not-yet-cacheable (current-season) call. */
  getGamePbpStats() { return this._notImplemented('getGamePbpStats'); }
  /** getRegularSeasonEventIds(playerId, season, seasontype) → filtered event IDs for PBP (excludes All-Stars, non-franchise opponents). */
  getRegularSeasonEventIds() { return this._notImplemented('getRegularSeasonEventIds'); }
  /** getSeasonPBPSummary(playerId, season, seasontype) → {Promise<import('./types').SeasonPBPSummary|null>}
   *  team on-court averages (USG%/AST%/PER) + team-boxscore averages (Win Shares), reconstructed
   *  from per-game PBP where the source has no season-level on-court endpoint. null when no PBP
   *  games were found. A provider with a real on-court/boxscore endpoint can skip the
   *  per-game reconstruction and return the same shape directly. */
  getSeasonPBPSummary() { return this._notImplemented('getSeasonPBPSummary'); }
  /** getPlayerSeasonRatings(playerId, season, seasontype) → {Promise<import('./types').PlayerSeasonRatings|null>}
   *  Off/Def/Net Rating + PIE for one player-season, straight from the source's own season-level
   *  advanced-stats endpoint (no box-score reconstruction, unlike getSeasonPBPSummary above). BDL-only
   *  -- no ESPN equivalent exists, so a provider without it returns null rather than throwing, same
   *  posture as getPlayerShotChart. */
  getPlayerSeasonRatings() { return this._notImplemented('getPlayerSeasonRatings'); }

  /** getPlayerSeasonClutch(playerId, season, seasontype) → {Promise<import('./types').PlayerSeasonClutch|null>}
   *  Base box score (PTS/REB/AST/etc, per-game) filtered to clutch situations only. BDL-only -- no
   *  ESPN equivalent exists, same graceful-degradation posture as getPlayerSeasonRatings above. */
  getPlayerSeasonClutch() { return this._notImplemented('getPlayerSeasonClutch'); }

  /** getPlayerSeasonScoringDistribution(playerId, season, seasontype) → {Promise<import('./types').PlayerSeasonScoringDistribution|null>}
   *  Percentage-of-points breakdown (2PT/3PT/FT split, paint/mid-range/fastbreak/off-turnovers share,
   *  assisted-vs-unassisted for 2PM/3PM) for one player-season. BDL-only -- no ESPN equivalent
   *  exists, same graceful-degradation posture as getPlayerSeasonRatings above. */
  getPlayerSeasonScoringDistribution() { return this._notImplemented('getPlayerSeasonScoringDistribution'); }

  /** getPlayerSeasonUsageShare(playerId, season, seasontype) → {Promise<import('./types').PlayerSeasonUsageShare|null>}
   *  Share of the TEAM's rebounds/assists/steals/blocks/turnovers/FGA/FGM/FTA/FTM/fouls (drawn and
   *  committed) this player accounted for while on the floor, plus BDL's own overall usage rate.
   *  BDL-only -- no ESPN equivalent exists, same graceful-degradation posture as
   *  getPlayerSeasonRatings above. */
  getPlayerSeasonUsageShare() { return this._notImplemented('getPlayerSeasonUsageShare'); }

  /** getPlayerSeasonDefense(playerId, season, seasontype) → {Promise<import('./types').PlayerSeasonDefense|null>}
   *  Raw defensive box (blocks/steals/def rebounds per game), BDL's own DREB%/Defensive Rating/
   *  Defensive Win Shares, and opponent-points-allowed by category (paint/fastbreak/off-turnovers/
   *  2nd-chance) while this player was on the floor. BDL-only -- no ESPN equivalent exists, same
   *  graceful-degradation posture as getPlayerSeasonRatings above. */
  getPlayerSeasonDefense() { return this._notImplemented('getPlayerSeasonDefense'); }

  // --- League-wide stats (percentile system) ---
  /** getLeagueStatLines(season, mode) → normalized {pos, PTS, ...} entries for qualified players. */
  getLeagueStatLines() { return this._notImplemented('getLeagueStatLines'); }
  /** getLeagueReboundFoulStats(season) → [{pos, gp, mpg, OREB, DREB, PF}] for distribution enrichment. */
  getLeagueReboundFoulStats() { return this._notImplemented('getLeagueReboundFoulStats'); }
  /** getPlayerSeasonAverages(playerId) → { pos, statsByModeBySeason: {[year]:{PerGame,Totals,Per36}} } | null. */
  getPlayerSeasonAverages() { return this._notImplemented('getPlayerSeasonAverages'); }
  /** getLeaguePlayerIndex(seasons) → deduped [{id, name, position, headshot}] for the search index. */
  getLeaguePlayerIndex() { return this._notImplemented('getLeaguePlayerIndex'); }

  // --- Active players (source-neutral: list/look up the current player pool) ---
  /** getActivePlayers() → import('./types').RosterPlayer[] for the current pool (active-player search). */
  getActivePlayers() { return this._notImplemented('getActivePlayers'); }
  /** findActivePlayer(id) → the active player's record, or undefined. */
  findActivePlayer() { return this._notImplemented('findActivePlayer'); }
}

module.exports = { SportsDataProvider, NotImplementedError };
