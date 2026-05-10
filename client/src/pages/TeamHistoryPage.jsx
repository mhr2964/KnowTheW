import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

const NARRATIVE_SUPPRESSED = 'suppressed';
const NARRATIVE_ERROR = 'error';

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

  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeState, setNarrativeState] = useState(null);

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

  useEffect(() => {
    if (!team?.id) return;
    const controller = new AbortController();
    setNarrative(null);
    setNarrativeState(null);
    setNarrativeLoading(true);
    fetch(`/api/teams/${team.id}/narrative`, { signal: controller.signal })
      .then(r => {
        if (r.status === 503 || r.status === 404) {
          setNarrativeState(NARRATIVE_SUPPRESSED);
          setNarrativeLoading(false);
          return null;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(json => {
        if (json === null) return;
        setNarrative(json.data ?? null);
        setNarrativeLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setNarrativeState(NARRATIVE_ERROR);
          setNarrativeLoading(false);
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

      {narrativeLoading && narrativeState === null && (
        <div className="team-history-narrative-loading" aria-live="polite">
          Loading franchise summary…
        </div>
      )}

      {narrativeState === NARRATIVE_ERROR && (
        <div className="team-history-narrative-error" role="alert">
          Couldn&apos;t load AI summary.
        </div>
      )}

      {narrative && narrativeState === null && (
        <section className="team-history-narrative" aria-label="AI Franchise Summary">
          <div className="team-history-narrative-header">
            <h3 className="team-history-narrative-title">AI Franchise Summary</h3>
            <span className="team-history-ai-label" aria-label="AI generated content">(AI summary)</span>
          </div>

          {narrative.summary && (
            <p className="team-history-narrative-summary">{narrative.summary}</p>
          )}

          {narrative.eras?.length > 0 && (
            <div className="team-history-eras">
              {narrative.eras.map((era, i) => (
                <div key={i} className="team-history-era-card">
                  <div className="team-history-era-header">
                    <h4 className="team-history-era-label">{era.label}</h4>
                    <span className="team-history-ai-label" aria-hidden="true">(AI summary)</span>
                  </div>
                  <div className="team-history-era-meta">
                    <span>{era.yearStart}–{era.yearEnd}</span>
                    {era.record && <span className="team-history-era-record">{era.record}</span>}
                  </div>
                  {era.narrative && (
                    <p className="team-history-era-narrative">{era.narrative}</p>
                  )}
                  {era.keyPlayers?.length > 0 && (
                    <p className="team-history-era-players">
                      <span className="team-history-era-players-label">Key players: </span>
                      {era.keyPlayers.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {narrative.identity && (
            <p className="team-history-narrative-identity">{narrative.identity}</p>
          )}
        </section>
      )}
    </div>
  );
}
