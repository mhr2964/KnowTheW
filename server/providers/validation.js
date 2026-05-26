// Provider boundary validation — a Decorator over a SportsDataProvider that checks each normalized
// return value against the schema in ./schemas.js. This is the silent-drift alarm for the
// undocumented ESPN source (see schemas.js for why).
//
// Pattern: withValidation(provider) returns a Proxy that intercepts method calls. A method with a
// schema gets its resolved value validated; a method without one (and any non-method property, e.g.
// `name`) passes straight through. The Proxy means we don't restate the method list here — the
// schema map is the single place that decides what's validated.
//
// Failure policy splits on environment, because the right reaction differs:
//   - production: log a structured warning and PASS THE VALUE THROUGH. A drift alarm must never take
//     the live site down; degraded data beats a 500.
//   - everywhere else (dev, test, CI): THROW. We want drift to fail loudly while we can still fix it,
//     and CI to go red. (Test providers are injected un-wrapped via _setProviderForTest, so this
//     throw only ever fires against the real provider's output, never against mock fixtures.)
//
// The validated value is returned UNCHANGED — schemas only observe. We never hand downstream code a
// Zod-parsed copy, so stripped-unknown-keys or coercion can't silently alter behavior.

const { SCHEMA_BY_METHOD } = require('./schemas');

class ProviderShapeError extends Error {
  constructor(message, method, zodError) {
    super(message);
    this.name = 'ProviderShapeError';
    this.method = method;
    this.zodError = zodError;
  }
}

function check(providerName, method, schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return value;

  const detail = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  const message = `[provider:${providerName}] shape drift in ${method}(): ${detail}`;

  if (process.env.NODE_ENV === 'production') {
    console.warn(message);
    return value;
  }
  throw new ProviderShapeError(message, method, result.error);
}

/**
 * Wrap a provider so its schema-bearing methods validate their resolved return value.
 * @template {object} T
 * @param {T} provider
 * @returns {T}
 */
function withValidation(provider) {
  const providerName = provider.name;
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      const schema = SCHEMA_BY_METHOD[prop];
      if (!schema) return value.bind(target);

      return (...args) => {
        const out = value.apply(target, args);
        if (out && typeof out.then === 'function') {
          return out.then((resolved) => check(providerName, prop, schema, resolved));
        }
        return check(providerName, prop, schema, out);
      };
    },
  });
}

module.exports = { withValidation, ProviderShapeError };
