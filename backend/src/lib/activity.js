const { ActivityLog } = require("../models");
const logActivity = (workspaceId, actorId, action, entityId, meta) =>
  ActivityLog.create({ workspaceId, actorId, action, entityId, meta });
module.exports = { logActivity };
