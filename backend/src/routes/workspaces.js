const router = require("express").Router();
const mongoose = require("mongoose");
const { Workspace, Membership, User, ActivityLog, Task, List, Board } = require("../models");
const { logActivity } = require("../lib/activity");
const { requirePerm } = require("../middleware/auth");
const { canManageTarget } = require("../lib/permissions");
const { cache, dashKey } = require("../lib/cache");
const { isStr, isEmail, isId } = require("../lib/validate");

const INVITE_ROLES = ["ADMIN", "MEMBER", "VIEWER"]; // the OWNER role cannot be granted through an invite

router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!isStr(name, 1, 80)) return res.status(400).json({ error: "Invalid input" });
  const ws = await Workspace.create({ name });
  try {
    await Membership.create({ userId: req.userId, workspaceId: ws._id, role: "OWNER" });
  } catch (e) {
    await Workspace.deleteOne({ _id: ws._id }); // manual rollback (Mongo transactions require a replica set)
    throw e;
  }
  await logActivity(ws._id, req.userId, "workspace.created", ws._id);
  res.status(201).json(ws);
});

router.get("/", async (req, res) => {
  const ms = await Membership.find({ userId: req.userId }).populate("workspaceId");
  res.json(ms.filter((m) => m.workspaceId).map((m) => ({ ...m.workspaceId.toObject(), role: m.role })));
});

router.get("/:workspaceId/members", requirePerm("read"), async (req, res) => {
  const ms = await Membership.find({ workspaceId: req.workspaceId }).populate("userId", "name email");
  res.json(ms.map((m) => ({ id: m.userId._id, name: m.userId.name, email: m.userId.email, role: m.role })));
});

router.post("/:workspaceId/members", requirePerm("manageMembers"), async (req, res) => {
  const { email, role } = req.body || {};
  if (!isEmail(email) || !INVITE_ROLES.includes(role)) return res.status(400).json({ error: "Invalid input" });
  if (role === "ADMIN" && req.role !== "OWNER") return res.status(403).json({ error: "Forbidden" });
  // LIMITATION: only existing users can be added; an email-invite flow is listed under next steps in the README
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(404).json({ error: "User not found" });
  try {
    await Membership.create({ userId: user._id, workspaceId: req.workspaceId, role });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "Already a member" }); // raised by the unique index
    throw e;
  }
  await logActivity(req.workspaceId, req.userId, "member.added", user._id, { role });
  res.status(201).json({ id: user._id, role });
});

router.patch("/:workspaceId/members/:userId", requirePerm("manageMembers"), async (req, res) => {
  const { role } = req.body || {};
  if (!INVITE_ROLES.includes(role) || !isId(req.params.userId)) return res.status(400).json({ error: "Invalid input" });
  const target = await Membership.findOne({ userId: req.params.userId, workspaceId: req.workspaceId });
  if (!target) return res.status(404).json({ error: "Not found" });
  if (!canManageTarget(req.role, target.role) || (role === "ADMIN" && req.role !== "OWNER"))
    return res.status(403).json({ error: "Forbidden" });
  const from = target.role;
  target.role = role;
  await target.save();
  await logActivity(req.workspaceId, req.userId, "member.role_changed", target.userId, { from, to: role });
  res.json({ userId: target.userId, role });
});

router.delete("/:workspaceId/members/:userId", requirePerm("manageMembers"), async (req, res) => {
  if (!isId(req.params.userId)) return res.status(404).json({ error: "Not found" });
  const target = await Membership.findOne({ userId: req.params.userId, workspaceId: req.workspaceId });
  if (!target) return res.status(404).json({ error: "Not found" });
  if (!canManageTarget(req.role, target.role)) return res.status(403).json({ error: "Forbidden" });
  await target.deleteOne();
  await logActivity(req.workspaceId, req.userId, "member.removed", target.userId);
  res.status(204).end();
});


router.get("/:workspaceId/activity", requirePerm("read"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter = { workspaceId: req.workspaceId };
  if (typeof req.query.cursor === "string" && isId(req.query.cursor)) filter._id = { $lt: req.query.cursor };
  const rows = await ActivityLog.find(filter).sort({ _id: -1 }).limit(limit + 1).populate("actorId", "name");
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  res.json({ items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null });
});


router.get("/:workspaceId/dashboard", requirePerm("read"), async (req, res) => {
  const key = dashKey(req.workspaceId);
  const hit = await cache.get(key);
  if (hit) return res.json({ ...hit, cached: true });

  const wid = new mongoose.Types.ObjectId(req.workspaceId); 
  const [boards, members, byList, byAssignee] = await Promise.all([
    Board.countDocuments({ workspaceId: wid }),
    Membership.countDocuments({ workspaceId: wid }),
    Task.aggregate([{ $match: { workspaceId: wid } }, { $group: { _id: "$listId", count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { workspaceId: wid } }, { $group: { _id: "$assigneeId", count: { $sum: 1 } } }]),
  ]);
  const lists = await List.find({ _id: { $in: byList.map((x) => x._id) } }, "name");
  const nameOf = Object.fromEntries(lists.map((l) => [String(l._id), l.name]));
  const data = {
    boards,
    members,
    totalTasks: byList.reduce((s, x) => s + x.count, 0),
    tasksPerList: byList.map((x) => ({ listId: x._id, name: nameOf[String(x._id)], count: x.count })),
    tasksPerAssignee: byAssignee.map((x) => ({ assigneeId: x._id, count: x.count })),
  };
  await cache.set(key, data, 60);
  res.json({ ...data, cached: false });
});

router.use("/:workspaceId/boards", require("./boards"));
router.use("/:workspaceId/tasks", require("./tasks"));

module.exports = router;
