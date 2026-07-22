import { useEffect } from 'react';
import { useParams, useNavigate, useLocation, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { getCurrentSeason } from '../lib/currentSeason';
import { WNBA_FOUNDED_CLIENT } from '../constants/wnbaFoundedClient';
import { nameForYear } from '../constants/wnbaFranchiseLineageClient';
import SeasonPicker from '../components/SeasonPicker';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

const TAB_META = {
  roster:   { label: 'Roster',   desc: 'roster' },
  stats:    { label: 'Stats',    desc: 'team stats' },
  history:  { label: 'History',  desc: 'franchise history' },
  schedule: { label: 'Schedule', desc: 'schedule' },
};

export default function TeamPage({ teams, teamsLoading, teamsError, onSaveDeck }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const team = teams.find(t => t.slug === slug) ?? null;

  useEffect(() => {
    if (!team) return undefined;
    const tabKey = location.pathname.split('/').pop();
    const tab = TAB_META[tabKey];
    setPageMeta(
      tab ? `${team.name} ${tab.label} — KnowTheW` : `${team.name} — KnowTheW`,
      `${team.name} ${tab ? tab.desc : 'roster, stats, schedule, and history'} — KnowTheW.`
    );
    return resetPageMeta;
  }, [team, location.pathname]);

  const currentSeason = getCurrentSeason();
  const isDefunct = !!team?.defunct;
  const foundedYear = team
    ? (isDefunct ? team.activeYears[0] : (WNBA_FOUNDED_CLIENT[team.id] ?? 1997))
    : 1997;
  const maxSeason = isDefunct ? team.activeYears[1] : currentSeason;
  const rawSeasonStr = searchParams.get('season');
  const isWellFormed = rawSeasonStr !== null && /^\d{4}$/.test(rawSeasonStr);
  const rawSeason = isWellFormed ? parseInt(rawSeasonStr, 10) : NaN;
  const isValidSeason = Number.isFinite(rawSeason) && rawSeason >= foundedYear && rawSeason <= maxSeason;
  const selectedSeason = isValidSeason ? rawSeason : maxSeason;
  const isCurrentSeason = !isDefunct && selectedSeason === currentSeason;

  const { data: seasonInfoData, loading: seasonInfoLoading, error: seasonInfoError } = useLazyFetch(
    `/api/teams/${team?.id}/season-info?season=${selectedSeason}`,
    !!team && !isDefunct && !isCurrentSeason && Number.isInteger(selectedSeason)
  );

  // Strip or correct an invalid/garbage ?season= param so shared URLs reflect real content.
  useEffect(() => {
    const rawParam = searchParams.get('season');
    if (!rawParam) return;
    const parsedRaw = /^\d{4}$/.test(rawParam) ? parseInt(rawParam, 10) : null;
    if (parsedRaw !== selectedSeason) {
      const next = new URLSearchParams(searchParams);
      if (selectedSeason === maxSeason && !isDefunct) {
        next.delete('season');
      } else {
        next.set('season', String(selectedSeason));
      }
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedSeason, maxSeason, isDefunct, setSearchParams]);

  if (teamsLoading) return <p className="status-msg">Loading teams...</p>;
  if (teamsError) return <p className="status-msg error">{teamsError}</p>;
  if (!team) return <p className="status-msg">Team not found.</p>;

  const onPickerChange = (year) => {
    if (year === currentSeason && !isDefunct) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('season');
        return next;
      });
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('season', String(year));
        return next;
      });
    }
  };

  const isHistoryTab = location.pathname.endsWith('/history');
  const searchSuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';

  // Pre-2002 seasons legitimately have null record/seed from the API. We must show those nulls,
  // not fall back to team.* current-season values, or the header would silently lie.
  // On fetch failure for a past season, derive the name client-side from the lineage constant
  // so the header at minimum shows the correct franchise name even when the API is down.
  const seasonInfo = !isCurrentSeason ? seasonInfoData : null;
  const seasonInfoFailed = !isCurrentSeason && seasonInfoError && !seasonInfoData;
  const fallbackName = !isCurrentSeason
    ? nameForYear(Number(team.id), selectedSeason, team.name)
    : team.name;
  const displayName     = seasonInfo?.name ?? fallbackName;
  const displayLocation = seasonInfo?.location ?? ((isCurrentSeason || isDefunct) ? team.location : null);
  const displayRecord   = seasonInfoFailed ? null : (seasonInfo?.record   ?? (isCurrentSeason ? team.record   : null));
  const displaySeed     = seasonInfoFailed ? null : (seasonInfo?.seedLabel ?? (isCurrentSeason ? team.seedLabel : null));
  const displayConf     = seasonInfoFailed ? null : (seasonInfo?.conference ?? (isCurrentSeason ? team.conference : null));

  const seedAndConf = [displaySeed && `${displaySeed} in`, displayConf]
    .filter(Boolean).join(' ');
  const segs = [displayRecord, seedAndConf, displayLocation].filter(Boolean);

  // Sub-pages go back one level to the team Dashboard; the Dashboard itself goes back to All Teams.
  const onDashboard = location.pathname === `/team/${slug}` || location.pathname === `/team/${slug}/`;
  const backLabel = onDashboard ? '← All Teams' : `← ${team.name}`;
  const backTarget = onDashboard ? '/' : `/team/${slug}`;

  return (
    <>
      <button type="button" className="back-btn" onClick={() => navigate(backTarget)}>{backLabel}</button>
      <div className="team-header" style={{ '--team-color': `#${team.color}` }}>
        {team.logo && (
          <img src={team.logo} alt={team.name} className="team-header-logo" />
        )}
        <div className="team-header-text">
          <h2 className="team-header-name">{displayName}</h2>
          {segs.length > 0
            ? <p className="team-header-meta">{segs.join(' · ')}</p>
            : seasonInfoLoading && !isCurrentSeason && !seasonInfoFailed
              ? <p className="team-header-meta team-header-meta-loading">…</p>
              : null
          }
        </div>
        <SeasonPicker
          value={isHistoryTab ? maxSeason : selectedSeason}
          onChange={onPickerChange}
          foundedYear={foundedYear}
          maxYear={maxSeason}
          disabled={isHistoryTab}
          teamId={Number(team.id)}
          currentName={team.name}
        />
      </div>
      <nav className="team-spoke-nav">
        <NavLink to={`/team/${slug}${searchSuffix}`} end className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Dashboard</NavLink>
        <NavLink to={`/team/${slug}/roster${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Roster</NavLink>
        <NavLink to={`/team/${slug}/stats${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Stats</NavLink>
        <NavLink to={`/team/${slug}/history${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>History</NavLink>
        <NavLink to={`/team/${slug}/schedule${searchSuffix}`} className={({ isActive }) => isActive ? 'team-spoke-tab active' : 'team-spoke-tab'}>Schedule</NavLink>
      </nav>
      <Outlet context={{ team, onSaveDeck, season: selectedSeason, isCurrentSeason }} />
    </>
  );
}
