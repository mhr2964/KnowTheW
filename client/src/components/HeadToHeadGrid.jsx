import { useMemo } from 'react';
import useLazyFetch from '../hooks/useLazyFetch';
import { getCurrentSeason } from '../lib/currentSeason';
import { buildHeadToHeadMatrix } from '../lib/headToHead';

// Full head-to-head matrix -- every team's regular-season record against every other team, in one
// grid. bbref's "Expanded Standings" shows this as a Vs. column per opponent; this site had no
// equivalent (only a single-matchup lookup was ever queued, never a full grid) until this reused the
// same /api/league/schedule data ScheduleHubPage already pulls -- no new endpoint needed.
export default function HeadToHeadGrid({ teams }) {
  const season = getCurrentSeason();
  const { data, loading, error } = useLazyFetch(`/api/league/schedule?season=${season}`, true);

  const activeAbbrs = useMemo(
    () => teams.filter(t => !t.defunct).map(t => t.abbreviation).sort(),
    [teams]
  );
  const matrix = useMemo(() => buildHeadToHeadMatrix(data?.games), [data]);

  if (loading || !data) return <p className="status-msg">Loading head-to-head records...</p>;
  if (error) return <p className="status-msg error">Could not load head-to-head records.</p>;

  return (
    <div className="standings-group">
      <h2 className="section-title">Head-to-Head</h2>
      <p className="status-msg" style={{ padding: '0 0 0.75rem', textAlign: 'left' }}>
        Regular-season record for the row team against each opponent, {season}.
      </p>
      <div className="standings-table-wrap">
        <table className="standings-table h2h-table">
          <thead>
            <tr>
              <th className="standings-col-team">Team</th>
              {activeAbbrs.map(abbr => <th key={abbr}>{abbr}</th>)}
            </tr>
          </thead>
          <tbody>
            {activeAbbrs.map(rowAbbr => (
              <tr key={rowAbbr}>
                <td className="standings-col-team">{rowAbbr}</td>
                {activeAbbrs.map(colAbbr => {
                  if (colAbbr === rowAbbr) return <td key={colAbbr} className="h2h-cell-self">—</td>;
                  const cell = matrix.get(rowAbbr)?.get(colAbbr);
                  return <td key={colAbbr}>{cell ? `${cell.w}-${cell.l}` : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
