
const CAN = {
  read: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  write: ["OWNER", "ADMIN", "MEMBER"],
  manageMembers: ["OWNER", "ADMIN"],
  deleteWorkspace: ["OWNER"],
};
const can = (role, perm) => !!CAN[perm] && CAN[perm].includes(role);

// Nobody can modify an Owner. An Admin can only manage Members and Viewers.
const canManageTarget = (actorRole, targetRole) => {
  if (targetRole === "OWNER") return false;
  if (targetRole === "ADMIN") return actorRole === "OWNER";
  return actorRole === "OWNER" || actorRole === "ADMIN";
};
module.exports = { CAN, can, canManageTarget };
