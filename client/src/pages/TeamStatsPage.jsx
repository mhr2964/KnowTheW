import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatStatValue } from '../lib/statFormatters';

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


function StatGroup({ label, stats }) {
  if (stats.length === 0) return null;
  return (
    <div className="team-stats-group">
      <h4 className="team-stats-group-label">{label}</h4>
      <div className="team-stats-grid">
        {stats.map(({ key, val }) => (
          <div key={key} className="team-stat-item">
            <span className="team-stat-label">{STAT_LABELS[key] ?? key}</span>
            <span className="team-stat-value">{formatStatValue(key, val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamStatsPage() {
  const { team } = useOutletContext() ?? {};

  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!team?.id) return;
    const controller = new AbortController();
    setStatsData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/teams/${team.id}/stats`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setStatsData(data); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [team?.id]);

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
      <p className="status-msg">No stats available for this season yet.</p>
    </div>
  );

  if (!statsData) return null;

  const { season, stats = {} } = statsData;
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
    </div>
  );
}
