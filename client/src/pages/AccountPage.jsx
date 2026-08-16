import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function AccountPage({ teams, teamsLoading, teamsError }) {
  const { user, loading, authUnavailable, logout, setTeamRep, clearTeamRep } = useAuth();
  const [teamError, setTeamError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Legacy/defunct franchises have synthetic string ids (e.g. "legacy-houston-comets")
  // and always 400 against PUT /api/users/me/team-rep, which only accepts numeric ids.
  const selectableTeams = teams.filter(t => /^\d+$/.test(String(t.id)));

  useEffect(() => {
    setPageMeta('My Account — KnowTheW', 'Manage your KnowTheW account and team rep.', { noindex: true });
    return resetPageMeta;
  }, []);

  if (loading) {
    return <div className="auth-page"><p className="status-msg">Loading…</p></div>;
  }

  // A 503/network error during the auth check doesn't mean logged-out — don't misroute
  // a possibly-still-logged-in user away from their account on a transient backend hiccup.
  if (!user && authUnavailable) {
    return <div className="auth-page"><p className="auth-error">Can&apos;t verify your session right now — try again.</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleTeamChange = async (e) => {
    const teamId = e.target.value;
    setTeamError(null);
    setSaving(true);
    const { ok, data } = teamId ? await setTeamRep(teamId) : await clearTeamRep();
    setSaving(false);
    if (!ok) setTeamError(data?.error ?? 'Could not update your team.');
  };

  return (
    <div className="auth-page">
      <h1>My Account</h1>
      <p className="account-username">{user.username}</p>

      <div className="auth-form">
        <label className="auth-label" htmlFor="team-rep-select">Team Rep</label>
        {teamsLoading ? (
          <p className="status-msg">Loading teams…</p>
        ) : teamsError ? (
          <p className="auth-error">{teamsError}</p>
        ) : (
          <select
            id="team-rep-select"
            className="auth-input"
            value={user.teamRepId ?? ''}
            onChange={handleTeamChange}
            disabled={saving}
          >
            <option value="">No team selected</option>
            {selectableTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {teamError && <p className="auth-error">{teamError}</p>}
      </div>

      <button type="button" className="btn-ghost auth-logout" onClick={logout}>Log Out</button>
    </div>
  );
}
