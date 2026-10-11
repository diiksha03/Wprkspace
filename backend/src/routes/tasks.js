const router = require("express").Router({ mergeParams: true });
const { Task, List, Membership } = require("../models");
const { logActivity } = require("../lib/activity");
const { requirePerm } = require("../middleware/auth");
const { emitBoard } = require("../lib/socket");
const { invalidateDashboard } = require("../lib/cache");
const { enqueue } = require("../lib/jobs");
const { GAP, calcPosition } = require("../lib/ordering");
const { isStr, isId } = require("../lib/validate");

router.get("/", requirePerm("read"), async (req, res) => {
  const { q, assigneeId, label, listId } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const filter = { workspaceId: req.workspaceId };
  if (q !== undefined) { if (!isStr(q, 1, 100)) return res.status(400).json({ error: "Invalid q" }); filter.$text = { $search: q }; }
  if (assigneeId !== undefined) { if (!isId(assigneeId)) return res.status(400).json({ error: "Invalid assigneeId" }); filter.assigneeId = assigneeId; }
  if (listId !== undefined) { if (!isId(listId)) return res.status(400).json({ error: "Invalid listId" }); filter.listId = listId; }
  if (label !== undefined) { if (!isStr(label, 1, 30)) return res.status(400).json({ error: "Invalid label" }); filter.labels = label; }

  const projection = q ? { score: { $meta: "textScore" } } : {};
  const sort = q ? { score: { $meta: "textScore" } } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    Task.find(filter, projection).sort(sort).skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

router.patch("/:taskId", requirePerm("write"), async (req, res) => {
  const { version, title, description, assigneeId, labels } = req.body || {};
  if (!Number.isInteger(version) || !isId(req.params.taskId)) return res.status(400).json({ error: "Invalid input" });
  const set = {};
  if (title !== undefined) { if (!isStr(title, 1, 200)) return res.status(400).json({ error: "Invalid title" }); set.title = title; }
  if (description !== undefined) { if (!isStr(description, 0, 5000)) return res.status(400).json({ error: "Invalid description" }); set.description = description; }
  if (labels !== undefined) {
    if (!Array.isArray(labels) || labels.length > 10 || !labels.every((l) => isStr(l, 1, 30))) return res.status(400).json({ error: "Invalid labels" });
    set.labels = labels;
  }
  if (assigneeId !== undefined) {
    if (assigneeId !== null) {
      if (!isId(assigneeId) || !(await Membership.findOne({ userId: assigneeId, workspaceId: req.workspaceId })))
        return res.status(400).json({ error: "Invalid assignee" });
    }
    set.assigneeId = assigneeId;
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.workspaceId, version },
    { $set: set, $inc: { version: 1 } },
    { new: true }
  );
  if (!task) {
    const current = await Task.findOne({ _id: req.params.taskId, workspaceId: req.workspaceId });
    return current
      ? res.status(409).json({ error: "Task was modified by someone else", current })
      : res.status(404).json({ error: "Not found" });
  }
  await logActivity(req.workspaceId, req.userId, "task.updated", task._id, set);
  invalidateDashboard(req.workspaceId);
  emitBoard(String(task.boardId), "task:updated", task);
  if (set.assigneeId && set.assigneeId !== String(req.userId))
    enqueue("task.assigned", { workspaceId: req.workspaceId, assigneeId: set.assigneeId, title: task.title });
  res.json(task);
});

router.post("/:taskId/move", requirePerm("write"), async (req, res) => {
  const { listId, prevId = null, nextId = null } = req.body || {};
  if (!isId(listId) || !isId(req.params.taskId) || (prevId !== null && !isId(prevId)) || (nextId !== null && !isId(nextId)))
    return res.status(400).json({ error: "Invalid input" });

  const task = await Task.findOne({ _id: req.params.taskId, workspaceId: req.workspaceId });
  const target = await List.findOne({ _id: listId, workspaceId: req.workspaceId });
  if (!task || !target || String(target.boardId) !== String(task.boardId)) return res.status(404).json({ error: "Not found" });

  const neighbor = (id) => (id ? Task.findOne({ _id: id, listId: target._id }) : null);
  let [prev, next] = await Promise.all([neighbor(prevId), neighbor(nextId)]);
  let { position, needsRebalance } = calcPosition(prev ? prev.position : null, next ? next.position : null);

  if (needsRebalance) {
    const all = await Task.find({ listId: target._id, _id: { $ne: task._id } }).sort({ position: 1 });
    await Task.bulkWrite(all.map((t, i) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { position: (i + 1) * GAP } } } })));
    [prev, next] = await Promise.all([neighbor(prevId), neighbor(nextId)]);
    ({ position } = calcPosition(prev ? prev.position : null, next ? next.position : null));
    emitBoard(String(target.boardId), "list:rebalanced", { listId: String(target._id) }); // tells clients to refetch the board
  }

  const fromList = task.listId;
  const moved = await Task.findOneAndUpdate(
    { _id: task._id, workspaceId: req.workspaceId },
    { $set: { listId: target._id, position }, $inc: { version: 1 } },
    { new: true }
  );
  await logActivity(req.workspaceId, req.userId, "task.moved", task._id, { from: fromList, to: target._id });
  invalidateDashboard(req.workspaceId);
  emitBoard(String(target.boardId), "task:moved", moved);
  res.json(moved);
});

router.delete("/:taskId", requirePerm("write"), async (req, res) => {
  if (!isId(req.params.taskId)) return res.status(404).json({ error: "Not found" });
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, workspaceId: req.workspaceId });
  if (!task) return res.status(404).json({ error: "Not found" });
  await logActivity(req.workspaceId, req.userId, "task.deleted", task._id, { title: task.title });
  invalidateDashboard(req.workspaceId);
  emitBoard(String(task.boardId), "task:deleted", { id: String(task._id) });
  res.status(204).end();
});

module.exports = router;
