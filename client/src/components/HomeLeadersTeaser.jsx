import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { buildTeamLogoMap } from '../lib/teamLookup';
import { getCurrentSeason } from '../lib/currentSeason';

// The 3 most recognizable box-score categories, not the full 6+ the League Leaders page itself
// offers -- this is a teaser, not a second copy of that page.
const MARQUEE_CATEGORIES = ['PTS', 'REB', 'AST'];
const PCT_KEYS = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT']);

function formatValue(key, value) {
  return PCT_KEYS.has(key) ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
}

// Homepage teaser for the League Leaders page -- just the #1 name in each marquee category, same
// silent-omit-on-error/loading convention as the other homepage widgets (LeagueSnapshot,
// HomeScoresStrip), since a broken widget shouldn't be the first thing a visitor sees.
export default function HomeLeadersTeaser({ teams }) {
  const navigate = useNavigate();
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);
  const { data } = useLazyFetch(`/api/league/leaders?season=${getCurrentSeason()}&mode=PerGame`, true);

  const leaders = useMemo(() => {
    if (!data?.categories) return [];
    return MARQUEE_CATEGORIES
      .map(key => data.categories.find(c => c.key === key))
      .filter(c => c?.leaders?.length > 0)
      .map(c => ({ key: c.key, label: c.label, top: c.leaders[0] }));
  }, [data]);

  if (leaders.length === 0) return null;

  return (
    <section className="home-leaders">
      <div className="home-leaders-header">
        <h2 className="section-title">League Leaders</h2>
        <button type="button" className="btn-ghost" onClick={() => navigate('/league-leaders')}>All leaders →</button>
      </div>
      <div className="home-leaders-grid">
        {leaders.map(c => (
          <button
            key={c.key}
            type="button"
            className="home-leader-card"
            onClick={() => c.top.playerId != null && navigate(`/player/${c.top.playerId}`)}
          >
            <span className="home-leader-category">{c.label}</span>
            <span className="home-leader-value">{formatValue(c.key, c.top.value)}</span>
            <span className="home-leader-name">{c.top.name}</span>
            <span className="home-leader-team">
              {logoByAbbr.get(c.top.teamAbbr) && <img src={logoByAbbr.get(c.top.teamAbbr)} alt="" className="home-leader-logo" />}
              {c.top.teamAbbr}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
