import { useRef } from 'react';
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

// Purely a display component -- the actual season-by-season fetch runs in usePlayerBackgroundStats
// (see DetailedStats.jsx), started as soon as the player page loads rather than gated behind this
// tab being clicked. `data`/`totalSeasons`/`retry` are that hook's shared state, so re-opening this
// tab doesn't re-fetch anything already in flight or done.
export default function PlayByPlayTab({ data, totalSeasons, retry }) {
  const exportRef = useRef(null);
  const { headers, rows, careerRow, status, timedOutSeasons } = data;

  if (status === 'error') return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load play-by-play stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
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
          Loading rest of career… ({rows.length}/{totalSeasons} seasons)
        </p>
      )}
      {status === 'partial' && (
        <p className="status-msg" style={{ padding: '0.75rem 0' }}>
          {timedOutSeasons?.length
            ? `${timedOutSeasons.join(', ')} timed out and could not be loaded.`
            : 'Some seasons could not be loaded.'}{' '}
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Retry</button>
        </p>
      )}
    </>
  );
}
