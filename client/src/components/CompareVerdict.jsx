import { useMemo } from 'react';
import GradeBadge from './GradeBadge';
import CompareMagnitudeBar from './CompareMagnitudeBar';
import FingerprintRadar from './FingerprintRadar';
import PlayerHero from './PlayerHero';
import { compareGrades } from '../lib/gradeUtils';

const CATEGORIES = ['Scoring', 'Playmaking', 'Rebounding', 'Defense', 'Efficiency', 'Longevity'];

// [accolades key, display label, importance tier] — gold (championship/MVP-caliber) first, so a
// column's chips lead with its biggest accolade rather than following alphabetical/data order.
const ACCOLADE_LABELS = [
  ['mvp', 'MVP', 'gold'],
  ['finalsMVP', 'Finals MVP', 'gold'],
  ['championships', 'Championships', 'gold'],
  ['dpoy', 'DPOY', 'blue'],
  ['allWnbaFirst', 'All-WNBA 1st', 'blue'],
  ['roy', 'ROY', 'gray'],
  ['sixth', '6th Player', 'gray'],
];

// Individual tier-colored chips instead of one flowing text line — lets a viewer tell which
// accolades are the heavy-hitters (gold) vs role-player/early-career ones (gray) at a glance.
function accoladeChips(accolades) {
  if (!accolades) return [];
  return ACCOLADE_LABELS
    .map(([key, label, tier]) => ({ key, label, tier, count: accolades[key]?.length ?? 0 }))
    .filter(c => c.count > 0);
}

function computeVerdict(reportA, reportB) {
  if (!reportA || !reportB) return null;

  let wonByA = 0;
  let wonByB = 0;
  let tied = 0;

  for (const cat of CATEGORIES) {
    const gradeA = reportA.categories?.[cat]?.grade;
    const gradeB = reportB.categories?.[cat]?.grade;
    if (!gradeA || !gradeB) continue;
    const cmp = compareGrades(gradeA, gradeB);
    if (cmp > 0) wonByA++;
    else if (cmp < 0) wonByB++;
    else tied++;
  }

  const overallA = reportA.overall?.grade;
  const overallB = reportB.overall?.grade;
  const overallCmp = (overallA && overallB) ? compareGrades(overallA, overallB) : 0;

  const gpA = reportA.volume?.gp ?? 0;
  const gpB = reportB.volume?.gp ?? 0;
  let volumeSignal = null;
  if (gpA > 0 && gpB > 0) {
    const maxGp = Math.max(gpA, gpB);
    const minGp = Math.min(gpA, gpB);
    const ratio = maxGp / minGp;
    const smallSample = minGp <= 30 && maxGp >= 100;
    if (ratio >= 1.5 || smallSample) {
      const biggerName = gpA >= gpB ? reportA.playerName : reportB.playerName;
      const smallerName = gpA < gpB ? reportA.playerName : reportB.playerName;
      const smallerGp = Math.min(gpA, gpB);
      const biggerGp = Math.max(gpA, gpB);
      if (smallSample) {
        volumeSignal = `${smallerName}'s sample (${smallerGp} GP) is much smaller than ${biggerName}'s (${biggerGp} GP)`;
      } else {
        volumeSignal = `${biggerName}'s sample is ${ratio.toFixed(1)}× ${smallerName}'s by games played`;
      }
    }
  }

  let shortPeakWarning = null;
  const peakA = reportA.peakSeasons?.length ?? 0;
  const peakB = reportB.peakSeasons?.length ?? 0;
  if (peakA > 0 || peakB > 0) {
    const nameA = reportA.playerName;
    const nameB = reportB.playerName;
    const warnings = [];
    if (peakA > 0 && peakA < 3) warnings.push(`${nameA}'s peak window is only ${peakA} season${peakA > 1 ? 's' : ''}`);
    if (peakB > 0 && peakB < 3) warnings.push(`${nameB}'s peak window is only ${peakB} season${peakB > 1 ? 's' : ''}`);
    if (warnings.length) shortPeakWarning = warnings.join(' · ') + ' — limited sample for comparison';
  }

  return { wonByA, wonByB, tied, overallCmp, overallA, overallB, volumeSignal, shortPeakWarning };
}

