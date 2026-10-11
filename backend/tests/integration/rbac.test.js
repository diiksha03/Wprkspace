const { app, request, connectFresh, disconnect, signup, auth, createWorkspace, invite } = require("./helpers");

let owner, admin, member, viewer, outsider, ws;

beforeAll(async () => {
  await connectFresh();
  [owner, admin, member, viewer, outsider] = await Promise.all(["Owner", "Admin", "Member", "Viewer", "Outsider"].map(signup));
  ws = await createWorkspace(owner.token, "Acme");
  expect((await invite(owner.token, ws, admin.email, "ADMIN")).status).toBe(201);
  expect((await invite(owner.token, ws, member.email, "MEMBER")).status).toBe(201);
  expect((await invite(owner.token, ws, viewer.email, "VIEWER")).status).toBe(201);
});
afterAll(disconnect);

describe("RBAC (server-side)", () => {
  test("a Viewer can read but cannot create a board (403)", async () => {
    expect((await request(app).get(`/workspaces/${ws}/boards`).set(auth(viewer.token))).status).toBe(200);
    expect((await request(app).post(`/workspaces/${ws}/boards`).set(auth(viewer.token)).send({ name: "B" })).status).toBe(403);
  });

  test("a Member can create a board (201) but cannot invite (403)", async () => {
    expect((await request(app).post(`/workspaces/${ws}/boards`).set(auth(member.token)).send({ name: "B" })).status).toBe(201);
    const extra = await signup("Extra");
    expect((await invite(member.token, ws, extra.email, "MEMBER")).status).toBe(403);
  });

  test("an Admin can invite a Member but cannot grant the Admin role", async () => {
    const e1 = await signup("E1");
    const e2 = await signup("E2");
    expect((await invite(admin.token, ws, e1.email, "MEMBER")).status).toBe(201);
    expect((await invite(admin.token, ws, e2.email, "ADMIN")).status).toBe(403);
  });

  test("an Admin cannot change the Owner's role", async () => {
    const res = await request(app).patch(`/workspaces/${ws}/members/${owner.id}`).set(auth(admin.token)).send({ role: "VIEWER" });
    expect(res.status).toBe(403);
  });

  test("an Owner can change roles and the change is recorded in the activity log", async () => {
    const res = await request(app).patch(`/workspaces/${ws}/members/${viewer.id}`).set(auth(owner.token)).send({ role: "MEMBER" });
    expect(res.status).toBe(200);
    const log = await request(app).get(`/workspaces/${ws}/activity`).set(auth(owner.token));
    expect(log.body.items.some((i) => i.action === "member.role_changed")).toBe(true);
    await request(app).patch(`/workspaces/${ws}/members/${viewer.id}`).set(auth(owner.token)).send({ role: "VIEWER" });
  });

  test("adding an existing member returns 409 (unique index)", async () => {
    expect((await invite(owner.token, ws, member.email, "MEMBER")).status).toBe(409);
  });

  test("an outsider gets 404 and cannot tell the workspace exists", async () => {
    expect((await request(app).get(`/workspaces/${ws}/boards`).set(auth(outsider.token))).status).toBe(404);
    expect((await request(app).get(`/workspaces/${ws}/members`).set(auth(outsider.token))).status).toBe(404);
  });

  test("membership changes take effect immediately (role is read from the DB, not the token)", async () => {
    const tmp = await signup("Tmp");
    await invite(owner.token, ws, tmp.email, "MEMBER");
    expect((await request(app).post(`/workspaces/${ws}/boards`).set(auth(tmp.token)).send({ name: "T" })).status).toBe(201);
    await request(app).delete(`/workspaces/${ws}/members/${tmp.id}`).set(auth(owner.token));
    expect((await request(app).post(`/workspaces/${ws}/boards`).set(auth(tmp.token)).send({ name: "T2" })).status).toBe(404);
  });
});

describe("tenant isolation", () => {
  test("knowing another workspace's board id does not expose its data", async () => {
    const other = await signup("Other");
    const wsB = await createWorkspace(other.token, "Beta");
    const boardB = (await request(app).post(`/workspaces/${wsB}/boards`).set(auth(other.token)).send({ name: "Secret" })).body;
    const leak = await request(app).get(`/workspaces/${ws}/boards/${boardB._id}`).set(auth(owner.token));
    expect(leak.status).toBe(404);
    const direct = await request(app).get(`/workspaces/${wsB}/boards/${boardB._id}`).set(auth(owner.token));
    expect(direct.status).toBe(404);
  });
});
