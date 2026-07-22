// Per-route JSON-LD for Google rich snippets. Separate from pageMeta.js's static <script> in
// index.html (that one's a fixed, site-wide WebSite block) — this one is swapped per route via a
// single dedicated <script id="page-jsonld">, overwritten rather than appended so SPA navigation
// doesn't accumulate stale tags.

export function setStructuredData(obj) {
  let tag = document.getElementById('page-jsonld');
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'page-jsonld';
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(obj);
}

export function clearStructuredData() {
  document.getElementById('page-jsonld')?.remove();
}
