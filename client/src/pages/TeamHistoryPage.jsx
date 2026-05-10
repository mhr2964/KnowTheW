import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function conferenceShort(conf) {
  if (!conf) return '';
  if (conf.toLowerCase().includes('eastern')) return 'East';
  if (conf.toLowerCase().includes('western')) return 'West';
  return conf;
}

export default function TeamHistoryPage() {
  const { team } = useOutletContext() ?? {};

  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!team?.id) return;
    const controller = new AbortController();
    setHistoryData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/teams/${team.id}/history`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setHistoryData(data); setLoading(false); })
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
      <p className="status-msg">Loading franchise history…</p>
    </div>
  );

  if (error) return (
    <div className="team-spoke-content">
      <p className="status-msg error">Couldn&apos;t load team history.</p>
    </div>
  );

  if (!historyData) return null;

  const { founded, championships = [], seasons = [] } = historyData;

  if (seasons.length === 0) return (
    <div className="team-spoke-content">
      <p className="status-msg">No season records available.</p>
    </div>
  );

  return (
    <div className="team-spoke-content team-history-page">
      <h3 className="team-stats-season">Franchise History</h3>

      <div className="team-history-meta">
        {founded != null && <span>Est. {founded}</span>}
        {founded != null && <span className="team-history-meta-sep">·</span>}
        <span>{seasons.length} seasons</span>
      </div>

      {championships.length > 0 && (
        <div className="team-history-champs" role="region" aria-label="Championships">
          <span className="team-history-champs-icon" aria-hidden="true">🏆</span>
          <span className="team-history-champs-text">
            {championships.length === 1
              ? '1 WNBA Championship'
              : `${championships.length} WNBA Championships`}
          </span>
          <span className="team-history-champs-years">
            {championships.join(', ')}
          </span>
        </div>
      )}

      <div className="team-history-table-wrap">
        <table className="team-history-table">
          <thead>
            <tr>
              <th className="team-history-cell team-history-cell--head">Year</th>
              <th className="team-history-cell team-history-cell--head">Record</th>
              <th className="team-history-cell team-history-cell--head team-history-cell--conf">Conference Seed</th>
              <th className="team-history-cell team-history-cell--head">Playoff Result</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(season => {
              const isChamp = season.champion === true;
              // seed === 0 is an ESPN sentinel for "unknown/pre-2003" — render muted dash, not "0th in".
              // "Missed playoffs" is only correct when seed is genuinely null AND not a champion year.
              let seedLabel;
              if (season.seed != null && season.seed > 0) {
                seedLabel = `${ordinalSuffix(season.seed)} in ${conferenceShort(season.conference)}`;
              } else if (isChamp) {
                seedLabel = '—';
              } else {
                seedLabel = 'Missed playoffs';
              }
              // Trophy emoji omitted on champion rows — the "Champions" pill below carries the signal.
              const resultLabel = season.playoffResult;

              return (
                <tr
                  key={season.year}
                  className={`team-history-row${isChamp ? ' team-history-champion-row' : ''}`}
                >
                  <td className="team-history-cell">{season.year}</td>
                  <td className="team-history-cell">
                    {season.wins != null && season.losses != null
                      ? `${season.wins}–${season.losses}`
                      : '—'}
                  </td>
                  <td className="team-history-cell team-history-cell--conf">{seedLabel}</td>
                  <td className="team-history-cell">
                    {resultLabel ?? <span className="team-history-cell--muted">—</span>}
                    {isChamp && (
                      <span className="team-history-champ-badge" aria-label="Champions">
                        Champions
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="team-history-ai-placeholder" aria-label="AI franchise summary placeholder">
        <span className="team-history-ai-placeholder-label">Coming soon</span>
        <p className="team-history-ai-placeholder-title">AI Franchise Summary</p>
        <p className="team-history-ai-placeholder-desc">
          An AI-generated narrative covering franchise eras, key players, and coaching history — sourced from structured season data above.
        </p>
      </div>
    </div>
  );
}
