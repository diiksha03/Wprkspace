const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

const User = model("User", new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true }));

const Workspace = model("Workspace", new Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true }));

const membershipSchema = new Schema({
  userId: oid("User", { required: true }),
  workspaceId: oid("Workspace", { required: true }),
  role: { type: String, enum: ROLES, required: true },
}, { timestamps: true });
membershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });
const Membership = model("Membership", membershipSchema);

const Board = model("Board", new Schema({
  workspaceId: oid("Workspace", { required: true, index: true }),
  name: { type: String, required: true, trim: true },
}, { timestamps: true }));

const List = model("List", new Schema({
  workspaceId: oid("Workspace", { required: true }),
  boardId: oid("Board", { required: true, index: true }),
  name: { type: String, required: true, trim: true },
  position: { type: Number, required: true },
}, { timestamps: true }));

const taskSchema = new Schema({
  workspaceId: oid("Workspace", { required: true }),
  boardId: oid("Board", { required: true }),
  listId: oid("List", { required: true }),
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  labels: { type: [String], default: [] },
  assigneeId: oid("User", { default: null }),
  position: { type: Number, required: true },
  version: { type: Number, default: 1 }, // optimistic locking
}, { timestamps: true });
taskSchema.index({ listId: 1, position: 1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1 });
taskSchema.index({ title: "text", description: "text" });
const Task = model("Task", taskSchema);

const activitySchema = new Schema({
  workspaceId: oid("Workspace", { required: true }),
  actorId: oid("User", { required: true }),
  action: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  meta: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
activitySchema.index({ workspaceId: 1, _id: -1 });
const ActivityLog = model("ActivityLog", activitySchema);

const RefreshToken = model("RefreshToken", new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: oid("User", { required: true, index: true }),
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
}));

const Notification = model("Notification", new Schema({
  userId: oid("User", { required: true, index: true }),
  workspaceId: oid("Workspace", { required: true }),
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true }));

module.exports = { ROLES, User, Workspace, Membership, Board, List, Task, ActivityLog, RefreshToken, Notification };
