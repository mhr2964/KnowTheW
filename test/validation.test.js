// M7 boundary-validation tests. These prove the drift alarm without touching ESPN: we wrap a fake
// provider whose returns we control, then assert valid shapes pass untouched, drifted shapes throw
// (dev/test) or log-and-pass (production), async returns are handled, and unvalidated methods and
// plain properties are forwarded unchanged.

process.env.NODE_ENV = 'test';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');

const { withValidation, ProviderShapeError } = require('../server/providers/validation');

const VALID_TEAMS = [
  { id: '9', name: 'Seattle Storm', abbreviation: 'SEA', color: '2c5235', logo: null },
];

function fakeProvider(overrides = {}) {
  return withValidation({
    name: 'espn',
    notValidated: () => ({ anything: 'goes' }),
    getTeams: async () => VALID_TEAMS,
    getPlayerBasics: async () => ({ id: '1', name: 'A', position: 'G' }),
    ...overrides,
  });
}

afterEach(() => { delete process.env.NODE_ENV; process.env.NODE_ENV = 'test'; });

test('a valid return passes through unchanged (same reference, not a parsed copy)', async () => {
  const p = fakeProvider();
  const out = await p.getTeams();
  assert.strictEqual(out, VALID_TEAMS);
});

test('plain properties (name) and unvalidated methods are forwarded untouched', async () => {
  const p = fakeProvider();
  assert.strictEqual(p.name, 'espn');
  assert.deepStrictEqual(p.notValidated(), { anything: 'goes' });
});

test('a drifted return throws ProviderShapeError in dev/test, naming the method', async () => {
  // abbreviation went missing — exactly the kind of silent structural drift we want caught.
  const p = fakeProvider({ getTeams: async () => [{ id: '9', name: 'Storm', color: 'fff', logo: null }] });
  await assert.rejects(
    () => p.getTeams(),
    (err) => err instanceof ProviderShapeError && err.method === 'getTeams' && /shape drift/.test(err.message)
  );
});

test('a nullable return (getPlayerBasics → null) is valid', async () => {
  const p = fakeProvider({ getPlayerBasics: async () => null });
  assert.strictEqual(await p.getPlayerBasics(), null);
});

test('in production, drift logs a warning and passes the value through instead of throwing', async () => {
  process.env.NODE_ENV = 'production';
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const bad = [{ id: '9', name: 'Storm', color: 'fff', logo: null }]; // missing abbreviation
    const p = fakeProvider({ getTeams: async () => bad });
    const out = await p.getTeams();
    assert.strictEqual(out, bad); // degraded data beats a 500
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /\[provider:espn\] shape drift in getTeams\(\)/);
  } finally {
    console.warn = orig;
  }
});
