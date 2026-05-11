import { fmt } from './BrefTable';
import HeaderTooltip from './HeaderTooltip';
import { LABELS } from '../lib/statsColumns';
import { STAT_DEFINITIONS } from '../lib/statDefinitions';

const EM = '—';

function CellStack({ mapA, mapB, colKey, leader, isCareer }) {
  const presentA = mapA !== null;
  const presentB = mapB !== null;

  if (colKey === 'SEASON_ID') {
    const val = mapA?.['SEASON_ID'] ?? mapB?.['SEASON_ID'] ?? EM;
    return <span className="compare-cell-single">{isCareer ? 'Career' : String(val)}</span>;
  }

  if (colKey === 'TEAM_ABBREVIATION') {
    const teamA = presentA ? (fmt(colKey, mapA?.['TEAM_ABBREVIATION']) || EM) : EM;
    const teamB = presentB ? (fmt(colKey, mapB?.['TEAM_ABBREVIATION']) || EM) : EM;
    return (
      <div className="compare-cell-stack">
        <span className={`compare-cell-a${leader === 'a' ? ' compare-leader' : ''}`}>{isCareer ? EM : teamA}</span>
        <span className="compare-cell-divider" />
        <span className={`compare-cell-b${leader === 'b' ? ' compare-leader' : ''}`}>{isCareer ? EM : teamB}</span>
      </div>
    );
  }

  const valA = presentA ? fmt(colKey, mapA?.[colKey]) : EM;
  const valB = presentB ? fmt(colKey, mapB?.[colKey]) : EM;

  return (
    <div className="compare-cell-stack">
      <span className={`compare-cell-a${leader === 'a' ? ' compare-leader' : ''}`}>{valA}</span>
      <span className="compare-cell-divider" />
      <span className={`compare-cell-b${leader === 'b' ? ' compare-leader' : ''}`}>{valB}</span>
    </div>
  );
}

export default function CompareTable({ headers, mergedRows, mergedCareerRow, loadingA, loadingB, errorA, errorB }) {
  const bothLoading = loadingA && loadingB;
  const oneErrored = !!(errorA || errorB);

  if (bothLoading) {
    return <div className="compare-table-skeleton">Loading stats…</div>;
  }

  if (!headers?.length) return null;

  // SEASON_ID is always first; TEAM_ABBREVIATION second if present
  const cols = headers.map(h => ({ key: h, label: LABELS[h] ?? h }));

  return (
    <div>
      {oneErrored && (
        <p className="compare-table-error-banner">
          {errorA && !errorB && 'Player A stats unavailable — showing Player B only.'}
          {errorB && !errorA && 'Player B stats unavailable — showing Player A only.'}
          {errorA && errorB && 'Could not load stats for either player.'}
        </p>
      )}
      <div className="bref-wrap compare-merged-table">
        <table className="bref-table">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} className={c.key === 'SEASON_ID' ? 'compare-sticky-col' : c.key === 'TEAM_ABBREVIATION' ? 'compare-team-col' : ''}>
                  {c.key === 'SEASON_ID' || c.key === 'TEAM_ABBREVIATION'
                    ? <span>{c.label}</span>
                    : <HeaderTooltip label={c.label} definition={STAT_DEFINITIONS[c.key]} />
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mergedRows.map(merged => (
              <tr key={merged.seasonId}>
                {cols.map(c => (
                  <td
                    key={c.key}
                    className={[
                      c.key === 'SEASON_ID' ? 'td-l compare-sticky-col' : '',
                      c.key === 'TEAM_ABBREVIATION' ? 'td-l compare-team-col' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    <CellStack
                      mapA={merged.a.row}
                      mapB={merged.b.row}
                      colKey={c.key}
                      leader={merged.leaders?.[c.key] ?? null}
                      isCareer={false}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {mergedCareerRow && (
              <tr className="career-row compare-career-row">
                {cols.map(c => (
                  <td
                    key={c.key}
                    className={[
                      c.key === 'SEASON_ID' ? 'td-l compare-sticky-col' : '',
                      c.key === 'TEAM_ABBREVIATION' ? 'td-l compare-team-col' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    <CellStack
                      mapA={mergedCareerRow.a.row}
                      mapB={mergedCareerRow.b.row}
                      colKey={c.key}
                      leader={mergedCareerRow.leaders?.[c.key] ?? null}
                      isCareer={true}
                    />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