// Radar block is driven entirely by archA/archB — independent of report loading/error state, so
// it can render while the AI grades are still generating (archetype data is Mongo-cached, not an
// LLM call, and usually resolves first).
function RadarBlock({ archA, archB, nameA, nameB }) {
  const dimsA = archA?.dimensions;
  const dimsB = archB?.dimensions;
  if (!Array.isArray(dimsA) || !Array.isArray(dimsB)) return null;
  return (
    <div className="compare-verdict-radar-col">
      <span className="compare-profile-label">Playstyle</span>
      <FingerprintRadar dimensions={dimsA} overlay={dimsB} />
      <div className="compare-radar-legend">
        <span className="compare-radar-legend-item compare-radar-legend-item--a">{nameA}</span>
        <span className="compare-radar-legend-item compare-radar-legend-item--b">{nameB}</span>
      </div>
      <p className="compare-radar-caption">Career playstyle — not affected by mode</p>
    </div>
  );
}

export default function CompareVerdict({
  reportA, reportB, nameA, nameB, archA, archB, loading, errorA, errorB, onRetryA, onRetryB,
  playerA, playerB, loadingHeroA, loadingHeroB, errorHeroA, errorHeroB,
  finalTeamNameA, finalTeamNameB, onChangeSideA, onChangeSideB,
}) {
  const verdict = useMemo(() => computeVerdict(reportA, reportB), [reportA, reportB]);
  // RadarBlock renders null internally when there's no fingerprint data — safe to render
  // unconditionally since it's just stacked inline, not chosen between two different wrapper
  // layouts (the prior two-column grid stranded the score content at wide viewports; see git history).
  const radar = <RadarBlock archA={archA} archB={archB} nameA={nameA} nameB={nameB} />;

  // Player photo/team/jersey/archetype/Change-link now lives here, flanking whatever center content
  // this component is showing (skeleton, single-grade fallback, or the real overall bar) — the old
  // top-of-page hero pair + "VS" divider was pure duplication once this existed, so it's gone.
  // Hero loading/error is driven by the player-profile fetch, independent of report loading (a
  // player's photo/team resolves long before the AI grade does), matching the same independence
  // `RadarBlock` already relies on.
  const heroA = <PlayerHero player={playerA} loading={loadingHeroA} error={errorHeroA} onChangeSide={onChangeSideA} finalTeamName={finalTeamNameA} />;
  const heroB = <PlayerHero player={playerB} loading={loadingHeroB} error={errorHeroB} onChangeSide={onChangeSideB} finalTeamName={finalTeamNameB} />;

  if (loading) {
    return (
      <div className="compare-verdict compare-verdict--skeleton">
        <p className="compare-verdict-label">AT A GLANCE</p>
        <div className="compare-verdict-overall-row">
          <div className="compare-verdict-overall-side compare-verdict-overall-side--left">{heroA}</div>
          <div className="compare-verdict-overall-center">
            <div className="compare-verdict-skeleton-line" />
            <div className="compare-verdict-skeleton-line compare-verdict-skeleton-line--short" />
          </div>
          <div className="compare-verdict-overall-side compare-verdict-overall-side--right">{heroB}</div>
        </div>
        {radar}
      </div>
    );
  }

  const oneErrored = (errorA && reportB) || (errorB && reportA);
  if (!verdict && oneErrored) {
    const gradeA = reportA?.overall?.grade ?? null;
    const gradeB = reportB?.overall?.grade ?? null;
    const failingName = errorA ? nameA : nameB;
    const onRetry = errorA ? onRetryA : onRetryB;
    return (
      <div className="compare-verdict">
        <p className="compare-verdict-label">AT A GLANCE</p>
        <div className="compare-verdict-overall-row">
          <div className="compare-verdict-overall-side compare-verdict-overall-side--left">
            {heroA}
            {gradeA ? <GradeBadge grade={gradeA} size="large" /> : <span className="compare-verdict-grade-dash">—</span>}
          </div>
          <div className="compare-verdict-overall-center">
            <span className="compare-verdict-overall-label">vs</span>
            <p className="compare-verdict-error-notice">
              Couldn&apos;t load graded report for {failingName}
              {onRetry && (
                <button type="button" className="btn-ghost compare-verdict-retry" onClick={onRetry}>
                  Try again
                </button>
              )}
            </p>
          </div>
          <div className="compare-verdict-overall-side compare-verdict-overall-side--right">
            {heroB}
            {gradeB ? <GradeBadge grade={gradeB} size="large" /> : <span className="compare-verdict-grade-dash">—</span>}
          </div>
        </div>
        {radar}
      </div>
    );
  }

  if (!verdict) return null;

  const { wonByA, wonByB, tied, overallCmp, overallA, overallB, volumeSignal, shortPeakWarning } = verdict;

  const aWinsOverall = overallCmp > 0;
  const bWinsOverall = overallCmp < 0;

  const hasRadar = Array.isArray(archA?.dimensions) && Array.isArray(archB?.dimensions);
  const chipsA = accoladeChips(reportA?.accolades);
  const chipsB = accoladeChips(reportB?.accolades);
  const hasAccolades = chipsA.length > 0 || chipsB.length > 0;

  return (
    <div className="compare-verdict">
      <p className="compare-verdict-label">AT A GLANCE</p>

      {/* Headline facts first: who's ahead, then by how much. */}
      <div className="compare-verdict-score-col">
        <div className="compare-verdict-fight">
          <span className={`compare-verdict-fight-side compare-verdict-fight-side--left${aWinsOverall ? ' compare-verdict-fight-side--winner' : ''}`}>
            <span className="compare-verdict-fight-name">{nameA}</span>
            <span className={`compare-verdict-score${aWinsOverall ? ' compare-verdict-score--winner' : ''}`}>{wonByA}</span>
          </span>
          <span className="compare-verdict-fight-divider">—</span>
          <span className={`compare-verdict-fight-side compare-verdict-fight-side--right${bWinsOverall ? ' compare-verdict-fight-side--winner' : ''}`}>
            <span className={`compare-verdict-score${bWinsOverall ? ' compare-verdict-score--winner' : ''}`}>{wonByB}</span>
            <span className="compare-verdict-fight-name">{nameB}</span>
          </span>
        </div>

        {tied > 0 && (
          <p className="compare-verdict-tied">
            {tied} tied categor{tied === 1 ? 'y' : 'ies'}
          </p>
        )}

        {overallA && overallB && (
          <div className="compare-verdict-overall-row">
            <div className="compare-verdict-overall-side compare-verdict-overall-side--left">
              {heroA}
              <GradeBadge grade={overallA} size="large" winnerSide={aWinsOverall ? 'a' : null} />
            </div>
            <div className="compare-verdict-overall-center">
              <span className="compare-verdict-overall-label">OVERALL</span>
              <CompareMagnitudeBar gradeA={overallA} gradeB={overallB} size="lg" />
            </div>
            <div className="compare-verdict-overall-side compare-verdict-overall-side--right">
              {heroB}
              <GradeBadge grade={overallB} size="large" winnerSide={bWinsOverall ? 'b' : null} />
            </div>
          </div>
        )}
      </div>

      {/* Radar and accolades each get their own row now, sized purely by their own content —
          pairing them as equal-height siblings (an earlier attempt) meant stretching the short
          accolades text to match the radar's height, which just redistributed the dead space
          instead of removing it. A naturally-sized box has no dead space by construction. */}
      {hasRadar && (
        <div className="compare-verdict-radar-row">
          {radar}
        </div>
      )}

      {hasAccolades && (
        <div className="compare-accolades-section">
          <span className="compare-profile-label">Accolades</span>
          <div className="compare-accolades-row">
            <div className="compare-accolades-col compare-accolades-col--a">
              <span className="compare-accolade-col-name">{nameA}</span>
              <div className="compare-accolade-chips">
                {chipsA.length
                  ? chipsA.map(c => (
                      <span key={c.key} className={`compare-accolade-chip compare-accolade-chip--${c.tier}`}>
                        {c.label}{c.count > 1 ? ` ×${c.count}` : ''}
                      </span>
                    ))
                  : <span className="compare-accolade-chip compare-accolade-chip--none">None</span>}
              </div>
            </div>
            <div className="compare-accolades-col compare-accolades-col--b">
              <span className="compare-accolade-col-name">{nameB}</span>
              <div className="compare-accolade-chips">
                {chipsB.length
                  ? chipsB.map(c => (
                      <span key={c.key} className={`compare-accolade-chip compare-accolade-chip--${c.tier}`}>
                        {c.label}{c.count > 1 ? ` ×${c.count}` : ''}
                      </span>
                    ))
                  : <span className="compare-accolade-chip compare-accolade-chip--none">None</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {(reportA?.overall?.summary || reportB?.overall?.summary) && (
        <div className="compare-overall-summaries">
          {reportA?.overall?.summary && (
            <div className="compare-overall-summary">
              <span className="compare-overall-summary-name">{nameA}</span>
              <p>{reportA.overall.summary}</p>
            </div>
          )}
          {reportB?.overall?.summary && (
            <div className="compare-overall-summary">
              <span className="compare-overall-summary-name">{nameB}</span>
              <p>{reportB.overall.summary}</p>
            </div>
          )}
        </div>
      )}

      {(volumeSignal || shortPeakWarning) && (
        <p className="compare-verdict-volume">
          {[volumeSignal, shortPeakWarning].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}
