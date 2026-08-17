// lib/notificationsJob.js — polls every ESPN team schedule that has at least one rep'd user and
// creates one in-app notification per user for each game about to kick off. Framework-free (no
// req/res) and takes db/provider/now as explicit parameters rather than reaching for
// require('../db') / require('../providers') internally, so this can be invoked from the internal
// HTTP route (server/routes/internalJobs.js) and exercised directly in tests with a fake db/provider
// and a fixed clock, with no real Mongo/ESPN connection required.

// Heroku Scheduler's minimum granularity is 10 minutes (no worker dyno exists to run anything
// finer), and Scheduler is explicitly best-effort about exact spacing between runs — a poll can
// land early, late, or get skipped under load. A window exactly as wide as the nominal poll
// interval has zero slack: any real-world jitter can let a game fall through the gap between the
// poll before and the poll after it, dropping the notification entirely. 15 minutes of width
// against a 10-minute nominal interval leaves 5 minutes of slack on each side, which is very
// likely to catch every game given typical Scheduler timing — but it's not a hard guarantee.
// Notifications land somewhere in the 3-18-minutes-before range rather than at one exact point;
// this is best-effort by design, not a bug.
const DUE_WINDOW_MIN_MINUTES = 3;
const DUE_WINDOW_MAX_MINUTES = 18;

// Matches the notifications.expiresAt TTL index (server/db.js) — notifications are cleaned up a
// few hours after kickoff rather than lingering indefinitely.
const NOTIFICATION_TTL_MS = 4 * 60 * 60 * 1000;

// A team rep could be watching either a regular-season or playoff game; check both every poll.
const SEASONTYPES = [2, 3];

async function pollAndCreateNotifications({ db, provider, now = new Date() }) {
  const teamIds = await db.collection('users').distinct('teamRepId', { teamRepId: { $ne: null } });

  let checkedGames = 0;
  let created = 0;
  let duplicatesSkipped = 0;
  let errors = 0;

  // Fan out every team/seasontype's getTeamSchedule call at once instead of awaiting them one at
  // a time — sequential awaits across distinctTeams x 2 seasontypes (~26 calls at full league
  // participation) risk tripping Heroku's 30s router timeout on the /internal/jobs/notifications/poll
  // request. allSettled (not all) so one team's rejected call — e.g. ProviderShapeError, which
  // providers/validation.js throws in non-production environments on ESPN response-shape drift —
  // doesn't reject the whole batch and abort every other team's check for this poll cycle.
  const calls = [];
  for (const teamId of teamIds) {
    for (const seasontype of SEASONTYPES) {
      calls.push({ teamId, seasontype });
    }
  }
  const scheduleResults = await Promise.allSettled(
    calls.map(({ teamId, seasontype }) => provider.getTeamSchedule(teamId, now.getFullYear(), seasontype))
  );

  for (let i = 0; i < calls.length; i++) {
    const { teamId, seasontype } = calls[i];
    const settled = scheduleResults[i];

    if (settled.status === 'rejected') {
      // Thrown, not returned null — log and skip just this team/seasontype, same policy as a
      // null return below, so one bad response doesn't take down the rest of the poll.
      console.error(`notificationsJob: getTeamSchedule(${teamId}, ${seasontype}) threw:`, settled.reason);
      continue;
    }

    const events = settled.value;
    // null means the ESPN call itself failed (not "no games") — skip this team/seasontype for
    // this run rather than throwing, so one flaky upstream call doesn't abort the whole poll.
    if (!events) continue;

    checkedGames += events.length;

    const dueEvents = events.filter(event => {
      const minutesUntil = (new Date(event.date) - now) / 60000;
      return minutesUntil >= DUE_WINDOW_MIN_MINUTES && minutesUntil <= DUE_WINDOW_MAX_MINUTES;
    });
    if (dueEvents.length === 0) continue;

    const repUsers = await db.collection('users').find({ teamRepId: teamId }).project({ _id: 1 }).toArray();
    if (repUsers.length === 0) continue;

    const docs = [];
    for (const event of dueEvents) {
      for (const user of repUsers) {
        docs.push({
          userId: user._id,
          teamRepId: teamId,
          gameId: String(event.id),
          opponent: event.opponent ?? null,
          atVs: event.atVs,
          gameDate: new Date(event.date),
          createdAt: now,
          expiresAt: new Date(new Date(event.date).getTime() + NOTIFICATION_TTL_MS),
        });
      }
    }
    // Skip the round-trip entirely if there's nothing to write (e.g. every due game already
    // has a rep with no users, which can't actually happen given the repUsers check above, but
    // keeps this safe if that check is ever loosened).
    if (docs.length === 0) continue;

    try {
      // One insertMany for every user repping this team, not a loop of individual inserts — the
      // deliberate fan-out fix so notifying N users for a game costs one round-trip, not N.
      // { ordered: false } so a duplicate-key collision on one doc (idempotency: unique
      // {userId, gameId} index — a user already notified for this game on a prior poll) doesn't
      // block the rest of the batch from writing.
      const result = await db.collection('notifications').insertMany(docs, { ordered: false });
      created += result.insertedCount ?? docs.length;
    } catch (err) {
      // Node's driver throws MongoBulkWriteError on ANY failure in unordered mode, but writeErrors
      // is only populated for per-document write errors (dup keys, validation, etc). A total
      // driver-level failure — network drop, auth failure, server-selection timeout — is a plain
      // Error, not a per-doc error list, so writeErrors comes back EMPTY (confirmed against the
      // installed driver, node_modules/mongodb/lib/bulk/common.js:341 and :370-378: the branch
      // that populates writeErrors only runs when the thrown value is NOT an Error instance).
      // Treating "docs.length - writeErrors.length" as the created count is wrong for that case —
      // it reports full success when zero documents actually landed. err.insertedCount (a getter
      // that reads err.result.insertedCount, defaulting to 0 via nInserted ?? 0 — see common.js:56)
      // is the only value that reflects what the driver actually confirmed was written, so use
      // that instead of inferring from writeErrors.
      const writeErrors = err.writeErrors || [];
      const dupErrors = writeErrors.filter(we => we.code === 11000);
      const otherErrors = writeErrors.filter(we => we.code !== 11000);
      const insertedCount = err.insertedCount ?? 0;

      created += insertedCount;
      duplicatesSkipped += dupErrors.length;

      if (writeErrors.length === 0) {
        // No per-document detail at all but the call still threw: a total driver-level failure,
        // not a benign duplicate-key skip. This is an actual outage (e.g. Mongo unreachable) —
        // count it and log loudly so a sustained hiccup shows up instead of silently vanishing.
        errors += 1;
        console.error(
          `notificationsJob: insertMany failed with no per-document write detail (driver/network-level failure, not per-doc errors) — inserted ${insertedCount} of ${docs.length}:`,
          err
        );
      } else {
        errors += otherErrors.length;
        if (otherErrors.length > 0) {
          // Duplicate-key skips are expected steady-state noise (idempotency working as designed);
          // anything else is a real write failure and must not be swallowed.
          console.error('notificationsJob: insertMany write errors (non-duplicate):', otherErrors);
        }
      }
    }
  }

  return { checkedTeams: teamIds.length, checkedGames, created, duplicatesSkipped, errors };
}

module.exports = { pollAndCreateNotifications, DUE_WINDOW_MIN_MINUTES, DUE_WINDOW_MAX_MINUTES };
