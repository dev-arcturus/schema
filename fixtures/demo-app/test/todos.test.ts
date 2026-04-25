import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers.js";

async function tokenFor(app: ReturnType<typeof makeApp>["app"], email: string) {
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "pw" });
  return res.body.token as string;
}

describe("todos routes (with auth)", () => {
  it("creates and lists todos", async () => {
    const { app } = makeApp();
    const token = await tokenFor(app, "eve@example.com");

    const create = await request(app)
      .post("/todos")
      .set("authorization", `Bearer ${token}`)
      .send({ title: "buy milk" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("buy milk");

    const list = await request(app)
      .get("/todos")
      .set("authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.todos).toHaveLength(1);
    expect(list.body.todos[0].title).toBe("buy milk");
  });

  it("deletes a todo", async () => {
    const { app } = makeApp();
    const token = await tokenFor(app, "frank@example.com");

    const create = await request(app)
      .post("/todos")
      .set("authorization", `Bearer ${token}`)
      .send({ title: "water plants" });
    const id = create.body.id as number;

    const del = await request(app)
      .delete(`/todos/${id}`)
      .set("authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get("/todos")
      .set("authorization", `Bearer ${token}`);
    expect(list.body.todos).toHaveLength(0);
  });

  it("rejects unauthenticated POST /todos", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/todos").send({ title: "x" });
    expect(res.status).toBe(401);
  });
});
