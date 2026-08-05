// routeValidation.js — shared Express param validators for server/routes/*.
//
// ESPN team ids are integers passed as :id route params. Every route that takes a
// team id independently re-implemented the same /^\d+$/ regex check inline; this was
// extracted so the check (and its error message) can't drift between routes.

// Returns Express middleware that 400s when req.params[paramName] isn't a bare numeric
// string, else calls next(). paramName defaults to 'id' (the common case).
function requireNumericId(paramName = 'id') {
  return (req, res, next) => {
    if (!/^\d+$/.test(req.params[paramName])) {
      return res.status(400).json({ error: `${paramName} must be a numeric string` });
    }
    next();
  };
}

module.exports = { requireNumericId };
