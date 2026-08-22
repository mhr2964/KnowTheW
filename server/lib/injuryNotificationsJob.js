// lib/injuryNotificationsJob.js — polls every repped team's current injury report and creates one
// in-app notification per user for each currently-injured player on their repped team, so "your
// repped player is now questionable" surfaces alongside the existing pre-game kickoff alert (see
// notificationsJob.js) in the same bell. Framework-free, same db/provider/now-as-parameters shape
// as notificationsJob.js, for the same reason (internal-route-invokable, test-fixturable with no
// real Mongo/BDL connection required).
//
// Shares the `notifications` collection and its TTL index with notificationsJob.js (see db.js) but
// NOT its userId_gameId unique index -- injury docs have no gameId, so idempotency here runs off a
// separate partial unique index on {userId, playerId, status} (db.js), scoped to type:'injury'
// only. Re-detecting the SAME status on a later poll is a harmless duplicate-key no-op; a genuine
// status change (e.g. 'Day-To-Day' -> 'Out') has a different `status` value and inserts a fresh
// notification, which is the actual "status changed" signal this job exists to produce -- there's
// no separate "last known status" cache to maintain, the unique index IS the change detector.
//
// No natural "kickoff" to anchor a short TTL against (unlike a game notification, which is
// meaningless a few hours after tipoff) -- 48h is long enough to surface in the bell across a
// weekend without lingering indefinitely once a status is stale news.
const INJURY_NOTIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

async function pollAndCreateInjuryNotifications({ db, provider, now = new Date() }) {
  const teamIds = await db.collection('users').distinct('teamRepId', { teamRepId: { $ne: null } });

  let checkedInjuries = 0;
  let created = 0;
  let duplicatesSkipped = 0;
  let errors = 0;

  // Fan out every repped team's getTeamInjuries call at once, same router-timeout reasoning as
  // notificationsJob.js's schedule fan-out -- allSettled so one team's rejected call doesn't abort
  // the rest of this poll cycle.
  const results = await Promise.allSettled(teamIds.map(teamId => provider.getTeamInjuries(teamId)));

  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];
    const settled = results[i];

    if (settled.status === 'rejected') {
      console.error(`injuryNotificationsJob: getTeamInjuries(${teamId}) threw:`, settled.reason);
      continue;
    }

    // Rows with no resolved playerId (see idMap.js's resolveEspnIdByName) can't be attributed to a
    // specific player page or deduped by the partial index -- skip rather than notify with a
    // playerId of null, which would collide across every unresolved player for the same user.
    const injuries = (settled.value ?? []).filter(inj => inj.playerId != null);
    checkedInjuries += injuries.length;
    if (injuries.length === 0) continue;

    const repUsers = await db.collection('users').find({ teamRepId: teamId }).project({ _id: 1 }).toArray();
    if (repUsers.length === 0) continue;

    const docs = [];
    for (const inj of injuries) {
      for (const user of repUsers) {
        docs.push({
          type: 'injury',
          userId: user._id,
          teamRepId: teamId,
          playerId: inj.playerId,
          playerName: inj.playerName,
          status: inj.status,
          returnDate: inj.returnDate,
          comment: inj.comment,
          createdAt: now,
          expiresAt: new Date(now.getTime() + INJURY_NOTIFICATION_TTL_MS),
        });
      }
    }
    if (docs.length === 0) continue;

    try {
      // Same unordered-insertMany + insertedCount-over-writeErrors discipline as
      // notificationsJob.js -- see that file's own comment for exactly why insertedCount (not
      // docs.length - writeErrors.length) is the only value that reflects what the driver actually
      // confirmed was written.
      const result = await db.collection('notifications').insertMany(docs, { ordered: false });
      created += result.insertedCount ?? docs.length;
    } catch (err) {
      const writeErrors = err.writeErrors || [];
      const dupErrors = writeErrors.filter(we => we.code === 11000);
      const otherErrors = writeErrors.filter(we => we.code !== 11000);
      const insertedCount = err.insertedCount ?? 0;

      created += insertedCount;
      duplicatesSkipped += dupErrors.length;

      if (writeErrors.length === 0) {
        errors += 1;
        console.error(
          `injuryNotificationsJob: insertMany failed with no per-document write detail (driver/network-level failure, not per-doc errors) — inserted ${insertedCount} of ${docs.length}:`,
          err
        );
      } else {
        errors += otherErrors.length;
        if (otherErrors.length > 0) {
          console.error('injuryNotificationsJob: insertMany write errors (non-duplicate):', otherErrors);
        }
      }
    }
  }

  return { checkedTeams: teamIds.length, checkedInjuries, created, duplicatesSkipped, errors };
}

module.exports = { pollAndCreateInjuryNotifications };
