const { app, request, connectFresh, disconnect, signup, auth, createWorkspace, invite } = require("./helpers");

let owner, viewer, ws, board, listA, listB;
const mk = async (listId, title, token = owner.token) =>
  (await request(app).post(`/workspaces/${ws}/boards/${board._id}/lists/${listId}/tasks`).set(auth(token)).send({ title })).body;
const getBoard = async () => (await request(app).get(`/workspaces/${ws}/boards/${board._id}`).set(auth(owner.token))).body;

beforeAll(async () => {
  await connectFresh();
  owner = await signup("Owner");
  viewer = await signup("Viewer");
  ws = await createWorkspace(owner.token);
  await invite(owner.token, ws, viewer.email, "VIEWER");
  board = (await request(app).post(`/workspaces/${ws}/boards`).set(auth(owner.token)).send({ name: "B" })).body;
  listA = (await request(app).post(`/workspaces/${ws}/boards/${board._id}/lists`).set(auth(owner.token)).send({ name: "A" })).body;
  listB = (await request(app).post(`/workspaces/${ws}/boards/${board._id}/lists`).set(auth(owner.token)).send({ name: "B" })).body;
});
afterAll(disconnect);

describe("task mutations", () => {
  test("create returns 201, viewer gets 403, invalid body gets 400", async () => {
    const t = await mk(listA._id, "First");
    expect(t.title).toBe("First");
    expect(t.version).toBe(1);
    const v = await request(app).post(`/workspaces/${ws}/boards/${board._id}/lists/${listA._id}/tasks`).set(auth(viewer.token)).send({ title: "x" });
    expect(v.status).toBe(403);
    const bad = await request(app).post(`/workspaces/${ws}/boards/${board._id}/lists/${listA._id}/tasks`).set(auth(owner.token)).send({ title: "" });
    expect(bad.status).toBe(400);
  });

  test("optimistic locking: stale version returns 409, current version returns 200", async () => {
    const t = await mk(listA._id, "Edit me");
    const ok = await request(app).patch(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token)).send({ title: "Edited", version: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(2);
    const stale = await request(app).patch(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token)).send({ title: "Stale", version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.current.title).toBe("Edited");
  });

  test("two simultaneous edits with the same version: one succeeds, one gets 409", async () => {
    const t = await mk(listA._id, "Race");
    const [r1, r2] = await Promise.all([
      request(app).patch(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token)).send({ title: "One", version: 1 }),
      request(app).patch(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token)).send({ title: "Two", version: 1 }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  });

  test("move: order within a list is preserved", async () => {
    const a = await mk(listB._id, "a");
    const b = await mk(listB._id, "b");
    const c = await mk(listB._id, "c");
    const mv = await request(app).post(`/workspaces/${ws}/tasks/${c._id}/move`).set(auth(owner.token))
      .send({ listId: listB._id, prevId: a._id, nextId: b._id });
    expect(mv.status).toBe(200);
    const listNow = (await getBoard()).lists.find((l) => l._id === listB._id);
    const titles = listNow.tasks.filter((t) => ["a", "b", "c"].includes(t.title)).map((t) => t.title);
    expect(titles).toEqual(["a", "c", "b"]);
  });

  test("move: task can move to another list, and a viewer receives 403", async () => {
    const t = await mk(listA._id, "Mover");
    const mv = await request(app).post(`/workspaces/${ws}/tasks/${t._id}/move`).set(auth(owner.token)).send({ listId: listB._id });
    expect(mv.status).toBe(200);
    expect(mv.body.listId).toBe(listB._id);
    const v = await request(app).post(`/workspaces/${ws}/tasks/${t._id}/move`).set(auth(viewer.token)).send({ listId: listA._id });
    expect(v.status).toBe(403);
  });

  test("delete: 204, deleting again returns 404, viewer receives 403", async () => {
    const t = await mk(listA._id, "Delete me");
    expect((await request(app).delete(`/workspaces/${ws}/tasks/${t._id}`).set(auth(viewer.token))).status).toBe(403);
    expect((await request(app).delete(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token))).status).toBe(204);
    expect((await request(app).delete(`/workspaces/${ws}/tasks/${t._id}`).set(auth(owner.token))).status).toBe(404);
  });

  test("search + filter + pagination", async () => {
    await mk(listA._id, "Fix login bug");
    await mk(listA._id, "Write documentation");
    const res = await request(app).get(`/workspaces/${ws}/tasks`).query({ q: "login", limit: 5 }).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.items.some((t) => t.title === "Fix login bug")).toBe(true);
    expect(res.body.items.every((t) => !/documentation/i.test(t.title))).toBe(true);
    const page = await request(app).get(`/workspaces/${ws}/tasks`).query({ limit: 2, page: 1 }).set(auth(owner.token));
    expect(page.body.items.length).toBe(2);
    expect(page.body.totalPages).toBeGreaterThan(1);
  });

  test("dashboard cache: second call is cached and a mutation invalidates it", async () => {
    const d1 = await request(app).get(`/workspaces/${ws}/dashboard`).set(auth(owner.token));
    expect(d1.body.cached).toBe(false);
    const d2 = await request(app).get(`/workspaces/${ws}/dashboard`).set(auth(owner.token));
    expect(d2.body.cached).toBe(true);
    await mk(listA._id, "Invalidate");
    const d3 = await request(app).get(`/workspaces/${ws}/dashboard`).set(auth(owner.token));
    expect(d3.body.cached).toBe(false);
    expect(d3.body.totalTasks).toBe(d1.body.totalTasks + 1);
  });

  test("a malformed id returns 4xx, never 500", async () => {
    const res = await request(app).patch(`/workspaces/${ws}/tasks/not-an-id`).set(auth(owner.token)).send({ title: "x", version: 1 });
    expect([400, 404]).toContain(res.status);
  });
});
