require("express-async-errors"); 
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { requireAuth } = require("./middleware/auth");
const { Notification } = require("./models");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", require("./routes/auth"));
app.use("/workspaces", requireAuth, require("./routes/workspaces"));
app.get("/notifications", requireAuth, async (req, res) => {
  res.json(await Notification.find({ userId: req.userId }).sort({ _id: -1 }).limit(50));
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));


app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err.name === "CastError") return res.status(404).json({ error: "Not found" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
