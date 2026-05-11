import { useState, useEffect, useRef } from 'react';
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

// Build a map from season year → era index (into reversedEras).
function buildYearToEraIndex(reversedEras) {
  const map = {};
  reversedEras.forEach((era, i) => {
    if (era.yearStart == null || era.yearEnd == null) return;
    for (let y = era.yearStart; y <= era.yearEnd; y++) {
      // Only assign if not already claimed (first match wins — current eras are at lower indices)
      if (!(y in map)) map[y] = i;
    }
  });
  return map;
}

export default function TeamHistoryPage() {
  const { team } = useOutletContext() ?? {};

  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeState, setNarrativeState] = useState(null);

  // Controlled open state for era cards. -1 = none open (after manual close).
  const [openEra, setOpenEra] = useState(0);
  const eraRefs = useRef([]);

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

  // Era label column setup — only when narrative eras are available.
  const reversedEras = narrative?.eras?.length > 0 ? [...narrative.eras].reverse() : [];
  const yearToEraIdx = reversedEras.length > 0 ? buildYearToEraIndex(reversedEras) : {};
  const hasEraLabels = reversedEras.length > 0;

  // Pre-compute rowspan for each era: count how many consecutive rows from the top belong to it.
  // We track, per era index, the index of the first season row that belongs to it.
  const eraFirstRowIdx = {}; // eraIdx → first season row index
  const eraRowCount = {}; // eraIdx → number of rows
  seasons.forEach((season, rowIdx) => {
    const eraIdx = yearToEraIdx[season.year];
    if (eraIdx === undefined) return;
    if (!(eraIdx in eraFirstRowIdx)) eraFirstRowIdx[eraIdx] = rowIdx;
    eraRowCount[eraIdx] = (eraRowCount[eraIdx] ?? 0) + 1;
  });

  function handleEraLabelClick(eraIdx) {
    setOpenEra(eraIdx);
    // Scroll after state update settles — rAF ensures the details is open/visible.
    requestAnimationFrame(() => {
      eraRefs.current[eraIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="team-spoke-content team-history-page">
      <h3 className="team-stats-season">Franchise History</h3>

      <div className="team-history-meta">
        {founded != null && <span>Est. {founded}</span>}
        {founded != null && <span className="team-history-meta-sep">·</span>}
        <span>{seasons.length} seasons</span>
      </div>

      {championships.length > 0 ? (
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
      ) : (
        <div className="team-history-champs team-history-champs--none" role="region" aria-label="No championships yet">
          <span className="team-history-champs-text">Chasing their first championship</span>
        </div>
      )}

      <div className="team-history-table-wrap">
        <table className="team-history-table">
          <thead>
            <tr>
              {hasEraLabels && (
                <th className="team-history-cell team-history-cell--head team-history-cell--era" aria-label="Era" />
              )}
              <th className="team-history-cell team-history-cell--head">Year</th>
              <th className="team-history-cell team-history-cell--head">Record</th>
              <th className="team-history-cell team-history-cell--head team-history-cell--conf">
                <span className="th-full">Conference Seed</span>
                <span className="th-short">Seed</span>
              </th>
              <th className="team-history-cell team-history-cell--head">
                <span className="th-full">Playoff Result</span>
                <span className="th-short">Result</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((season, rowIdx) => {
              const isChamp = season.champion === true;
              let seedLabelFull;
              let seedLabelShort;
              if (season.seed != null && season.seed > 0) {
                const conf = conferenceShort(season.conference);
                seedLabelFull = `${ordinalSuffix(season.seed)} in ${conf}`;
                seedLabelShort = `${ordinalSuffix(season.seed)} ${conf[0]}`;
              } else if (isChamp) {
                seedLabelFull = '—';
                seedLabelShort = '—';
              } else {
                seedLabelFull = 'Missed playoffs';
                seedLabelShort = 'Missed';
              }
              const resultLabel = season.playoffResult;
              const eraIdx = yearToEraIdx[season.year];
              const isFirstInEra = eraIdx !== undefined && eraFirstRowIdx[eraIdx] === rowIdx;
              const rowSpan = isFirstInEra ? eraRowCount[eraIdx] : undefined;

              return (
                <tr
                  key={season.year}
                  className={`team-history-row${isChamp ? ' team-history-champion-row' : ''}`}
                >
                  {hasEraLabels && isFirstInEra && (
                    <td
                      className="team-history-cell team-history-cell--era"
                      rowSpan={rowSpan}
                    >
                      <button
                        type="button"
                        className={`team-history-era-nav-btn${openEra === eraIdx ? ' team-history-era-nav-btn--active' : ''}`}
                        onClick={() => handleEraLabelClick(eraIdx)}
                        title={`Jump to ${reversedEras[eraIdx].label} era summary`}
                      >
                        <span className="team-history-era-nav-label">
                          {reversedEras[eraIdx].label}
                        </span>
                      </button>
                    </td>
                  )}
                  {hasEraLabels && !isFirstInEra && eraIdx === undefined && (
                    <td className="team-history-cell team-history-cell--era team-history-cell--era-gap" />
                  )}
                  <td className="team-history-cell">{season.year}</td>
                  <td className="team-history-cell">
                    {season.wins != null && season.losses != null
                      ? `${season.wins}–${season.losses}`
                      : '—'}
                  </td>
                  <td className="team-history-cell team-history-cell--conf">
                    <span className="th-full">{seedLabelFull}</span>
                    <span className="th-short">{seedLabelShort}</span>
                  </td>
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
          <h3 className="team-history-narrative-title">AI Franchise Summary</h3>

          {narrative.summary && (
            <p className="team-history-narrative-summary">{narrative.summary}</p>
          )}

          {narrative.eras?.length > 0 && (
            <div className="team-history-eras">
              {reversedEras.map((era, i) => (
                <details
                  key={i}
                  ref={el => { eraRefs.current[i] = el; }}
                  className="team-history-era-card"
                  open={openEra === i}
                  onToggle={e => {
                    if (e.target.open) {
                      setOpenEra(i);
                    } else if (openEra === i) {
                      setOpenEra(-1);
                    }
                  }}
                >
                  <summary className="team-history-era-summary">
                    <span className="team-history-era-label">{era.label}</span>
                    {era.record && (
                      <span className="team-history-era-record">{era.record}</span>
                    )}
                    <span className="team-history-era-chevron" aria-hidden="true">›</span>
                  </summary>
                  {era.narrative && (
                    <p className="team-history-era-narrative">{era.narrative}</p>
                  )}
                  {era.keyPlayers?.length > 0 && (
                    <p className="team-history-era-players">
                      <span className="team-history-era-players-label">Key players: </span>
                      {era.keyPlayers.join(', ')}
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}

          {narrative.identity && (
            <p className="team-history-narrative-identity">{narrative.identity}</p>
          )}

          <p className="team-history-narrative-disclaimer">
            AI-generated summary — may contain inaccuracies.
          </p>
        </section>
      )}
    </div>
  );
}
