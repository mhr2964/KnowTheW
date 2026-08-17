// fakeMongoFilter.js — test-support only, not a *.test.js file so `node --test` won't run it as
// a suite. A tiny shared filter matcher used by both test/lib/fakeUsersDb.js (distinct/find) and
// test/lib/fakeNotificationsDb.js (find), so the two in-memory fakes agree on how a Mongo-style
// filter object matches a stored doc instead of each hand-rolling its own (and drifting).
//
// Only supports what the actual production code in this repo calls with today: exact-value
// equality (including ObjectId, via its own .equals()), and the $ne/$eq/$gt/$gte/$lt/$lte
// operators. Anything wider is deliberately out of scope — this exists to back real call sites,
// not to be a general Mongo query emulator.

// Mirrors MongoDB's own equality semantics for a missing field: a doc that never set `field` at
// all is treated the same as `field: null` (real Mongo does this for both direct equality and
// $ne comparisons against null), not treated as "not equal to null".
function normalize(value) {
  return value === undefined ? null : value;
}

function valuesEqual(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na && typeof na.equals === 'function') return na.equals(nb);
  if (na instanceof Date || nb instanceof Date) return new Date(na).getTime() === new Date(nb).getTime();
  return na === nb;
}

function isOperatorObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    typeof value.equals !== 'function'
  );
}

function matchesOperators(actual, operators) {
  return Object.entries(operators).every(([op, expected]) => {
    switch (op) {
      case '$eq':  return valuesEqual(actual, expected);
      case '$ne':  return !valuesEqual(actual, expected);
      case '$gt':  return new Date(actual).getTime() >  new Date(expected).getTime();
      case '$gte': return new Date(actual).getTime() >= new Date(expected).getTime();
      case '$lt':  return new Date(actual).getTime() <  new Date(expected).getTime();
      case '$lte': return new Date(actual).getTime() <= new Date(expected).getTime();
      default:
        throw new Error(`fakeMongoFilter: unsupported operator "${op}"`);
    }
  });
}

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (isOperatorObject(expected)) return matchesOperators(actual, expected);
    return valuesEqual(actual, expected);
  });
}

module.exports = { matchesFilter };
