// cookies.js — test-support only, not a *.test.js file so `node --test` won't run it as a suite.
// `fetch` (Node's built-in undici client) doesn't persist cookies across calls the way a browser
// does, so auth-flow tests that log in once and then reuse the session have to manually lift the
// Set-Cookie value out of one response and resend it as a Cookie header on the next request.
//
// Returns just the "name=value" pair (Set-Cookie's own attributes like Path/HttpOnly/Max-Age
// aren't valid in an outgoing Cookie header), or null if the response didn't set that cookie.
function extractCookie(res, name) {
  const setCookieHeaders = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);

  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0];
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return null;
}

// Returns the *raw* Set-Cookie header (all attributes intact: Path, Expires, Max-Age, HttpOnly,
// etc.), unlike extractCookie() above which strips everything but "name=value" for reuse in an
// outgoing Cookie header. Callers that need to assert on an attribute itself (e.g. logout's clear
// must carry an immediate/past Expires, not just any Set-Cookie header) need this instead.
function extractRawSetCookieHeader(res, name) {
  const setCookieHeaders = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);

  for (const header of setCookieHeaders) {
    if (header.startsWith(`${name}=`)) return header;
  }
  return null;
}

module.exports = { extractCookie, extractRawSetCookieHeader };
