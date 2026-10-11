process.env.ACCESS_SECRET = process.env.ACCESS_SECRET || "test-secret";
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../src/app");

const MONGO_URI = process.env.MONGO_URI_TEST || "mongodb://127.0.0.1:27017/workspace_test";

async function connectFresh() {
  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
const disconnect = () => mongoose.disconnect();

let n = 0;
async function signup(name = "User") {
  n += 1;
  const email = `${name.toLowerCase()}${n}-${Date.now()}@test.com`;
  const res = await request(app).post("/auth/signup").send({ email, password: "Password123!", name });
  return { email, token: res.body.accessToken, id: res.body.user.id, cookie: res.headers["set-cookie"][0].split(";")[0], res };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function createWorkspace(token, name = "WS") {
  const res = await request(app).post("/workspaces").set(auth(token)).send({ name });
  return res.body._id;
}
async function invite(ownerToken, wsId, email, role) {
  return request(app).post(`/workspaces/${wsId}/members`).set(auth(ownerToken)).send({ email, role });
}

module.exports = { app, request, connectFresh, disconnect, signup, auth, createWorkspace, invite };
