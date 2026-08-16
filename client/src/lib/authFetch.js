// Small fetch wrapper for the five /api/auth + /api/users/me/team-rep calls. Not built on
// useLazyFetch — that hook is GET-only/lazy-on-enable by design and isn't a fit for
// POST/PUT/DELETE flows that fire on user action rather than mount.

async function authFetch(url, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return { ok: false, status: 0, data: { error: 'Network error — is the server running?' } };
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export function signup(username, password) {
  return authFetch('/api/auth/signup', { method: 'POST', body: { username, password } });
}

export function login(username, password) {
  return authFetch('/api/auth/login', { method: 'POST', body: { username, password } });
}

export function logout() {
  return authFetch('/api/auth/logout', { method: 'POST' });
}

export function fetchMe(signal) {
  return authFetch('/api/auth/me', { signal });
}

export function setTeamRep(teamId) {
  return authFetch('/api/users/me/team-rep', { method: 'PUT', body: { teamId } });
}

export function clearTeamRep() {
  return authFetch('/api/users/me/team-rep', { method: 'DELETE' });
}
