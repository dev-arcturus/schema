import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers.js";

describe("auth routes", () => {
  it("registers a new user and returns a token", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "alice@example.com", password: "hunter2" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.email).toBe("alice@example.com");
  });

  it("rejects duplicate email on register", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "bob@example.com", password: "x" });
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "bob@example.com", password: "y" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "carol@example.com", password: "pw" });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "carol@example.com", password: "pw" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
  });

  it("rejects login with wrong password", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "dan@example.com", password: "pw" });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "dan@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });
});
