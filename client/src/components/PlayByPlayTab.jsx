import useLazyFetch from '../hooks/useLazyFetch';
import BrefTable from './BrefTable';

// Column groupings matching the BBRef PBP table layout.
// Note: FoulDrawnOff and Blkd are not available in ESPN WNBA PBP data.
const HEADER_GROUPS = [
  { label: '',                  span: 5 }, // Season, Tm, Age, G, MP
  { label: '+/- Per 100 Poss',  span: 2 }, // OnCourt, On-Off
  { label: 'Turnovers',         span: 2 }, // BadPass, LostBall
  { label: 'Fouls Committed',   span: 2 }, // FCShoot, FCOff
  { label: 'Fouls Drawn',       span: 1 }, // FDShoot only
  { label: 'Misc.',             span: 2 }, // PGA, And1
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
  PGA:               'PGA',
  AND1:              'And1',
};

export default function PlayByPlayTab({ playerId }) {
  const { data, loading, error, refetch } = useLazyFetch(
    `/api/players/${playerId}/pbp-table`,
    true
  );

  if (loading) return <p className="status-msg" style={{ padding: '1rem 0' }}>Loading play-by-play stats… (fetching all seasons)</p>;

  if (error) return (
    <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      Could not load play-by-play stats.
      <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
    </p>
  );

  if (!data) return null;

  if (!data.regular?.rows?.length) {
    return <p className="stats-na">Not enough play-by-play data to build a season table (need 5+ games per season).</p>;
  }

  const displayHeaders = data.headers.map(h => COL_LABELS[h] ?? h);

  return (
    <BrefTable
      headerGroups={HEADER_GROUPS}
      regular={{ headers: displayHeaders, rows: data.regular.rows }}
      career={data.regular.careerRow ? { headers: displayHeaders, rows: [data.regular.careerRow] } : null}
    />
  );
}
