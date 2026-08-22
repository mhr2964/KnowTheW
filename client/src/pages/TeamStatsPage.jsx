import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatStatValue } from '../lib/statFormatters';
import TeamShotChart from '../components/TeamShotChart';

const STAT_LABELS = {
  ptsPg:    'PPG',
  oppPpg:   'Opp PPG',
  fgmPg:    'FGM',
  fgaPg:    'FGA',
  fgPct:    'FG%',
  fg3mPg:   '3PM',
  fg3Pct:   '3P%',
  ftmPg:    'FTM',
  ftaPg:    'FTA',
  ftPct:    'FT%',
  orbPg:    'OREB',
  drbPg:    'DREB',
  astPg:    'AST',
  tovPg:    'TOV',
};

// Dean Oliver's Four Factors -- BDL-only, own fetch/section (not part of the GROUPS/STAT_LABELS
// blob above, which comes from the existing /teams/:id/stats endpoint). ftRatePct/oppFtRatePct are
// FTA/FGA rates, not literally shooting percentages, but are named with the Pct suffix anyway so
// they route through formatStatValue's existing percent-style rendering -- this page already shows
// every *Pct stat as "NN.N%" (fgPct, fg3Pct, ftPct above), so a bare ".273" would read as
// inconsistent here, unlike the BRef-style player Advanced tab elsewhere in the app.
const FOUR_FACTORS_LABELS = {
  efgPct: 'eFG%', tovPct: 'TOV%', orbPct: 'OREB%', ftRatePct: 'FT Rate',
  oppEfgPct: 'Opp eFG%', oppTovPct: 'Opp TOV%', oppOrbPct: 'Opp OREB%', oppFtRatePct: 'Opp FT Rate',
};
const FOUR_FACTORS_GROUPS = [
  { label: 'Four Factors', keys: ['efgPct', 'tovPct', 'orbPct', 'ftRatePct'] },
  { label: 'Four Factors (Opponent)', keys: ['oppEfgPct', 'oppTovPct', 'oppOrbPct', 'oppFtRatePct'] },
];

const GROUPS = [
  {
    label: 'Scoring',
    keys: ['ptsPg', 'oppPpg'],
  },
  {
    label: 'Shooting',
    keys: ['fgmPg', 'fgaPg', 'fgPct', 'fg3mPg', 'fg3Pct', 'ftmPg', 'ftaPg', 'ftPct'],
  },
  {
    label: 'Rebounds & Possession',
    keys: ['orbPg', 'drbPg', 'astPg', 'tovPg'],
  },
];


function StatGroup({ label, stats, labels = STAT_LABELS }) {
  if (stats.length === 0) return null;
  return (
    <div className="team-stats-group">
      <h4 className="team-stats-group-label">{label}</h4>
      <div className="team-stats-grid">
        {stats.map(({ key, val }) => (
          <div key={key} className="team-stat-item">
            <span className="team-stat-label">{labels[key] ?? key}</span>
            <span className="team-stat-value">{formatStatValue(key, val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamStatsPage() {
  const { team, season } = useOutletContext() ?? {};
  const isDefunct = !!team?.defunct;

  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fourFactorsData, setFourFactorsData] = useState(null);

  useEffect(() => {
    if (!team?.id || isDefunct) return;
    const controller = new AbortController();
    setStatsData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/teams/${team.id}/stats?season=${season}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setStatsData(data); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [team?.id, season, isDefunct]);

  // Separate, independent fetch -- BDL-only and legitimately empty for pre-2022 seasons or when
  // running under the ESPN provider, so it fails gracefully rather than blocking the main stats
  // above (same posture as the player-side Clutch/Scoring/Usage/Defense tabs' 404-as-empty handling).
  useEffect(() => {
    if (!team?.id || isDefunct) return;
    const controller = new AbortController();
    setFourFactorsData(null);
    fetch(`/api/teams/${team.id}/four-factors?season=${season}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setFourFactorsData(data))
      .catch(() => {});
    return () => controller.abort();
  }, [team?.id, season, isDefunct]);

  if (isDefunct) return (
    <div className="team-spoke-content">
      <p className="status-msg">Team stats are not available for historical franchises.</p>
    </div>
  );

  if (loading) return (
    <div className="team-spoke-content">
      <p className="status-msg">Loading team stats...</p>
    </div>
  );

  if (error) return (
    <div className="team-spoke-content">
      <p className="status-msg error">Couldn&apos;t load team stats.</p>
    </div>
  );

  if (statsData?.empty) return (
    <div className="team-spoke-content">
      <p className="status-msg">No stats available for the {season} season.</p>
    </div>
  );

  if (!statsData) return null;

  const { stats = {} } = statsData;
  const knownKeys = new Set(GROUPS.flatMap(g => g.keys));
  const unknownEntries = Object.entries(stats).filter(([k]) => !knownKeys.has(k));

  const grouped = GROUPS.map(group => ({
    label: group.label,
    stats: group.keys
      .filter(k => stats[k] !== undefined && stats[k] !== null)
      .map(k => ({ key: k, val: stats[k] })),
  }));

  if (unknownEntries.length > 0) {
    grouped.push({
      label: 'Other',
      stats: unknownEntries.map(([k, v]) => ({ key: k, val: v })),
    });
  }

  return (
    <div className="team-spoke-content">
      <div className="team-stats-header">
        <h3 className="team-stats-season">{season} Team Stats</h3>
      </div>
      {grouped.map(group => (
        <StatGroup key={group.label} label={group.label} stats={group.stats} />
      ))}
      {fourFactorsData?.stats && FOUR_FACTORS_GROUPS.map(group => (
        <StatGroup
          key={group.label}
          label={group.label}
          labels={FOUR_FACTORS_LABELS}
          stats={group.keys
            .filter(k => fourFactorsData.stats[k] !== undefined && fourFactorsData.stats[k] !== null)
            .map(k => ({ key: k, val: fourFactorsData.stats[k] }))}
        />
      ))}
      <TeamShotChart teamId={team.id} season={season} />
    </div>
  );
}
