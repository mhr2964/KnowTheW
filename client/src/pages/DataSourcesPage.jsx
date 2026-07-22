import { useEffect } from 'react';
import LegalFooterNav from '../components/LegalFooterNav';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function DataSourcesPage() {
  useEffect(() => {
    setPageMeta('Data Sources & Attribution — KnowTheW', 'Where KnowTheW’s WNBA stats come from: ESPN for 2002-present, a Basketball-Reference-derived dataset for 1997-2001.');
    return resetPageMeta;
  }, []);

  return (
    <div className="legal-page">
      <h1>Data Sources &amp; Attribution</h1>
      <p className="legal-updated">Last updated: July 2026</p>

      <p>
        KnowTheW does not collect its own play-by-play or box score data. All stats displayed
        on this site are drawn from publicly available WNBA statistics, normalized and cached
        for analysis. This page explains where each part of the dataset comes from.
      </p>

      <h2>Current-era stats (2002–present)</h2>
      <p>
        Season stats, game logs, and box scores for the modern era are sourced from ESPN&apos;s
        publicly viewable WNBA statistics. Numbers are cached and refreshed periodically
        rather than fetched live on every page view.
      </p>

      <h2>Historical stats (1997–2001)</h2>
      <p>
        Early-era WNBA stats predate consistent modern digital box scores. This range was
        compiled from a historical dataset originally assembled by FiveThirtyEight, itself
        derived from Basketball-Reference&apos;s WNBA archives, supplemented in places with
        publicly available biographical detail (e.g. Wikipedia) for players whose per-game
        splits weren&apos;t otherwise available.
      </p>

      <h2>Facts, not proprietary content</h2>
      <p>
        Statistics — points scored, rebounds, game results, and the like — are factual records
        of what happened on the court. KnowTheW&apos;s own contribution is the normalization,
        analysis, and presentation layered on top of those facts: percentile-based playstyle
        fingerprints, archetype classification, AI-assisted comparisons, and the study tools
        built around them.
      </p>

      <h2>Not officially affiliated</h2>
      <p>
        KnowTheW is an independent, unofficial reference site. It is not affiliated with,
        endorsed by, or operated on behalf of the WNBA, any WNBA team, or any data provider
        referenced above. Team and player names/logos are used only for factual identification.
      </p>

      <h2>Corrections</h2>
      <p>
        If you spot an error in the underlying data, let us know at{' '}
        <a href="mailto:mhr2964@g.rit.edu">mhr2964@g.rit.edu</a> and we&apos;ll look into it.
      </p>

      <LegalFooterNav current="/data-sources" />
    </div>
  );
}
