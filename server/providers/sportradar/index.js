// Sportradar provider stub. Every interface method inherits the throwing default from
// SportsDataProvider, so selecting STATS_PROVIDER=sportradar boots the app and fails loudly with
// NotImplementedError on the first data call. That is intentional: until the real Sportradar port
// lands, this stub is the leak detector — if any consumer "works" under it, that consumer is still
// reaching past the provider boundary and must be fixed.

const { SportsDataProvider } = require('../SportsDataProvider');

class SportradarProvider extends SportsDataProvider {
  get name() { return 'sportradar'; }
}

module.exports = new SportradarProvider();
