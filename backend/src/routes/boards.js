const router = require("express").Router({ mergeParams: true });
const { Board, List, Task, Membership } = require("../models");
const { logActivity } = require("../lib/activity");
const { requirePerm } = require("../middleware/auth");
const { emitBoard } = require("../lib/socket");
const { invalidateDashboard } = require("../lib/cache");
const { enqueue } = require("../lib/jobs");
const { GAP } = require("../lib/ordering");
const { isStr, isId } = require("../lib/validate");

router.get("/", requirePerm("read"), async (req, res) => {
  res.json(await Board.find({ workspaceId: req.workspaceId }));
});

router.post("/", requirePerm("write"), async (req, res) => {
  const { name } = req.body || {};
  if (!isStr(name, 1, 80)) return res.status(400).json({ error: "Invalid input" });
  const board = await Board.create({ name, workspaceId: req.workspaceId });
  await logActivity(req.workspaceId, req.userId, "board.created", board._id);
  invalidateDashboard(req.workspaceId);
  res.status(201).json(board);
});

router.get("/:boardId", requirePerm("read"), async (req, res) => {
  if (!isId(req.params.boardId)) return res.status(404).json({ error: "Not found" });
  const board = await Board.findOne({ _id: req.params.boardId, workspaceId: req.workspaceId });
  if (!board) return res.status(404).json({ error: "Not found" });
  const [lists, tasks] = await Promise.all([
    List.find({ boardId: board._id, workspaceId: req.workspaceId }).sort({ position: 1 }).lean(),
    Task.find({ boardId: board._id, workspaceId: req.workspaceId }).sort({ position: 1 }).lean(),
  ]);
  res.json({
    ...board.toObject(),
    lists: lists.map((l) => ({ ...l, tasks: tasks.filter((t) => String(t.listId) === String(l._id)) })),
  });
});

router.post("/:boardId/lists", requirePerm("write"), async (req, res) => {
  const { name } = req.body || {};
  if (!isStr(name, 1, 80) || !isId(req.params.boardId)) return res.status(400).json({ error: "Invalid input" });
  const board = await Board.findOne({ _id: req.params.boardId, workspaceId: req.workspaceId });
  if (!board) return res.status(404).json({ error: "Not found" });
  const last = await List.findOne({ boardId: board._id }).sort({ position: -1 });
  const list = await List.create({ name, boardId: board._id, workspaceId: req.workspaceId, position: (last ? last.position : 0) + GAP });
  await logActivity(req.workspaceId, req.userId, "list.created", list._id);
  invalidateDashboard(req.workspaceId);
  emitBoard(String(board._id), "list:created", list);
  res.status(201).json(list);
});

router.post("/:boardId/lists/:listId/tasks", requirePerm("write"), async (req, res) => {
  const { title, description = "", assigneeId = null, labels = [] } = req.body || {};
  if (!isStr(title, 1, 200) || (description && !isStr(description, 0, 5000)) ||
      !Array.isArray(labels) || labels.length > 10 || !labels.every((l) => isStr(l, 1, 30)) ||
      (assigneeId !== null && !isId(assigneeId)) || !isId(req.params.boardId) || !isId(req.params.listId))
    return res.status(400).json({ error: "Invalid input" });

  const list = await List.findOne({ _id: req.params.listId, boardId: req.params.boardId, workspaceId: req.workspaceId });
  if (!list) return res.status(404).json({ error: "Not found" });
  if (assigneeId && !(await Membership.findOne({ userId: assigneeId, workspaceId: req.workspaceId })))
    return res.status(400).json({ error: "Assignee is not a workspace member" });

  const last = await Task.findOne({ listId: list._id }).sort({ position: -1 });
  const task = await Task.create({
    title, description, labels, assigneeId,
    listId: list._id, boardId: list.boardId, workspaceId: req.workspaceId,
    position: (last ? last.position : 0) + GAP,
  });
  await logActivity(req.workspaceId, req.userId, "task.created", task._id, { title });
  invalidateDashboard(req.workspaceId);
  emitBoard(String(list.boardId), "task:created", task);
  if (assigneeId && assigneeId !== String(req.userId))
    enqueue("task.assigned", { workspaceId: req.workspaceId, assigneeId, title }); // runs in the background, does not block the response
  res.status(201).json(task);
});

module.exports = router;
