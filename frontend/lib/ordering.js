export const GAP = 1024;
export function calcPosition(prev, next) {
  if (prev != null && next != null) return (prev + next) / 2;
  if (prev != null) return prev + GAP;
  if (next != null) return next / 2;
  return GAP;
}
