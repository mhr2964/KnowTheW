import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';
import { buildTeamLogoMap } from '../lib/teamLookup';

// Same ESPN byathlete floor League Leaders/Career Leaders already use.
const SEASON_STATS_MIN_SEASON = 2002;

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= SEASON_STATS_MIN_SEASON; y--) years.push(y);
  return years;
}

function pct(v) { return v == null ? '—' : `${(v * 100).toFixed(1)}%`; }
function num(v, digits = 1) { return v == null ? '—' : v.toFixed(digits); }

// Every qualified player's full stat line for a season -- distinct from League Leaders (top 10 per
// category only). bbref's own "Player Stats" page is exactly this shape (Per Game/Totals tabs,
// every player, alphabetical by default). Reuses the same qualified-entries data League Leaders
// ranks from, just unranked -- see server/routes/meta.js's /league/season-stats doc comment for the
// "qualified, not every player who suited up" scope note this page inherits.
//
// season/mode live in the URL, not local state -- see ScheduleHubPage.jsx's header comment for why
// (browser Back after opening a player's page must restore the selected season/mode, not reset it).
export default function SeasonStatsPage({ teams }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSeason = parseInt(searchParams.get('season'), 10);
  const season = Number.isFinite(rawSeason) ? rawSeason : getCurrentSeason();
  const mode = searchParams.get('mode') === 'Totals' ? 'Totals' : 'PerGame';
  const setSeason = (y) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('season', String(y));
    return next;
  });
  const setMode = (m) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('mode', m);
    return next;
  });
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);

  useEffect(() => {
    setPageMeta('Season Stats — KnowTheW', 'Every qualified WNBA player’s full stat line for a season.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch(`/api/league/season-stats?season=${season}&mode=${mode}`, true);

  return (
    <>
      <h1>Season Stats</h1>
      <p className="status-msg">Every qualified player&apos;s stat line for a season, alphabetical by name.</p>

      <div className="stat-season-bar" style={{ marginBottom: '1rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" className={`stat-season-tab${mode === 'PerGame' ? ' active' : ''}`} onClick={() => setMode('PerGame')}>Per Game</button>
        <button type="button" className={`stat-season-tab${mode === 'Totals' ? ' active' : ''}`} onClick={() => setMode('Totals')}>Totals</button>
      </div>

      {loading && <p className="status-msg">Loading season stats...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load season stats.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data?.players?.length === 0 && (
        <p className="status-msg">No qualified players found for {season}.</p>
      )}
      {!loading && !error && data?.players?.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th className="standings-col-team">Player</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TOV</th>
                <th>FG%</th>
                <th>3P%</th>
                <th>FT%</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map(p => (
                <tr
                  key={p.playerId ?? p.name}
                  className={p.playerId ? 'standings-row' : undefined}
                  onClick={p.playerId ? () => navigate(`/player/${p.playerId}`) : undefined}
                >
                  <td className="standings-col-team">
                    {p.teamAbbr && logoByAbbr.get(p.teamAbbr) && <img src={logoByAbbr.get(p.teamAbbr)} alt="" className="standings-team-logo" />}
                    <span>{p.name}</span>
                    {p.teamAbbr && <span className="search-suggestion-meta" style={{ marginLeft: '0.4rem' }}>{p.teamAbbr}</span>}
                  </td>
                  <td>{num(p.MIN)}</td>
                  <td>{num(p.PTS)}</td>
                  <td>{num(p.REB)}</td>
                  <td>{num(p.AST)}</td>
                  <td>{num(p.STL)}</td>
                  <td>{num(p.BLK)}</td>
                  <td>{num(p.TOV)}</td>
                  <td>{pct(p.FG_PCT)}</td>
                  <td>{pct(p.FG3_PCT)}</td>
                  <td>{pct(p.FT_PCT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
