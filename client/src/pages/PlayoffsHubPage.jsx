import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';
import { buildTeamLogoMap, buildTeamNameMap } from '../lib/teamLookup';
import { groupIntoSeries } from '../lib/playoffSeries';
import { formatDateMonthDay as formatDate } from '../lib/dateFormat';

// Same BDL floor as Schedule Hub (this page is built on the same /api/league/schedule endpoint,
// filtered to postseason).
const PLAYOFFS_MIN_SEASON = 2008;

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= PLAYOFFS_MIN_SEASON; y--) years.push(y);
  return years;
}

// Series are grouped client-side from the season's raw postseason games (see playoffSeries.js) --
// no round labels are shown, since BDL's game data has no round field to draw them from honestly.
//
// season lives in the URL, not local state -- see ScheduleHubPage.jsx's header comment for why
// (browser Back after opening a game's box score must restore the selected season, not reset it).
export default function PlayoffsHubPage({ teams }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSeason = parseInt(searchParams.get('season'), 10);
  const season = Number.isFinite(rawSeason) ? rawSeason : getCurrentSeason();
  const setSeason = (y) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('season', String(y));
    return next;
  });
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);
  const nameByAbbr = useMemo(() => buildTeamNameMap(teams), [teams]);

  useEffect(() => {
    setPageMeta('Playoffs — KnowTheW', 'WNBA playoff results by season, grouped into series.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch(`/api/league/schedule?season=${season}&postseason=true`, true);
  const series = useMemo(() => groupIntoSeries(data?.games), [data]);

  return (
    <>
      <h1>Playoffs</h1>
      <p className="status-msg">Postseason results by season, grouped into series. Click a game for the box score.</p>

      <div className="stat-season-bar" style={{ marginBottom: '1rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <p className="status-msg">Loading playoff results...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load playoff results.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && series.length === 0 && (
        <p className="status-msg">No playoff games found for {season} yet.</p>
      )}

      {!loading && !error && series.map(s => {
        const [teamA, teamB] = s.teams;
        const winner = s.complete
          ? Object.entries(s.wins).sort((a, b) => b[1] - a[1])[0]?.[0]
          : null;
        return (
          <div key={`${s.teams.join('-')}-${s.games[0].gameId}`} className="playoff-series-card">
            <div className="playoff-series-header">
              <span className="playoff-series-matchup">
                {logoByAbbr.get(teamA) && <img src={logoByAbbr.get(teamA)} alt="" className="standings-team-logo" />}
                {nameByAbbr.get(teamA) ?? teamA} {s.wins[teamA] ?? 0}
                <span className="playoff-series-vs">–</span>
                {s.wins[teamB] ?? 0} {nameByAbbr.get(teamB) ?? teamB}
                {logoByAbbr.get(teamB) && <img src={logoByAbbr.get(teamB)} alt="" className="standings-team-logo" />}
              </span>
              {winner && (
                <span className="playoff-series-result">{nameByAbbr.get(winner) ?? winner} wins series</span>
              )}
            </div>
            <div className="playoff-series-games">
              {s.games.map(g => (
                <button
                  key={g.gameId}
                  type="button"
                  className={`playoff-series-game${g.final ? '' : ' playoff-series-game--pending'}`}
                  onClick={g.final ? () => navigate(`/game/${g.gameId}`) : undefined}
                  disabled={!g.final}
                >
                  <span className="playoff-series-game-date">{formatDate(g.date)}</span>
                  <span>{g.away.abbreviation} {g.final ? g.away.score : ''}</span>
                  <span className="odds-matchup-at">@</span>
                  <span>{g.home.abbreviation} {g.final ? g.home.score : ''}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
