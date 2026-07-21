# Team Header Context Line — Design

## Problem

A new fan landing on a team page (e.g. Connecticut Sun) sees only the logo and team name — no signal of whether the team is good, what conference they play in, or where they're located. The user-tester explicitly asked for context like "11–17, 5th in Eastern Conference" near the team name. The fix must be a single subtle line under the team name; the app values minimalism and the team-header is already a flex row that re-flows on mobile.

## Constraints grounded in the existing code

- `fetchTeams()` in `server/lib/espnClient.js` already returns a normalized list and is prefetched on startup. It currently strips `location` and only keeps `displayName` as `name`. Conference is not pulled at all.
- `team.color` and `team.logo` already flow through `/api/teams` to the client; adding sibling fields is a known pattern.
- The existing cache pattern uses module-level objects keyed by id; `withCache` swallows network errors by caching `null`.
- The team-header is rendered from `selectedTeam` (an item from the `/api/teams` list), not from a per-team fetch. The roster fetch happens after, via `/api/teams/:id/roster`, but `selectedTeam` itself is set immediately from the cached list.
- ESPN standings live at `https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings` with `children[]` (Eastern conf id `"1"`, Western id `"2"`), each containing `standings.entries[]` with `team.id` and a `stats[]` array carrying `wins`, `losses`, `playoffSeed`, `gamesBehind`, etc. by `name`/`displayValue`.

## Options

### Option A — Merge standings into `/api/teams` at fetch time (recommended)

Standings are fetched once on startup (alongside the existing teams prefetch) and joined into each team object before the list is cached. The `/api/teams` payload grows by ~four small fields per team. Re-fetched on a TTL.

**Pros**
- Single round-trip from the client; the team-header has the data the moment the user clicks a card. No loading flicker for the new line.
- Co-located with the existing prefetch chain — same lifecycle, same cache shape, no new endpoint surface to test.
- Search results (which reuse `TeamCard`) automatically inherit the data if we ever want to surface record there.

**Cons**
- Couples team-list freshness to standings freshness. If standings fetch fails, we must guarantee the team list still loads (existing `withCache` pattern handles this — null-on-error).
- Slightly larger `/api/teams` response body (negligible — ~12 teams × ~30 bytes added).

**Cost**: ~30 minutes. Low risk; reuses existing patterns.

### Option B — Separate `/api/standings` endpoint, fetched in parallel from the client

Server exposes a thin `/api/standings` that returns `{ [teamId]: { wins, losses, seed, conference } }`. Client fires it in parallel with `/api/teams` on mount, merges in memory.

**Pros**
- Clean separation of concerns; standings cache can have its own TTL independent of team metadata.
- If we add a future Standings page, the endpoint is already there.

**Cons**
- Adds a second startup request to the client and a second route to maintain, for a feature that is one line of UI.
- Race condition surface: header may render before standings arrive — needs a "loading the second line" state or graceful blank.
- Anti-features list explicitly excludes a standings page, so the "future page" justification is weak.

**Cost**: ~45 minutes plus test surface for the merge timing.

### Option C — Lazy fetch per team on click

When a team card is clicked, fire `/api/teams/:id/standing` alongside the existing roster fetch.

**Pros**
- Smallest startup payload; standings only fetched for teams users actually visit.

