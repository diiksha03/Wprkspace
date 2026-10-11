const { can, canManageTarget } = require("../src/lib/permissions");

describe("can()", () => {
  test("a Viewer can only read", () => {
    expect(can("VIEWER", "read")).toBe(true);
    expect(can("VIEWER", "write")).toBe(false);
    expect(can("VIEWER", "manageMembers")).toBe(false);
  });
  test("a Member can write but cannot manage members", () => {
    expect(can("MEMBER", "write")).toBe(true);
    expect(can("MEMBER", "manageMembers")).toBe(false);
  });
  test("an Admin can manage members but cannot delete the workspace", () => {
    expect(can("ADMIN", "manageMembers")).toBe(true);
    expect(can("ADMIN", "deleteWorkspace")).toBe(false);
  });
  test("only the Owner can delete the workspace", () => {
    expect(can("OWNER", "deleteWorkspace")).toBe(true);
  });
  test("an unknown permission is always denied", () => {
    expect(can("OWNER", "hackTheGibson")).toBe(false);
  });
});

describe("canManageTarget()", () => {
  test("nobody can manage an Owner", () => {
    expect(canManageTarget("OWNER", "OWNER")).toBe(false);
    expect(canManageTarget("ADMIN", "OWNER")).toBe(false);
  });
  test("an Admin cannot manage another Admin, an Owner can", () => {
    expect(canManageTarget("ADMIN", "ADMIN")).toBe(false);
    expect(canManageTarget("OWNER", "ADMIN")).toBe(true);
  });
  test("an Admin can manage Members and Viewers", () => {
    expect(canManageTarget("ADMIN", "MEMBER")).toBe(true);
    expect(canManageTarget("ADMIN", "VIEWER")).toBe(true);
  });
  test("a Member cannot manage anyone", () => {
    expect(canManageTarget("MEMBER", "VIEWER")).toBe(false);
  });
});
