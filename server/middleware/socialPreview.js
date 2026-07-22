// Server-rendered <meta> tags for link-preview crawlers only (Facebook, Twitter/X, Slack,
// Discord, LinkedIn, WhatsApp, Telegram, Reddit). Those bots don't execute JavaScript, so the
// per-route title/description/canonical that pageMeta.js sets client-side is invisible to them —
// every shared link would show the static index.html defaults regardless of which player/team
// it's for. This intercepts only requests from those known bot user-agents and serves a minimal
// HTML document with the real per-page meta tags; everyone else (including Googlebot, which does
// execute JS) falls through to the normal SPA untouched. See docs/design/seo.md.

const { getProvider }          = require('../providers');
const { LEGACY_DEFUNCT_TEAMS } = require('../constants/legacyTeamRosters');
const { LEGACY_PLAYERS_BULK }  = require('../constants/legacyPlayerBulk');

const SITE = 'https://knowthew.net';

const BOT_UA = /facebookexternalhit|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|redditbot|SkypeUriPreview|Pinterest/i;

const PLAYER_PATH = /^\/player\/([^/]+)(?:\/[^/]+)?\/?$/;
const TEAM_PATH   = /^\/team\/([^/]+)(?:\/[^/]+)?\/?$/;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMetaPage({ title, description, image, url }) {
  const imageTags = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" />\n    <meta name="twitter:card" content="summary_large_image" />`
    : `<meta name="twitter:card" content="summary" />`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:site_name" content="KnowTheW" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    ${imageTags}
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  </head>
  <body></body>
</html>`;
}

// Active players come from the in-memory roster cache (sync); retired-but-ESPN-known players are
// a live fetch; pre-2002 players only exist in the static legacy bulk data (no headshot on file).
async function lookupPlayer(id) {
  const active = getProvider().findActivePlayer(id);
  if (active) return { name: active.name, position: active.positionName || active.position, headshot: active.headshot };

  const retired = await getProvider().getRetiredPlayer(id).catch(() => null);
  if (retired) return { name: retired.name, position: retired.positionName || retired.position, headshot: retired.headshot };

  const legacy = LEGACY_PLAYERS_BULK[id];
  if (legacy) return { name: legacy.name, position: legacy.position, headshot: null };

  return null;
}

async function lookupTeam(slug) {
  const teams = await getProvider().getTeams();
  const active = teams.find(t => t.slug === slug);
  if (active) return { name: active.name, logo: active.logo };

  const defunct = Object.values(LEGACY_DEFUNCT_TEAMS).find(t => t.id === slug);
  if (defunct) return { name: defunct.name, logo: null };

  return null;
}

module.exports = async function socialPreview(req, res, next) {
  const ua = req.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return next();

  try {
    const playerMatch = PLAYER_PATH.exec(req.path);
    if (playerMatch) {
      const player = await lookupPlayer(decodeURIComponent(playerMatch[1]));
      if (!player) return next();
      return res.type('html').send(renderMetaPage({
        title: `${player.name} — KnowTheW`,
        description: `${player.name}${player.position ? ` (${player.position})` : ''} stats and analytics on KnowTheW.`,
        image: player.headshot,
        url: `${SITE}${req.path}`,
      }));
    }

    const teamMatch = TEAM_PATH.exec(req.path);
    if (teamMatch) {
      const team = await lookupTeam(decodeURIComponent(teamMatch[1]));
      if (!team) return next();
      return res.type('html').send(renderMetaPage({
        title: `${team.name} — KnowTheW`,
        description: `${team.name} roster, stats, and history on KnowTheW.`,
        image: team.logo,
        url: `${SITE}${req.path}`,
      }));
    }

    return next();
  } catch (err) {
    console.error('socialPreview:', err.message);
    return next();
  }
};
