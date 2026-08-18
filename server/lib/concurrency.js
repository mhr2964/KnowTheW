// Process `items` through async `fn` at most `limit` at a time (chunked). Errors per item are the
// caller's responsibility (fn should not throw) -- used by batch/seed jobs that fan out one upstream
// call per item and need to stay friendly to that upstream's rate limits rather than opening
// hundreds of sockets at once.
async function mapWithConcurrency(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    out.push(...await Promise.all(chunk.map(fn)));
  }
  return out;
}

module.exports = { mapWithConcurrency };
