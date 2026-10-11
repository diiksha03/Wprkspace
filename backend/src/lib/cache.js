
const store = new Map();

const cache = {
  async get(key) {
    const e = store.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) { store.delete(key); return null; }
    return e.value;
  },
  async set(key, value, ttlSec = 60) { store.set(key, { value, exp: Date.now() + ttlSec * 1000 }); },
  async del(key) { store.delete(key); },
};

const dashKey = (workspaceId) => `dash:${workspaceId}`;
const invalidateDashboard = (workspaceId) => cache.del(dashKey(String(workspaceId)));

module.exports = { cache, dashKey, invalidateDashboard };
