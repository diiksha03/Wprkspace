const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { RefreshToken } = require("../models");

const REFRESH_DAYS = 7;
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

const signAccess = (userId) => jwt.sign({ sub: String(userId) }, process.env.ACCESS_SECRET, { expiresIn: "15m" });
const verifyAccess = (token) => jwt.verify(token, process.env.ACCESS_SECRET);

async function issueRefresh(userId) {
  const raw = crypto.randomBytes(48).toString("hex");
  await RefreshToken.create({
    tokenHash: hash(raw), 
    userId,
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
  });
  return raw;
}


async function rotateRefresh(raw) {
  const row = await RefreshToken.findOne({ tokenHash: hash(raw) });
  if (!row || row.expiresAt < new Date()) return null;
  if (row.revokedAt) {
    await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { revokedAt: new Date() });
    return null;
  }
 
  const claimed = await RefreshToken.findOneAndUpdate({ _id: row._id, revokedAt: null }, { revokedAt: new Date() });
  if (!claimed) return null;
  return { userId: row.userId, refresh: await issueRefresh(row.userId) };
}

const revokeRefresh = (raw) => RefreshToken.updateMany({ tokenHash: hash(raw), revokedAt: null }, { revokedAt: new Date() });

module.exports = { signAccess, verifyAccess, issueRefresh, rotateRefresh, revokeRefresh };
