// Flips a provider's generic home/away odds shape (see SportsDataProvider.js's getGameOdds doc --
// this shape is the general provider contract, not BDL-specific) to one team's own side. Pulled
// out of routes/teams.js as a pure function so the home/away swap itself is unit-testable without
// a network call or a provider-agnostic-route-layer import of a specific provider's internals.
function orientOddsForTeam(raw, isHome) {
  if (!raw) return null;
  return {
    vendor: raw.vendor,
    spread: isHome ? raw.spread.home : raw.spread.away,
    moneyline: isHome ? raw.moneyline.home : raw.moneyline.away,
    total: raw.total.value,
    totalOver: raw.total.over,
    totalUnder: raw.total.under,
  };
}

module.exports = { orientOddsForTeam };
