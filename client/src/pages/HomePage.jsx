import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RecentDecks from '../components/RecentDecks';
import useLazyFetch from '../hooks/useLazyFetch';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

// Top 4 seeds per conference -- enough to show who's currently in playoff position (the single
// most glanceable fact a standings teaser can carry) without turning into the full Standings page.
const SNAPSHOT_SEED_CUTOFF = 4;

function ConferenceSnapshot({ conference, rows, navigate }) {
  const top = [...rows]
    .sort((a, b) => (a.playoffSeed ?? 99) - (b.playoffSeed ?? 99))
    .slice(0, SNAPSHOT_SEED_CUTOFF);
  return (
    <div className="snapshot-conference">
      <h3 className="snapshot-conference-title">{conference}</h3>
      <ul className="snapshot-list">
        {top.map(row => (
          <li key={row.teamId} className="snapshot-row" onClick={() => row.slug && navigate(`/team/${row.slug}`)}>
            <span className="snapshot-seed">{row.playoffSeed ?? '—'}</span>
            {row.logo && <img src={row.logo} alt="" className="snapshot-logo" />}
            <span className="snapshot-name">{row.name ?? row.abbreviation}</span>
            <span className="snapshot-record">{row.wins ?? '—'}-{row.losses ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// League snapshot widget -- standings data the app already fetches for /standings, reused here as
// a homepage teaser rather than a second data source. Failing/loading silently omits the widget
// instead of showing an error on the front door of the site; Standings itself still has its own
// real error state for anyone who navigates there directly.
function LeagueSnapshot({ navigate }) {
  const { data } = useLazyFetch('/api/standings', true);
  if (!data?.length) return null;

  const byConference = new Map();
  for (const row of data) {
    const key = row.conference ?? 'Other';
    if (!byConference.has(key)) byConference.set(key, []);
    byConference.get(key).push(row);
  }
  const order = ['Eastern Conference', 'Western Conference'];
  const conferences = [...byConference.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <section className="league-snapshot">
      <div className="league-snapshot-header">
        <h2 className="section-title">League Snapshot</h2>
        <button type="button" className="btn-ghost" onClick={() => navigate('/standings')}>Full standings →</button>
      </div>
      <div className="snapshot-grid">
        {conferences.map(conf => (
          <ConferenceSnapshot key={conf} conference={conf} rows={byConference.get(conf)} navigate={navigate} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage({ decks, onRestudy }) {
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta('KnowTheW — WNBA Stats & Analytics', 'WNBA stats and analytics — current standings, every team, and player stat lines back to the league’s 1997 founding.');
    return resetPageMeta;
  }, []);

  return (
    <>
      <RecentDecks decks={decks} onRestudy={onRestudy} />
      <LeagueSnapshot navigate={navigate} />
      <section className="home-browse-cta">
        <button type="button" className="home-browse-btn" onClick={() => navigate('/teams')}>
          Browse all teams →
        </button>
      </section>
    </>
  );
}
