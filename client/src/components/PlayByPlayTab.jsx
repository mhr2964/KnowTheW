import { useEffect, useRef, useState } from 'react';
import BrefTable from './BrefTable';

// Column groupings matching the BBRef PBP table layout.
// FoulDrawnOff and Blkd render as — under ESPN (provider returns null); will populate when Sportradar lands.
const HEADER_GROUPS = [
  { label: '',                  span: 5 }, // Season, Tm, Age, G, MP
  { label: '+/- Per 100 Poss',  span: 2 }, // OnCourt, On-Off
  { label: 'Turnovers',         span: 2 }, // BadPass, LostBall
  { label: 'Fouls Committed',   span: 2 }, // FCShoot, FCOff
  { label: 'Fouls Drawn',       span: 2 }, // FDShoot, FDOff
  { label: 'Misc.',             span: 3 }, // PGA, And1, Blkd
];

// Human-readable column labels for PBP_TABLE_HEADERS keys.
const COL_LABELS = {
  SEASON_ID:         'Season',
  TEAM_ABBREVIATION: 'Tm',
  AGE:               'Age',
  GP:                'G',
  MIN:               'MP',
  ON_COURT:          'OnCourt',
  ON_OFF:            'On-Off',
  BAD_PASS:          'BadPass',
  LOST_BALL:         'LostBall',
  FOUL_COMMIT_SHOOT: 'FCShoot',
  FOUL_COMMIT_OFF:   'FCOff',
  FOUL_DRAWN_SHOOT:  'FDShoot',
  FOUL_DRAWN_OFF:    'FDOff',
  PGA:               'PGA',
  AND1:              'And1',
  BLKD:              'Blkd',
};

// Fetches one season at a time (current season first, per availableSeasons' order) rather than one
// all-seasons request -- a long career's all-in-one PBP computation needs hundreds of live
// BallDontLie requests and is structurally unable to finish inside Heroku's 30s router timeout
// (confirmed live, 2026-08-19). Each season's request stays small enough to land on its own; the
// career row is assembled from the accumulated rows via a pure (no-provider-calls) endpoint once
// every season has resolved.
export default function PlayByPlayTab({ playerId, availableSeasons }) {
  const exportRef = useRef(null);
  const [headers, setHeaders] = useState(null);
  const [rows, setRows] = useState([]);
  const [careerRow, setCareerRow] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'partial' | 'done' | 'error' | 'empty'
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!availableSeasons?.length) return undefined;
    let cancelled = false;
    setHeaders(null);
    setRows([]);
    setCareerRow(null);
    setStatus('loading');

    (async () => {
      const collected = [];
      let anyFailed = false;

      for (const season of availableSeasons) {
        if (cancelled) return;
        try {
          const r = await fetch(`/api/players/${playerId}/pbp-table/season/${season}`);
          if (r.ok) {
            const d = await r.json();
            collected.push(d.row);
            if (!cancelled) {
              setHeaders(h => h ?? d.headers);
              setRows([...collected]);
            }
          } else if (r.status !== 404) {
            anyFailed = true; // 404 just means no PBP for that season -- not a failure
          }
        } catch {
          anyFailed = true;
        }
      }
      if (cancelled) return;

      if (!collected.length) {
        // Every season came back 404 (no usable PBP, e.g. <5 games each) vs a real fetch failure --
        // the former isn't an error, it just means this player has nothing to show yet.
        setStatus(anyFailed ? 'error' : 'empty');
        return;
      }

      try {
        const r = await fetch(`/api/players/${playerId}/pbp-table/career-row`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: collected }),
        });
        if (r.ok && !cancelled) setCareerRow((await r.json()).careerRow);
      } catch {
        // Career row is a nice-to-have summary; the season rows above are still fully usable without it.
      }

      if (!cancelled) setStatus(anyFailed ? 'partial' : 'done');
    })();

    return () => { cancelled = true; };
  }, [playerId, availableSeasons, retryCount]);

  if (status === 'error') return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load play-by-play stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => setRetryCount(c => c + 1)}>Try again</button>
    </p>
  );

  if (status === 'empty') return (
    <p className="stats-na">Not enough play-by-play data to build a season table (need 5+ games per season).</p>
  );

  if (!headers) return <p className="status-msg" style={{ padding: '1rem 0' }}>Loading play-by-play stats…</p>;

  const displayHeaders = headers.map(h => COL_LABELS[h] ?? h);
  const isLoadingMore = status === 'loading';

  return (
    <>
      <div className="bref-toolbar">
        <button type="button" className="btn-ghost bref-export-btn" onClick={() => exportRef.current?.()}>
          Export CSV
        </button>
      </div>
      <BrefTable
        headerGroups={HEADER_GROUPS}
        regular={{ headers: displayHeaders, rows }}
        career={careerRow ? { headers: displayHeaders, rows: [careerRow] } : null}
        exportRef={exportRef}
      />
      {isLoadingMore && (
        <p className="status-msg" style={{ padding: '0.75rem 0' }}>
          Loading rest of career… ({rows.length}/{availableSeasons.length} seasons)
        </p>
      )}
      {status === 'partial' && (
        <p className="status-msg" style={{ padding: '0.75rem 0' }}>
          Some seasons could not be loaded.{' '}
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={() => setRetryCount(c => c + 1)}>Retry</button>
        </p>
      )}
    </>
  );
}
