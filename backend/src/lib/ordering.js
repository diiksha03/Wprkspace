
const GAP = 1024;
const EPS = 1e-6;

function calcPosition(prev, next) {
  if (prev != null && next != null) {
    return { position: (prev + next) / 2, needsRebalance: Math.abs(next - prev) < EPS };
  }
  if (prev != null) return { position: prev + GAP, needsRebalance: false };
  if (next != null) return { position: next / 2, needsRebalance: next / 2 < EPS };
  return { position: GAP, needsRebalance: false };
}
module.exports = { GAP, calcPosition };
