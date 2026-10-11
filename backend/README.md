# Backend

Express + MongoDB (Mongoose) + Socket.IO API. See the root `README.md` for architecture, authorization, token
handling and deployment.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API with file watching (http://localhost:4000) |
| `npm start` | Start the API |
| `npm run seed` | Reset the database and create demo data (drops the target database) |
| `npm test` | Unit and integration tests (requires MongoDB) |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run lint` | ESLint |

## Environment variables

`MONGO_URI`, `ACCESS_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV` (see `.env.example`).

## Endpoints

- `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- `GET|POST /workspaces`
- `GET|POST /workspaces/:id/members`, `PATCH|DELETE /workspaces/:id/members/:userId`
- `GET /workspaces/:id/activity?cursor=&limit=`
- `GET /workspaces/:id/dashboard` (cached)
- `GET|POST /workspaces/:id/boards`, `GET /workspaces/:id/boards/:boardId`
- `POST /workspaces/:id/boards/:boardId/lists`
- `POST /workspaces/:id/boards/:boardId/lists/:listId/tasks`
- `GET /workspaces/:id/tasks?q=&assigneeId=&label=&listId=&page=&limit=`
- `PATCH /workspaces/:id/tasks/:taskId` (body includes `version`), `POST .../move`, `DELETE`
- `GET /notifications`

## Socket events

Emit `board:join` with a board id (acknowledged with `true` or `false`), then listen for `task:created`,
`task:updated`, `task:moved`, `task:deleted`, `list:created` and `list:rebalanced`.