**Cons**
- 12 teams × tiny payload is not a startup cost worth optimizing — premature.
- Each per-team request still has to hit the same league-wide standings endpoint upstream (ESPN doesn't expose per-team standings cheaply), so the server ends up doing the same work N times unless we cache the league response anyway. At which point Option A is strictly better.
- Adds a flicker between team-name render and context-line render.

**Cost**: ~30 minutes but worse outcome than A.

## Recommendation: Option A

It matches the existing prefetch-and-cache architecture exactly, gives the user a flicker-free render (the data is already there when `selectedTeam` is set), and adds zero new endpoints. The only real tradeoff — coupling team-list freshness to standings — is mitigated by treating standings as best-effort: if the standings fetch returns null, teams still load and the context line simply renders the city alone.

### Decisions on the open design questions

**City label:** use ESPN's `team.location` verbatim (e.g. "New York", "Connecticut", "Los Angeles", "Las Vegas"). It's already a fan-friendly long form — never the "NY" abbreviation. This is the value the user-tester implicitly asked for.

**Display format:** single line, comma-separated, in `--text-muted` color, sitting directly beneath `team-header-name`. Three segments: `record`, `seed + conference`, `location`. Example:

> 11–17 · 5th in Eastern Conference · Connecticut

Using middle dots (·) rather than commas matches the existing `player-meta` separator style in `App.jsx` (search results), keeping visual vocabulary consistent.

**Caching / TTL:** standings change at most once per game day. Cache the merged team list for 6 hours via a timestamp check (`if Date.now() - fetchedAt > 6h, refetch`). On refetch failure, keep serving the stale list — never return null to the client. This is a small extension of the existing `teamsPromise` singleton, not a new cache library.

**Edge cases:**
- **Preseason / 0-0 record:** if `wins + losses === 0`, omit the record segment entirely. Show only `seed + conference + location`. (Seed will also be meaningless preseason — see next.)
- **Seed unreliable in preseason / very early season:** if `playoffSeed` is missing, blank, or all teams in the conference are tied at 0-0, omit the seed prefix and show just the conference name (e.g. "Eastern Conference · Connecticut").
- **Standings fetch failed entirely:** team object has no standings fields. Render only `location`. Header still works.
- **Postseason:** `playoffSeed` continues to make sense ("3rd in Eastern Conference") — no special handling needed.
- **Ordinal suffix:** compute client-side or server-side from the integer seed (1st, 2nd, 3rd, 4th…). Server-side is simpler since we already format `record` there.

## API response shape after the change

`GET /api/teams` returns the same array, with each item gaining four optional fields. All four may be absent if the standings fetch failed; fields can also be individually absent (e.g. no record in preseason).

```
{
  "id": "18",
  "name": "Connecticut Sun",
  "shortName": "Sun",
  "abbreviation": "CONN",
  "color": "f05023",
  "logo": "https://.../conn.png",
  "slug": "connecticut-sun",
  "location": "Connecticut",
  "record": "11-17",
  "conference": "Eastern Conference",
  "seedLabel": "5th"
}
```

Field notes:
- `location` always present (comes from the same teams response, no dependency on standings).
- `record` is a pre-formatted `"W-L"` string. Server omits the field entirely when `wins + losses === 0`.
- `conference` is the full string `"Eastern Conference"` or `"Western Conference"` — sourced from the standings `children[]` entry name.
- `seedLabel` is the pre-ordinalized seed (`"1st"`, `"2nd"`, `"5th"`). Omitted when ESPN returns no seed or all teams are tied at 0-0.

The client never has to do format work — it just concatenates whatever non-null fields are present with the `·` separator.

## UI mockup

### Desktop

```
┌───────────────────────────────────────────────────────────┐
│ ▌  [LOGO]   Connecticut Sun                               │
│             11-17 · 5th in Eastern Conference · Connecticut│
└───────────────────────────────────────────────────────────┘
```

JSX shape (prose, not implementation):

- Wrap `team-header-name` and the new line in a flex column container so they stack vertically while the logo stays to the left.
- The new element is a `<p>` (or `<span>` rendered as block) with class `team-header-meta`.
- It contains up to three text segments separated by ` · ` (literal middle-dot with single spaces). Build the joined string from non-null fields server-side or with a tiny `[record, seedAndConf, location].filter(Boolean).join(' · ')` in the JSX — both are acceptable since neither involves new code patterns.

### Mobile (≤600px)

The team-header is already a flex row at this width with reduced padding. The meta line wraps naturally below the name. The font size on the name drops to 1.3rem; the meta line sits at ~0.78rem so it stays subordinate. If the full string overflows, allow normal text wrapping (no truncation) — the line is short enough that the worst case is two lines on the smallest phones.

```
┌─────────────────────────┐
│ ▌ [LOGO]                │
│   Connecticut Sun       │
│   11-17 · 5th in        │
│   Eastern Conference ·  │
│   Connecticut           │
└─────────────────────────┘
```

### Style guidance for `.team-header-meta`

- Color: `var(--text-muted)`.
- Font size: ~0.85rem desktop, ~0.78rem mobile.
- Font weight: 500 (lighter than the 800 name).
- Margin-top: ~0.25rem under the name.
- No background, no border, no chips — single-line text only.
- No new colors or gradients (matches the dark + orange-stripe constraint).

## File-by-file implementation sketch

### `server/lib/espnClient.js`

1. Add a constant for the standings URL and a module-level cache `let standingsCache = null; let standingsFetchedAt = 0;`.
2. Add a `fetchStandings()` function that GETs the league standings, walks `children[]` for the two conferences, and returns a map `{ [teamId]: { conference, seed, wins, losses } }`. On non-ok or parse failure, return null. Walk should be tolerant: missing stat names just leave that field undefined.
3. Add a small `formatSeedLabel(n)` helper (1→"1st", 2→"2nd", 3→"3rd", default `${n}th`, with the standard 11/12/13 exception).
4. Modify `fetchTeams()` to also fetch standings (in parallel via `Promise.all`), then for each team append `location: t.location`, plus the four standings-derived fields when available. Apply the preseason-omit and missing-seed-omit rules here so the response is already shaped.
5. Replace the `let teamsPromise = null` singleton with a `getTeams()` that re-runs `fetchTeams()` if `Date.now() - fetchedAt > 6 * 60 * 60 * 1000`. On refetch failure, keep returning the prior cached value rather than throwing.
6. The existing startup prefetch chain (`getTeams().then(... rosters ...)`) still works unchanged.

### `server/routes/api.js`

No changes required. `/api/teams` and `/api/teams/:id/roster` both flow through `getTeams()` which now produces the enriched objects. The `team` object included in the roster response also carries the new fields automatically.

### `client/src/App.jsx`

1. In the `view === 'team'` block, wrap `<h2 className="team-header-name">` and a new `<p className="team-header-meta">` in a `<div className="team-header-text">` so they stack vertically next to the logo.
2. Build the meta string by filtering and joining the three segments. Keep the logic inline — no helper file warranted for this.
3. If all three segments are absent (standings fetch failed and even location is missing — practically never), don't render the `<p>` at all.

### `client/src/App.css`

1. Add `.team-header-text { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }` so the name and meta share the right side of the header.
2. Add `.team-header-meta { font-size: 0.85rem; font-weight: 500; color: var(--text-muted); line-height: 1.4; }`.
3. In the `@media (max-width: 600px)` block, drop `.team-header-meta` to `font-size: 0.78rem`.
4. The existing `.team-header { display: flex; align-items: center; gap: 1.25rem; }` already handles the logo-on-left layout — no change needed there.

### Tests / smoke check

- Hit `/api/teams` locally and verify each team has `location` and (in-season) `record`, `conference`, `seedLabel`.
- Visit Connecticut Sun, New York Liberty, Las Vegas Aces in the UI and visually confirm the new line.
- Force a standings fetch failure (block the URL or mock a 500) and confirm the page still renders with city only.
- Confirm mobile viewport (≤600px) wraps cleanly.

## Risks and mitigations

| Risk | Where it lives | Mitigation |
| --- | --- | --- |
| ESPN standings URL or shape changes (e.g. `children` becomes `groups`, stat names change) | `server/lib/espnClient.js → fetchStandings()` | Defensive parsing — every field reads through optional chaining and a missing field omits the corresponding UI segment rather than crashing. The team list itself does not depend on standings success. |
| Standings fetch slow on cold start, blocking team list | `fetchTeams()` parallel fetch | Use `Promise.all` so the slower of the two requests gates the response, but cap the wait: if standings hasn't returned in ~3s, resolve teams without it (lookup map = empty). The next 6h refresh tries again. Optional — add only if cold-start latency is observed. |
| Stale records during a game in progress | 6h TTL | Acceptable — a fan visiting a team page is doing roster study, not following live scores. Document the staleness expectation in a brief comment near the cache. |
| Preseason 1-0 looks weird ("1-0 · 1st in Eastern Conference") | Seed-omit rule in `fetchStandings` | Already addressed: omit seed when all conference teams are 0-0 OR when seed is missing. A 1-0 record on its own is honest data and stays. |
| `team.color` already had a default fallback (`'555555'`); make sure new fields follow the same pattern | `fetchTeams()` mapper | Use `t.location || null` not `t.location || ''` so the client `.filter(Boolean)` correctly drops empty values. |
| New `<p>` inside team-header changes layout flow | `App.css` flex container | The new flex-column wrapper isolates the change; the logo's vertical alignment stays centered relative to the name+meta block. |

## Anti-features (explicitly out of scope)

- **No standings page.** Single-line addition only. No `/standings` route, no nav entry, no "view full standings" link.
- **No division standings.** WNBA doesn't use divisions and ESPN doesn't expose them; ignore even if the API ever adds them.
- **No head-to-head, no last-10, no streak chip.** ESPN exposes `streak` ("W3") and avg points-for/against; do not add them. The user-tester asked for record + seed + conference + city. Stop there.
- **No standings sparkline, no trend arrow, no rank delta.** Plain text.
- **No team-page redesign.** No new chips, no badges, no two-line layout with separators. The `team-header` keeps its current padding, border-left stripe, and logo size.
- **No live game indicator.** If the team is currently playing, we don't show "LIVE" or current score. Out of scope for this slice.
- **No premium gating.** Record and seed are public info; do not put behind the premium banner.
- **No new dependencies.** No date library, no ordinal-suffix package — write the four-line `formatSeedLabel` inline.
- **No client-side standings cache.** The server's 6h cache is sufficient; the client just consumes whatever `/api/teams` returns.
