import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { getCurrentSeason } from '../lib/currentSeason';
import { buildTeamLogoMap } from '../lib/teamLookup';

// BDL's /games floor (BDL_MIN_SEASON on the server) -- a league-wide schedule pre-2008 would need
// aggregating every team's ESPN schedule instead of one bulk fetch, out of scope for this page.
const SCHEDULE_MIN_SEASON = 2008;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function buildSeasonOptions() {
  const top = getCurrentSeason();
  const years = [];
  for (let y = top; y >= SCHEDULE_MIN_SEASON; y--) years.push(y);
  return years;
}

// The gap the Basketball-Reference nav comparison surfaced: a plain "every game this season, with
// final scores" list. Notable Games is a highlight reel (top single-game stat lines); team
// schedules only ever show one team's own slate. This is the league-wide, game-centric view
// neither of those covers.
export default function ScheduleHubPage({ teams }) {
  const navigate = useNavigate();
  const [season, setSeason] = useState(getCurrentSeason());
  const [postseason, setPostseason] = useState(false);
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);

  useEffect(() => {
    setPageMeta('Schedule & Scores — KnowTheW', 'Every WNBA game for a season, with final scores.');
    return resetPageMeta;
  }, []);

  const url = `/api/league/schedule?season=${season}&postseason=${postseason}`;
  const { data, loading, error, refetch } = useLazyFetch(url, true);

  return (
    <>
      <h1>Schedule &amp; Scores</h1>
      <p className="status-msg">Every game for a season. Click a completed game for the box score.</p>

      <div className="stat-season-bar" style={{ marginBottom: '1rem' }}>
        <select className="gl-select" value={season} onChange={e => setSeason(parseInt(e.target.value, 10))}>
          {buildSeasonOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          className={`stat-season-tab${!postseason ? ' active' : ''}`}
          onClick={() => setPostseason(false)}
        >
          Regular Season
        </button>
        <button
          type="button"
          className={`stat-season-tab${postseason ? ' active' : ''}`}
          onClick={() => setPostseason(true)}
        >
          Playoffs
        </button>
      </div>

      {loading && <p className="status-msg">Loading schedule...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load the schedule.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data?.games?.length === 0 && (
        <p className="status-msg">
          {postseason ? `No playoff games found for ${season}.` : `No games found for ${season}.`}
        </p>
      )}
      {!loading && !error && data?.games?.length > 0 && (
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="standings-col-team">Matchup</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.games.map(game => (
                <tr
                  key={game.gameId}
                  className={game.final ? 'standings-row' : undefined}
                  onClick={game.final ? () => navigate(`/game/${game.gameId}`) : undefined}
                >
                  <td>{formatDate(game.date)}</td>
                  <td className="standings-col-team odds-matchup">
                    {logoByAbbr.get(game.away.abbreviation) && <img src={logoByAbbr.get(game.away.abbreviation)} alt="" className="standings-team-logo" />}
                    <span>{game.away.abbreviation}</span>
                    <span className="odds-matchup-at">@</span>
                    {logoByAbbr.get(game.home.abbreviation) && <img src={logoByAbbr.get(game.home.abbreviation)} alt="" className="standings-team-logo" />}
                    <span>{game.home.abbreviation}</span>
                  </td>
                  <td>{game.final ? `${game.away.score}–${game.home.score}` : formatTime(game.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
