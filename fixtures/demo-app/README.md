# Demo App

A small Express + TypeScript service used as the bundled target for Schema. Backed by sqlite and protected by JWT.

## Domain

- **Auth** — registration and login. Issues short-lived JWTs.
- **Todos** — per-user todo list. Resource routes for create, list, delete.

## Architecture

- `routes/` — HTTP endpoints (auth, todos)
- `services/` — application logic (registerUser, loginUser, addTodo, …)
- `repos/` — sqlite-backed persistence
- `middleware/` — JWT-aware auth helpers
- `db/` — sqlite open + migrations

## The deliberate gap

The `requireAuth` middleware is defined and applied to `POST /todos`, but not to `GET /todos` or `DELETE /todos/:id`. This is the architectural smell Schema's `addMiddleware` op exists to close.
