// Shared getSeasonPBPSummary aggregation, extracted from server/providers/espn/index.js so both
// the ESPN and BallDontLie providers use one implementation. Pure aggregation over per-game
// {fetched, onCourt, boxscore} results -- no source-specific logic once you have those, so it
// belongs here rather than duplicated in each provider (see docs/design/provider-architecture.md's
// "getSeasonPBPSummary boundary" note: raw per-game PBP looping stays inside provider code, but the
// reduction itself doesn't care which provider produced the per-game results).

const { PBP_OC_KEYS } = require('./types');

// eventIds: opaque per-provider ids (already resolved for the right source by the caller).
// fetchOne: async (eventId) => {fetched, onCourt, boxscore} -- typically `id => provider.getGamePbpStats(id, playerId)`.
async function aggregatePBPSummary(eventIds, fetchOne) {
  if (!eventIds?.length) return null;

  const pbpResults = await Promise.all(eventIds.map(fetchOne));
  const fetchedCount = pbpResults.filter(r => r.fetched).length;
  const totOC = Object.fromEntries(PBP_OC_KEYS.map(k => [k, 0]));
  const totTm = { fga: 0, fgm: 0, fg3m: 0, fta: 0, ftm: 0, pts: 0, orb: 0, drb: 0, tov: 0, ast: 0 };
  let pbpGames = 0, wsGames = 0;

  for (const r of pbpResults) {
    if (!r.fetched) continue;
    const oc = r.onCourt;
    if (!oc) continue;
    pbpGames++;
    for (const k of PBP_OC_KEYS) totOC[k] += oc[k];

    const gs = r.boxscore;
    if (gs) {
      wsGames++;
      for (const k of Object.keys(totTm)) totTm[k] += gs.tm[k] ?? 0;
    }
  }
  if (!pbpGames) return null;

  const g = pbpGames;
  const tmOC = {
    fgaPg:   totOC.fga  / g, fgmPg:   totOC.fgm  / g,
    fg3aPg:  totOC.fg3a / g, ftaPg:   totOC.fta  / g, ftmPg:  totOC.ftm / g,
    orbPg:   totOC.orb  / g, drbPg:   totOC.drb  / g,
    tovPg:   totOC.tov  / g, astPg:   totOC.ast  / g,
    oFgaPg:  totOC.oFga  / g, oFgmPg: totOC.oFgm  / g,
    oFg3aPg: totOC.oFg3a / g, oFtaPg: totOC.oFta  / g,
    oOrbPg:  totOC.oOrb  / g, oDrbPg: totOC.oDrb  / g,
    oTovPg:  totOC.oTov  / g,
  };

  const tmForWS = wsGames > 0 ? {
    fgaPg:  totTm.fga  / wsGames,
    fgmPg:  totTm.fgm  / wsGames,
    fg3mPg: totTm.fg3m / wsGames,
    ftaPg:  totTm.fta  / wsGames,
    ftmPg:  totTm.ftm  / wsGames,
    ptsPg:  totTm.pts  / wsGames,
    orbPg:  totTm.orb  / wsGames,
    drbPg:  totTm.drb  / wsGames,
    tovPg:  totTm.tov  / wsGames,
    astPg:  totTm.ast  / wsGames,
  } : null;

  const complete = fetchedCount === eventIds.length;
  return { tmOC, tmForWS, pbpGames, complete };
}

module.exports = { aggregatePBPSummary };
