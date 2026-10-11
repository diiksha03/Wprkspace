# Real-Time Collaborative Workspace

A multi-tenant workspace application with role-based access control, boards, lists and tasks,
drag-and-drop ordering, real-time sync over WebSockets, an activity log, search, a cached dashboard
and background notifications.

- **Frontend (Vercel):** `<URL>`
- **Backend (Render):** `<URL>`
- **CI:** `<badge>`
- **Test accounts** (same workspace, "Demo Workspace"): `owner@example.com` (Owner) and `member@example.com` (Member), password `Password123!`

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS, Socket.IO client, @hello-pangea/dnd |
| Backend | Node.js, Express, Socket.IO, Mongoose |
| Database | MongoDB |
| Auth | JWT access tokens, rotating refresh tokens, bcrypt |
| Testing / CI | Jest, Supertest, ESLint, GitHub Actions |

## Running locally

Prerequisites: Node.js 20+ and a MongoDB instance (local `mongod` or a MongoDB Atlas cluster).

```bash
# Backend
cd backend
cp .env.example .env        # set MONGO_URI and ACCESS_SECRET
npm install
npm run seed                # creates the demo accounts and sample board (drops the target database first)
npm run dev                 # http://localhost:4000

# Frontend (second terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Run the tests with `cd backend && npm test`. A MongoDB instance must be reachable. The integration tests use a
separate `workspace_test` database, configurable through `MONGO_URI_TEST`.

## Data model

`User`, `Workspace`, `Membership` (userId, workspaceId, role; unique compound index), `Board`, `List` (position),
`Task` (position, version, labels, assigneeId), `ActivityLog`, `RefreshToken` (token hash), `Notification`.

`workspaceId` is denormalized onto lists and tasks so that every query can filter by tenant directly.

## Authorization

1. `requireAuth` verifies the JWT.
2. `requirePerm(permission)` loads the caller's membership from the database on every request (the role is not
   stored in the token), so role changes and removals take effect immediately.

A non-member receives `404` so that the existence of a workspace is not disclosed; a member without the required
role receives `403`. The check is applied to every workspace route, including all mutating endpoints. An Owner
cannot be modified by anyone, and an Admin can only manage Members and Viewers. The rules live in
`backend/src/lib/permissions.js` and are unit tested. Sockets are authenticated on connection, and membership is
verified before a client may join a board room.

## Token handling

- **Access token:** JWT valid for 15 minutes, held in memory on the client only.
- **Refresh token:** 48 random bytes in an httpOnly, Secure, SameSite=None cookie scoped to `/auth`. Only its
  SHA-256 hash is stored in the database.
- **Rotation:** every refresh revokes the presented token and issues a new one. Presenting an already revoked token
  is treated as reuse, and all of that user's refresh tokens are revoked.
- **Revocation:** logout revokes the current token; tokens also expire after 7 days.

## Real-time behaviour and concurrency

- **Ordering:** tasks and lists use floating-point positions. On a move the client sends only the neighbouring task
  ids and the server computes the new position, so concurrent moves do not require rewriting the list. If the gap
  between neighbours becomes too small, the list is renumbered and clients are told to refetch.
- **Edit conflicts:** optimistic locking with a `version` field. The version is part of the update filter, so when
  two clients edit the same task simultaneously exactly one succeeds and the other receives `409` with the current
  task.
- **Client:** moves are applied optimistically and reconciled with server events; events with an older version are
  ignored, and the board reloads after a reconnect.

## Caching and background jobs

- **Cache:** the workspace dashboard (several aggregation queries) is cached for 60 seconds and invalidated on every
  task, list and board mutation.
- **Background job:** assigning a task creates a notification through an asynchronous job queue so the request does
  not wait for it. Failed jobs are retried up to three times.

## Trade-offs and known limitations

- **MongoDB, in-memory cache and in-process queue instead of PostgreSQL, Redis and BullMQ, and JavaScript instead of
  TypeScript.** This was a deliberate decision to stay within the stack I know well under a tight deadline. The cache
  exposes a Redis-like `get/set/del` interface, so replacing it is straightforward.
- The in-memory cache and queue only work for a single server instance. Pending jobs and cached data are lost on
  restart, and with several instances the cache could serve stale data.
- Only existing users can be added to a workspace; there is no email-invite flow.
- Presence indicators, rate limiting and board export were not implemented.
- MongoDB transactions were not used because they require a replica set. Workspace creation uses a manual rollback.
- Task creation uses `last position + gap`, so two simultaneous creates can receive the same position.
- The refresh cookie is cross-site (Vercel to Render). Browsers that block third-party cookies may require a login
  after a page reload.
- There are no frontend end-to-end tests. Backend integration tests cover authentication, RBAC, tenant isolation
  and task mutations.

## What I would do next

Migrate to PostgreSQL with Prisma and TypeScript, use Redis for caching and BullMQ for jobs, add an email-invite
flow, rate limiting, presence indicators and end-to-end tests.

## Deployment

1. **MongoDB Atlas:** create a free cluster, a database user, allow network access and copy the connection string.
2. **Render** (Web Service, root directory `backend`): build command `npm install`, start command `npm start`,
   health check path `/health`. Environment variables: `MONGO_URI`, `ACCESS_SECRET` (a long random string),
   `FRONTEND_URL` (the Vercel URL without a trailing slash) and `NODE_ENV=production`.
3. **Vercel** (root directory `frontend`): set `NEXT_PUBLIC_API_URL` to the Render URL, then update `FRONTEND_URL`
   on Render with the final Vercel URL.
4. **Seed data:** run `MONGO_URI=<atlas-uri> npm run seed` from `backend`. This drops the target database.
5. Render's free tier sleeps when idle, so the first request after a pause can take 30-50 seconds.
