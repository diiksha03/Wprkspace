const { verifyAccess } = require("../lib/tokens");
const { Membership } = require("../models");
const { can } = require("../lib/permissions");
const { isId } = require("../lib/validate");

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.userId = verifyAccess(h.slice(7)).sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}


function requirePerm(perm) {
  return async (req, res, next) => {
    const { workspaceId } = req.params;
    if (!isId(workspaceId)) return res.status(404).json({ error: "Not found" });
    const m = await Membership.findOne({ userId: req.userId, workspaceId });
   
    if (!m) return res.status(404).json({ error: "Not found" });
    if (!can(m.role, perm)) return res.status(403).json({ error: "Forbidden" });
    req.role = m.role;
    req.workspaceId = workspaceId;
    next();
  };
}

module.exports = { requireAuth, requirePerm };
