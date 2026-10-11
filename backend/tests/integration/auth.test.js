const { app, request, connectFresh, disconnect, signup } = require("./helpers");

beforeAll(connectFresh);
afterAll(disconnect);

describe("auth", () => {
  test("signup returns 201 and a duplicate email returns 409", async () => {
    const u = await signup("Alice");
    expect(u.res.status).toBe(201);
    expect(u.token).toBeTruthy();
    const dup = await request(app).post("/auth/signup").send({ email: u.email, password: "Password123!", name: "Alice" });
    expect(dup.status).toBe(409);
  });

  test("rejects a too-short password with 400", async () => {
    const res = await request(app).post("/auth/signup").send({ email: "x@test.com", password: "123", name: "X" });
    expect(res.status).toBe(400);
  });

  test("login returns 401 for a wrong password and 200 for the correct one", async () => {
    const u = await signup("Bob");
    const bad = await request(app).post("/auth/login").send({ email: u.email, password: "wrong-password" });
    expect(bad.status).toBe(401);
    const ok = await request(app).post("/auth/login").send({ email: u.email, password: "Password123!" });
    expect(ok.status).toBe(200);
  });

  test("NoSQL injection payload on login is rejected with 400", async () => {
    await signup("Carol");
    const res = await request(app).post("/auth/login").send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  test("refresh rotation issues a new token and rejects reuse of the old one", async () => {
    const u = await signup("Dave");
    const r1 = await request(app).post("/auth/refresh").set("Cookie", u.cookie);
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();
    const newCookie = r1.headers["set-cookie"][0].split(";")[0];
    expect(newCookie).not.toBe(u.cookie);
    const reuse = await request(app).post("/auth/refresh").set("Cookie", u.cookie);
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app).post("/auth/refresh").set("Cookie", newCookie);
    expect(afterReuse.status).toBe(401);
  });

  test("protected route without a token returns 401", async () => {
    const res = await request(app).get("/workspaces");
    expect(res.status).toBe(401);
  });
});
