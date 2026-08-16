import { createContext, useState, useEffect, useCallback } from 'react';
import * as authFetch from '../lib/authFetch';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True when the /api/auth/me check failed for a reason other than "confirmed logged out"
  // (e.g. a 503 from requireAuth when the DB is unreachable, or a network error) — callers
  // should show a "try again" state instead of treating this the same as a 401.
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authFetch.fetchMe(controller.signal)
      .then(({ ok, status, data }) => {
        if (ok) {
          setUser(data);
          setAuthUnavailable(false);
        } else {
          setAuthUnavailable(status !== 401);
        }
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setAuthUnavailable(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await authFetch.login(username, password);
    if (res.ok) setUser(res.data);
    return res;
  }, []);

  const signup = useCallback(async (username, password) => {
    const res = await authFetch.signup(username, password);
    if (res.ok) setUser(res.data);
    return res;
  }, []);

  const logout = useCallback(async () => {
    const res = await authFetch.logout();
    if (res.ok) setUser(null);
    return res;
  }, []);

  const setTeamRep = useCallback(async (teamId) => {
    const res = await authFetch.setTeamRep(teamId);
    if (res.ok) setUser(u => (u ? { ...u, teamRepId: res.data.teamRepId } : u));
    else if (res.status === 401) setUser(null);
    return res;
  }, []);

  const clearTeamRep = useCallback(async () => {
    const res = await authFetch.clearTeamRep();
    if (res.ok) setUser(u => (u ? { ...u, teamRepId: null } : u));
    else if (res.status === 401) setUser(null);
    return res;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authUnavailable, login, signup, logout, setTeamRep, clearTeamRep }}>
      {children}
    </AuthContext.Provider>
  );
}
