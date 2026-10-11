const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { signAccess, issueRefresh, rotateRefresh, revokeRefresh } = require("../lib/tokens");
const { isStr, isEmail } = require("../lib/validate");

const prod = process.env.NODE_ENV === "production";
const cookieOpts = {
  httpOnly: true,                 
  secure: prod,
  sameSite: prod ? "none" : "lax", 
  path: "/auth",
  maxAge: 7 * 864e5,
};
const publicUser = (u) => ({ id: u._id, email: u.email, name: u.name });

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isEmail(email) || !isStr(password, 8, 100) || !isStr(name, 1, 80))
    return res.status(400).json({ error: "Invalid input" });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
  const user = await User.create({ email, name, passwordHash: await bcrypt.hash(password, 12) });
  res.cookie("rt", await issueRefresh(user._id), cookieOpts);
  res.status(201).json({ accessToken: signAccess(user._id), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !isStr(password, 1, 100)) return res.status(400).json({ error: "Invalid input" });
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "Invalid credentials" });
  res.cookie("rt", await issueRefresh(user._id), cookieOpts);
  res.json({ accessToken: signAccess(user._id), user: publicUser(user) });
});

router.post("/refresh", async (req, res) => {
  const raw = req.cookies && req.cookies.rt;
  if (typeof raw !== "string") return res.status(401).json({ error: "No refresh token" });
  const r = await rotateRefresh(raw);
  if (!r) return res.status(401).json({ error: "Invalid refresh token" });
  res.cookie("rt", r.refresh, cookieOpts);
  const user = await User.findById(r.userId);
  res.json({ accessToken: signAccess(r.userId), user: user && publicUser(user) });
});

router.post("/logout", async (req, res) => {
  if (req.cookies && typeof req.cookies.rt === "string") await revokeRefresh(req.cookies.rt);
  res.clearCookie("rt", { path: "/auth" });
  res.status(204).end();
});

module.exports = router;
