import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';
import { fmt } from '../components/BrefTable';
import { buildTeamLogoMap } from '../lib/teamLookup';
import TeamBadge from '../components/TeamBadge';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function TeamBox({ label, logo, rows, teamTotals, navigate }) {
  return (
    <div className="standings-group">
      <h3 className="box-score-team-header">
        {logo && <img src={logo} alt="" className="standings-team-logo" />}
        {label}
      </h3>
      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>PF</th>
              <th>FG</th>
              <th>3P</th>
              <th>FT</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.name}
                className="standings-row"
                onClick={() => row.playerId != null && navigate(`/player/${row.playerId}`)}
              >
                <td>{row.name}</td>
                <td>{row.minutes}</td>
                <td>{row.points}</td>
                <td>{row.rebounds}</td>
                <td>{row.assists}</td>
                <td>{row.steals}</td>
                <td>{row.blocks}</td>
                <td>{row.turnovers}</td>
                <td>{row.fouls}</td>
                <td>{row.fgm}-{row.fga}</td>
                <td>{row.fg3m}-{row.fg3a}</td>
                <td>{row.ftm}-{row.fta}</td>
                <td>{fmt('signed', row.plusMinus)}</td>
              </tr>
            ))}
            {teamTotals && (
              <tr className="standings-row" style={{ cursor: 'default', fontWeight: 700 }}>
                <td>Team</td>
                <td>—</td>
                <td>{teamTotals.points}</td>
                <td>{teamTotals.reb}</td>
                <td>{teamTotals.ast}</td>
                <td>{teamTotals.stl}</td>
                <td>{teamTotals.blk}</td>
                <td>{teamTotals.turnovers}</td>
                <td>{teamTotals.fouls}</td>
                <td>{teamTotals.fgm}-{teamTotals.fga}</td>
                <td>{teamTotals.fg3m}-{teamTotals.fg3a}</td>
                <td>{teamTotals.ftm}-{teamTotals.fta}</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Groups the flat play feed by period for display -- [{period, plays: [...]}], in chronological
// (ascending) order, matching how the feed itself is already ordered.
function groupPlaysByPeriod(plays) {
  const groups = [];
  for (const play of plays) {
    const last = groups[groups.length - 1];
    if (last && last.period === play.period) last.plays.push(play);
    else groups.push({ period: play.period, plays: [play] });
  }
  return groups;
}

function periodLabel(period) {
  return period <= 4 ? `Quarter ${period}` : `Overtime ${period - 4}`;
}

function PlayByPlayFeed({ plays, home, away }) {
  const groups = groupPlaysByPeriod(plays);
  return (
    <div className="pbp-feed">
      {groups.map(group => (
        <div key={group.period} className="pbp-period">
          <h3>{periodLabel(group.period)}</h3>
          {group.plays.map(play => (
            <div key={play.order} className={`pbp-row${play.scoringPlay ? ' pbp-row--scoring' : ''}`}>
              <span className="pbp-clock">{play.clock}</span>
              <span className={`pbp-team-tag${play.team ? ` pbp-team-tag--${play.team}` : ''}`}>
                {play.team === 'home' ? home : play.team === 'away' ? away : ''}
              </span>
              <span className="pbp-text">{play.text}</span>
              <span className="pbp-score">{play.awayScore != null ? `${play.awayScore}-${play.homeScore}` : ''}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function GameBoxScorePage({ teams }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState('box');
  const logoByAbbr = useMemo(() => buildTeamLogoMap(teams), [teams]);

  useEffect(() => {
    setPageMeta('Box Score — KnowTheW', 'Full WNBA game box score: final score, quarter-by-quarter breakdown, and both teams’ player stat lines.');
    return resetPageMeta;
  }, []);

  const { data, loading, error, refetch } = useLazyFetch(`/api/games/${id}`, true);

  function handleBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  }

  return (
    <>
      <button type="button" className="back-btn" onClick={handleBack}>← Back</button>

      {loading && <p className="status-msg">Loading box score...</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load this box score.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && !error && data && (
        <>
          <h1 className="box-score-matchup-header">
            {logoByAbbr.get(data.game.away.abbreviation) && <img src={logoByAbbr.get(data.game.away.abbreviation)} alt="" className="box-score-header-logo" />}
            {data.game.away.abbreviation}
            <span className="odds-matchup-at">@</span>
            {logoByAbbr.get(data.game.home.abbreviation) && <img src={logoByAbbr.get(data.game.home.abbreviation)} alt="" className="box-score-header-logo" />}
            {data.game.home.abbreviation}
          </h1>
          <p className="status-msg">{formatDateTime(data.game.date)}</p>

          <div className="standings-table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="standings-col-team">Team</th>
                  {data.quarterScores.map(q => <th key={q.period}>{q.period <= 4 ? `Q${q.period}` : `OT${q.period - 4}`}</th>)}
                  <th>Final</th>
                </tr>
              </thead>
              <tbody>
                <tr className="standings-row" style={{ cursor: 'default' }}>
                  <td className="standings-col-team"><TeamBadge abbr={data.game.away.abbreviation} logoByAbbr={logoByAbbr} /></td>
                  {data.quarterScores.map(q => <td key={q.period}>{q.away}</td>)}
                  <td style={{ fontWeight: 700 }}>{data.game.away.score}</td>
                </tr>
                <tr className="standings-row" style={{ cursor: 'default' }}>
                  <td className="standings-col-team"><TeamBadge abbr={data.game.home.abbreviation} logoByAbbr={logoByAbbr} /></td>
                  {data.quarterScores.map(q => <td key={q.period}>{q.home}</td>)}
                  <td style={{ fontWeight: 700 }}>{data.game.home.score}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="stat-season-bar" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={`stat-season-tab${view === 'box' ? ' active' : ''}`}
              onClick={() => setView('box')}
            >
              Box Score
            </button>
            <button
              type="button"
              className={`stat-season-tab${view === 'pbp' ? ' active' : ''}`}
              onClick={() => setView('pbp')}
            >
              Play-by-Play
            </button>
          </div>

          {view === 'box' ? (
            <>
              <TeamBox label={data.game.away.abbreviation} logo={logoByAbbr.get(data.game.away.abbreviation)} rows={data.boxScores.away} teamTotals={data.teamTotals.away} navigate={navigate} />
              <TeamBox label={data.game.home.abbreviation} logo={logoByAbbr.get(data.game.home.abbreviation)} rows={data.boxScores.home} teamTotals={data.teamTotals.home} navigate={navigate} />
            </>
          ) : (
            <PlayByPlayFeed plays={data.plays} home={data.game.home.abbreviation} away={data.game.away.abbreviation} />
          )}
        </>
      )}
    </>
  );
}
