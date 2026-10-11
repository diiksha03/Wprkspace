const { calcPosition, GAP } = require("../src/lib/ordering");

describe("calcPosition()", () => {
  test("the first task in an empty list is placed at GAP", () => {
    expect(calcPosition(null, null)).toEqual({ position: GAP, needsRebalance: false });
  });
  test("a task between two others gets the average position", () => {
    expect(calcPosition(1024, 2048).position).toBe(1536);
  });
  test("the last position is previous + GAP", () => {
    expect(calcPosition(2048, null).position).toBe(2048 + GAP);
  });
  test("the first position is next / 2", () => {
    expect(calcPosition(null, 1024).position).toBe(512);
  });
  test("a very small gap requests a rebalance", () => {
    expect(calcPosition(1, 1 + 1e-9).needsRebalance).toBe(true);
  });
  test("order is preserved when repeatedly dropping into the same gap", () => {
    let prev = 1024, next = 2048;
    for (let i = 0; i < 20; i++) {
      const { position } = calcPosition(prev, next);
      expect(position).toBeGreaterThan(prev);
      expect(position).toBeLessThan(next);
      next = position;
    }
  });
});
