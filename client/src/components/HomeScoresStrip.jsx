import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { buildTeamLogoMap } from '../lib/teamLookup';
import { formatDateMonthDay, formatTime } from '../lib/dateFormat';
import { getCurrentSeason } from '../lib/currentSeason';

const RECENT_COUNT = 4;
const UPCOMING_COUNT = 3;

// Homepage teaser for the Schedule & Scores page -- the last few final scores plus the next few
// upcoming games. No `postseason` param on the fetch, so a Finals game still shows up here without
// a second request (the server only filters to postseason-only when that param is explicitly
// 'true' -- see meta.js's /league/schedule route). Failing/loading silently omits the section, same
// "don't show an error on the site's own front door" call LeagueSnapshot already makes below it.
function GameCard({ game, logoByAbbr, navigate }) {
  return (
    <button
      type="button"
      className="home-score-card"
      onClick={game.final ? () => navigate(`/game/${game.gameId}`) : undefined}
      disabled={!game.final}
    >
      <span className="home-score-date">{formatDateMonthDay(game.date)}</span>
      <span className="home-score-row">
        <span className="home-score-team">
          {logoByAbbr.get(game.away.abbreviation) && <img src={logoByAbbr.get(game.away.abbreviation)} alt="" className="home-score-logo" />}
          {game.away.abbreviation}
        </span>
        {game.final && <span className="home-score-value">{game.away.score}</span>}
      </span>
      <span className="home-score-row">
        <span className="home-score-team">
          {logoByAbbr.get(game.home.abbreviation) && <img src={logoByAbbr.get(game.home.abbreviation)} alt="" className="home-score-logo" />}
          {game.home.abbreviation}
        </span>
        {game.final && <span className="home-score-value">{game.home.score}</span>}
      </span>
      {!game.final && <span className="home-score-time">{formatTime(game.date)}</span>}
    </button>
  );
}

export default function HomeScoresStrip({ teams }) {
  const navigate = useNavigate();
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);
  const { data } = useLazyFetch(`/api/league/schedule?season=${getCurrentSeason()}`, true);

  // Most-recent-first for picking the last N, then reversed back to chronological order so the
  // strip reads oldest-to-newest left to right, ending at "now" right before upcoming games start.
  // "Upcoming" also requires date > now, not just !final -- a postponed/uncorrected game can sit at
  // final:false with a real past date (confirmed live: a 2026-07-17 NY@DAL game, 0-0, final:false,
  // while every August game around it is properly final), which would otherwise surface as the
  // homepage's featured "next game" despite being two months stale.
  const { recent, upcoming } = useMemo(() => {
    const games = data?.games ?? [];
    const now = Date.now();
    const final = games.filter(g => g.final).sort((a, b) => new Date(b.date) - new Date(a.date));
    const scheduled = games
      .filter(g => !g.final && new Date(g.date).getTime() > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return { recent: final.slice(0, RECENT_COUNT).reverse(), upcoming: scheduled.slice(0, UPCOMING_COUNT) };
  }, [data]);

  if (!data || (recent.length === 0 && upcoming.length === 0)) return null;

  return (
    <section className="home-scores">
      <div className="home-scores-header">
        <h2 className="section-title">Scores</h2>
        <button type="button" className="btn-ghost" onClick={() => navigate('/schedule')}>Full schedule →</button>
      </div>
      <div className="home-scores-strip">
        {recent.map(g => <GameCard key={g.gameId} game={g} logoByAbbr={logoByAbbr} navigate={navigate} />)}
        {upcoming.map(g => <GameCard key={g.gameId} game={g} logoByAbbr={logoByAbbr} navigate={navigate} />)}
      </div>
    </section>
  );
}
