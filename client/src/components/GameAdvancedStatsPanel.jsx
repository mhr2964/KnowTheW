import useSeasonScopedFetch from '../hooks/useSeasonScopedFetch';
import { formatStatValue } from '../lib/statFormatters';
import { fmt } from './BrefTable';

// A 404 (no advanced-stats row for this player/game -- e.g. a DNP the game log itself already
// excludes, or a genuinely missing BDL row) is a legitimate empty state, not an error -- same
// convention as ShotChart.jsx's parseShotChart.
async function parseGameAdvanced(r) {
  if (r.status === 404) return null;
  if (!r.ok) throw new Error();
  return r.json();
}

// Reuses team.css's team-stats-group/-grid/-item classes (already loaded globally via App.jsx) --
// same labeled-stat-grid presentation as TeamStatsPage's Four Factors sections, just at player+game
// scope instead of team+season scope.
const GROUPS = [
  { label: 'Advanced', key: 'advanced', fields: {
    offRating: 'ORtg', defRating: 'DRtg', netRating: 'Net Rtg', pie: 'PIE', pace: 'Pace', possessions: 'Poss',
    usagePct: 'USG%', assistPct: 'AST%', reboundPct: 'REB%', offReboundPct: 'OREB%', defReboundPct: 'DREB%',
    truShootingPct: 'TS%', effectiveFgPct: 'eFG%', assistToTurnover: 'AST/TO',
  } },
  { label: 'Four Factors', key: 'fourFactors', fields: {
    efgPct: 'eFG%', tovPct: 'TOV%', orbPct: 'OREB%', ftRatePct: 'FT Rate',
    oppEfgPct: 'Opp eFG%', oppTovPct: 'Opp TOV%', oppOrbPct: 'Opp OREB%', oppFtRatePct: 'Opp FT Rate',
  } },
  { label: 'Usage', key: 'usage', fields: {
    usagePct: 'USG%', pctPoints: '% Team PTS', pctAssists: '% Team AST', pctRebounds: '% Team REB',
    pctSteals: '% Team STL', pctBlocks: '% Team BLK', pctTurnovers: '% Team TOV',
    pctFieldGoalsMade: '% Team FGM', pctFreeThrowsMade: '% Team FTM',
  } },
  { label: 'Scoring Breakdown', key: 'scoring', fields: {
    pctPoints2pt: '% Pts 2PT', pctPoints3pt: '% Pts 3PT', pctPointsFreeThrow: '% Pts FT',
    pctPointsPaint: '% Pts Paint', pctPointsMidrange2pt: '% Pts Mid-Range', pctPointsFastBreak: '% Pts Fastbreak',
    pctPointsOffTurnovers: '% Pts off TOV', pctAssistedFgm: '% Assisted FGM', pctUnassistedFgm: '% Unassisted FGM',
  } },
  { label: 'Misc', key: 'misc', fields: {
    pointsPaint: 'PTS Paint', pointsFastBreak: 'PTS Fastbreak', pointsSecondChance: 'PTS 2nd Chance',
    pointsOffTurnovers: 'PTS off TOV', oppPointsPaint: 'Opp PTS Paint', oppPointsFastBreak: 'Opp PTS Fastbreak',
    oppPointsSecondChance: 'Opp PTS 2nd Chance', oppPointsOffTurnovers: 'Opp PTS off TOV',
    foulsPersonal: 'PF', foulsDrawn: 'Fouls Drawn', blocks: 'BLK', blocksAgainst: 'Blocks Against',
  } },
];

// PIE is a 0-1 fraction shown as ".256" everywhere else on this site (statColumns.js's PCT_KEYS ->
// BrefTable's 'pct' kind), not as "25.6%" the way formatStatValue's generic pct-in-key-name
// detection would render it -- special-cased so this panel matches that existing convention.
function formatField(key, val) {
  if (val === null || val === undefined) return '—';
  if (key === 'pie') return fmt('pct', val);
  return formatStatValue(key, val);
}

export default function GameAdvancedStatsPanel({ playerId, gameId }) {
  const url = gameId != null ? `/api/players/${playerId}/gamelog/${gameId}/advanced` : null;
  const { data, loading, error, retry } = useSeasonScopedFetch(url, { parse: parseGameAdvanced });

  if (gameId == null) return null;

  return (
    <div className="game-advanced-panel">
      {loading && <p className="status-msg" style={{ padding: '0.5rem 0' }}>Loading advanced stats…</p>}
      {error && (
        <p className="status-msg error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Could not load advanced stats for this game.
          <button type="button" className="btn-ghost compare-verdict-retry" onClick={retry}>Try again</button>
        </p>
      )}
      {!loading && !error && data === null && (
        <p className="status-msg">No advanced stats available for this game.</p>
      )}
      {!loading && !error && data && GROUPS.map(group => {
        const bag = data[group.key];
        if (!bag) return null;
        const entries = Object.entries(group.fields).filter(([k]) => bag[k] !== undefined);
        if (!entries.length) return null;
        return (
          <div key={group.key} className="team-stats-group">
            <h4 className="team-stats-group-label">{group.label}</h4>
            <div className="team-stats-grid">
              {entries.map(([k, label]) => (
                <div key={k} className="team-stat-item">
                  <span className="team-stat-label">{label}</span>
                  <span className="team-stat-value">{formatField(k, bag[k])}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
