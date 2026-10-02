/**
 * Auth.js — authentication and authorization for the Apps Script API.
 *
 * This endpoint is deployed as a web app with "Execute as: Me" / access
 * "Anyone with the link" (see appsscript.json) so that Next.js's server can
 * call it without a Google OAuth redirect. Because that means the URL
 * itself is not secret, every request MUST carry the shared-secret
 * `X-Api-Key` header (actually delivered as a query/body param — Apps
 * Script web apps cannot read arbitrary custom headers — see
 * `e.parameter.apiKey` below and src/lib/apps-script.ts, which sends it as
 * a query param, not a header, for that reason).
 *
 * Identity/role: Next.js has already authenticated the end user (NextAuth +
 * Google Sign-In) and resolved their role from Supabase BEFORE calling this
 * API, and passes both along as `actorEmail` / `actorRole` params. Apps
 * Script trusts these only because they arrive alongside a valid API key
 * from our own trusted server — this is defense in depth, not the primary
 * authentication boundary. Never relax the API key check "to make testing
 * easier" in a deployed version.
 */

var ROLE_RANK_ = { viewer: 0, editor: 1, admin: 2 };

function authenticateRequest_(e) {
  const providedKey = (e.parameter && e.parameter.apiKey) || "";
  const expectedKey = getScriptProperty_("API_KEY");
  if (!providedKey || providedKey !== expectedKey) {
    throw AppError_("UNAUTHORIZED", "Invalid or missing API key.");
  }

  const actorEmail = (e.parameter && e.parameter.actorEmail) || null;
  const actorRole = (e.parameter && e.parameter.actorRole) || "viewer";
  return { actorEmail: actorEmail, actorRole: actorRole };
}

/** Throws AUTHORIZATION_FAILURE if `actor.role` is weaker than `requiredRole`. */
function requireRole_(actor, requiredRole) {
  const actorRank = ROLE_RANK_[actor.role] !== undefined ? ROLE_RANK_[actor.role] : -1;
  const requiredRank = ROLE_RANK_[requiredRole] !== undefined ? ROLE_RANK_[requiredRole] : 99;
  if (actorRank < requiredRank) {
    throw AppError_("AUTHORIZATION_FAILURE", 'This action requires the "' + requiredRole + '" role or higher.');
  }
}
