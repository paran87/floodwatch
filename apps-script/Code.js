/**
 * Code.js — main API entry point and action router.
 *
 *   doGet/doPost
 *        -> authenticateRequest_   (Auth.js: API key + trusted actor identity)
 *        -> route by e.parameter.action
 *        -> requireRole_ per action, where relevant (Auth.js)
 *        -> feature module (FloodProneAreas.js / Dashboard.js)
 *        -> successResponse_ / errorResponse_ (Response.js)
 *
 * Read-only actions only, for now — see FloodProneAreas.js and spec
 * section 31/38 on why write actions are not wired up in this initial
 * scaffold.
 */

var READ_ACTIONS_ = {
  getFloodProneAreas: action_getFloodProneAreas_,
  getFloodProneArea: action_getFloodProneArea_,
  getFloodProneAreaFacets: action_getFloodProneAreaFacets_,
  getDashboardStats: action_getDashboardStats_,
};

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    const actor = authenticateRequest_(e);
    const action = e.parameter.action;

    if (!action) {
      throw AppError_("VALIDATION_FAILURE", "Missing required `action` parameter.");
    }

    const handler = READ_ACTIONS_[action];
    if (!handler) {
      throw AppError_("UNKNOWN_ACTION", 'Unknown action: "' + action + '".');
    }

    const data = handler(e, actor);
    return successResponse_(data);
  } catch (error) {
    return errorResponse_(error);
  }
}
