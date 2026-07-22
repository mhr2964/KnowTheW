const express = require('express');
const router  = express.Router();

const { getProvider }        = require('../providers');
const { LEGACY_DEFUNCT_TEAMS } = require('../constants/legacyTeamRosters');
const { LEGACY_PLAYERS_BULK }  = require('../constants/legacyPlayerBulk');

const SITE = 'https://knowthew.net';

// Same TTL/shape as the ESPN client's own team cache (client.js TEAMS_TTL_MS) — the sitemap is
// rebuilt at most this often, so a crawler hitting it repeatedly doesn't force a fresh roster
// walk across all 12 teams on every request.
const SITEMAP_TTL_MS = 6 * 60 * 60 * 1000;
let cache = null;      // { xml, at }

const STATIC_PATHS = ['/', '/about', '/data-sources', '/privacy', '/terms'];
const TEAM_SUBPATHS = ['', '/roster', '/stats', '/history', '/schedule'];

function urlEntry(loc, { changefreq, priority } = {}) {
  return `<url><loc>${SITE}${loc}</loc>${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}${priority ? `<priority>${priority}</priority>` : ''}</url>`;
}

// Active teams + rosters come from the ESPN provider's startup-prefetched in-memory caches
// (see providers/espn/index.js getActivePlayers doc comment) — no live ESPN calls made here.
// Defunct-franchise teams and 1997-2001 legacy players are static in-process constants, also free.
// Retired (2002+) players sitting only in the MongoDB playerIndex collection aren't enumerated yet
// — see docs/design/seo.md for why that's deferred rather than included here.
async function buildSitemap() {
  const urls = [...STATIC_PATHS.map(p => urlEntry(p, { changefreq: 'monthly', priority: p === '/' ? '1.0' : '0.5' }))];

  const activeTeams = await getProvider().getTeams();
  for (const team of activeTeams) {
    for (const sub of TEAM_SUBPATHS) {
      urls.push(urlEntry(`/team/${team.slug}${sub}`, { changefreq: 'weekly', priority: sub === '' ? '0.8' : '0.6' }));
    }
  }
  for (const defunct of Object.values(LEGACY_DEFUNCT_TEAMS)) {
    for (const sub of TEAM_SUBPATHS) {
      urls.push(urlEntry(`/team/${defunct.id}${sub}`, { changefreq: 'yearly', priority: '0.3' }));
    }
  }

  const activePlayers = getProvider().getActivePlayers();
  for (const player of activePlayers) {
    urls.push(urlEntry(`/player/${player.id}`, { changefreq: 'weekly', priority: '0.7' }));
  }
  for (const id of Object.keys(LEGACY_PLAYERS_BULK)) {
    urls.push(urlEntry(`/player/${id}`, { changefreq: 'yearly', priority: '0.4' }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  // Active-roster prefetch (providers/espn/client.js) can still be mid-flight for a few dozen
  // seconds right after a dyno boots (every deploy restarts it). Report readiness so the caller
  // can avoid locking an incomplete sitemap in for a full TTL window.
  return { xml, activePlayersReady: activePlayers.length > 0 };
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (!cache || Date.now() - cache.at > SITEMAP_TTL_MS) {
      const built = await buildSitemap();
      // Only cache once the roster prefetch has actually populated active players — otherwise
      // serve this one-off result without locking it in, so the next hit retries the build.
      if (built.activePlayersReady) cache = { xml: built.xml, at: Date.now() };
      return res.type('application/xml').send(built.xml);
    }
    res.type('application/xml').send(cache.xml);
  } catch (err) {
    console.error('sitemap.xml:', err.message);
    // Serve a stale cached copy rather than a hard failure if one exists (matches withTtlCache's
    // stale-on-error pattern elsewhere in the codebase); otherwise a crawler gets a clean 503, not junk XML.
    if (cache) return res.type('application/xml').send(cache.xml);
    res.status(503).end();
  }
});

module.exports = router;
