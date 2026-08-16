// routeValidation.js — shared Express param validators for server/routes/*.
//
// ESPN team ids are integers passed as :id route params. Every route that takes a
// team id independently re-implemented the same /^\d+$/ regex check inline; this was
// extracted so the check (and its error message) can't drift between routes.

// Also used outside the :id-param case (e.g. routes/users.js validating a teamId in a
// request body) — exported as a standalone predicate so both call sites share one regex.
const NUMERIC_ID_RE = /^\d+$/;
function isNumericId(v) {
  return typeof v === 'string' && NUMERIC_ID_RE.test(v);
}

// Returns Express middleware that 400s when req.params[paramName] isn't a bare numeric
// string, else calls next(). paramName defaults to 'id' (the common case).
function requireNumericId(paramName = 'id') {
  return (req, res, next) => {
    if (!isNumericId(req.params[paramName])) {
      return res.status(400).json({ error: `${paramName} must be a numeric string` });
    }
    next();
  };
}

module.exports = { requireNumericId, isNumericId, NUMERIC_ID_RE };
