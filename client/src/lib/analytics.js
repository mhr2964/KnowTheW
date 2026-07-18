// Google Analytics 4 (gtag.js). No-ops if VITE_GA_MEASUREMENT_ID isn't set, so local dev/test
// never sends real events. Route-change tracking needs no code here: GA4's Enhanced Measurement
// ("Page changes based on browser history events", enabled per-property in the GA4 Admin UI)
// listens for the History API pushState/replaceState calls React Router already makes.
export function initAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!id) return;

  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(loader);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}
