import { useRef } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';
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

export default function PlayByPlayTab({ playerId, availableSeasons }) {
  const exportRef = useRef(null);
  const currentSeason = availableSeasons?.[0];

  // Fast path: just the current season, so it's on screen before the full multi-season fetch
  // (which live-fetches every prior season's games) finishes. Superseded by `full` once it lands.
  const { data: current } = useLazyFetch(
    `/api/players/${playerId}/pbp-table/season/${currentSeason}`,
    !!currentSeason
  );

  const { data: full, error, refetch } = useLazyFetch(
    `/api/players/${playerId}/pbp-table`,
    true
  );

  if (error) return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load play-by-play stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
    </p>
  );

  const headers = full?.headers ?? current?.headers;
  if (!headers) {
    return <p className="status-msg" style={{ padding: '1rem 0' }}>Loading play-by-play stats…</p>;
  }
  const displayHeaders = headers.map(h => COL_LABELS[h] ?? h);

  // Full career table ready: render it same as before, career row included.
  if (full) {
    if (!full.regular?.rows?.length) {
      return <p className="stats-na">Not enough play-by-play data to build a season table (need 5+ games per season).</p>;
    }
    return (
      <>
        <div className="bref-toolbar">
          <button type="button" className="btn-ghost bref-export-btn" onClick={() => exportRef.current?.()}>
            Export CSV
          </button>
        </div>
        <BrefTable
          headerGroups={HEADER_GROUPS}
          regular={{ headers: displayHeaders, rows: full.regular.rows }}
          career={full.regular.careerRow ? { headers: displayHeaders, rows: [full.regular.careerRow] } : null}
          exportRef={exportRef}
        />
      </>
    );
  }

  // Current season only, while the rest of the career loads in behind it.
  return (
    <>
      <BrefTable
        headerGroups={HEADER_GROUPS}
        regular={{ headers: displayHeaders, rows: [current.row] }}
        career={null}
      />
      <p className="status-msg" style={{ padding: '0.75rem 0' }}>Loading rest of career…</p>
    </>
  );
}
