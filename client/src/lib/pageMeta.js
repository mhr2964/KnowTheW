// Per-route <title>/<meta description>/<meta robots> updates for this SPA. No react-helmet: the
// app already hand-rolled a document.title-per-page effect (PlayerRoutePage/TeamPage/ComparePage);
// this extends that same pattern to description + robots instead of adding a new dependency/layer.

const DEFAULT_TITLE = 'KnowTheW';
const DEFAULT_DESCRIPTION = 'WNBA player and team stats, advanced analytics, and historical data back to the league’s 1997 founding.';

export function setPageMeta(title, description, { noindex = false } = {}) {
  document.title = title;

  const descTag = document.querySelector('meta[name="description"]');
  if (descTag) descTag.setAttribute('content', description);

  // No server-rendered per-route HTML exists to carry a correct <link rel="canonical"> — set it
  // here instead of statically in index.html, or every route would canonicalize to "/".
  let canonicalTag = document.querySelector('link[rel="canonical"]');
  if (!canonicalTag) {
    canonicalTag = document.createElement('link');
    canonicalTag.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalTag);
  }
  canonicalTag.setAttribute('href', `${window.location.origin}${window.location.pathname}`);

  let robotsTag = document.querySelector('meta[name="robots"]');
  if (noindex) {
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.setAttribute('name', 'robots');
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute('content', 'noindex, follow');
  } else if (robotsTag) {
    robotsTag.remove();
  }
}

export function resetPageMeta() {
  setPageMeta(DEFAULT_TITLE, DEFAULT_DESCRIPTION);
}
