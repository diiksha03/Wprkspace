# Real-Time Collaborative Workspace

A small multi-tenant task management app, in the spirit of Linear or Asana. Organisations get their own
workspaces, members have roles, and everyone viewing a board sees changes appear live without refreshing.

- **Frontend (Vercel):** https://wprkspace.vercel.app
- **Backend API and WebSocket server (Render):** https://wprkspace-backend.onrender.com
- **Repository:** https://github.com/diiksha03/Wprkspace

![CI](https://github.com/diiksha03/Wprkspace/actions/workflows/ci.yml/badge.svg)

## Live demo

**Test accounts** (both belong to the workspace "Demo Workspace"):

| Role | Email | Password |
|---|---|---|
| Owner | owner@example.com | Password123! |
| Member | member@example.com | Password123! |

The backend runs on Render's free tier, which sleeps when idle. The first request after a pause can take
30 to 50 seconds, so please give the first login a moment.

## What it does

- **Workspaces:** a user can create a workspace and add other registered users to it. All data (boards, lists,
  tasks, members) belongs to one workspace and cannot be read from another.
- **Roles:** Owner, Admin, Member and Viewer. Permissions are enforced on the server for every route, not only in
  the UI.
- **Boards, lists and tasks:** drag and drop tasks within a list or between lists. Order is stored on the server.
- **Real-time sync:** creating, editing, moving or deleting a task updates every other client on the same board
  over Socket.IO.
- **Activity log:** every meaningful change records who did what and when, with cursor pagination.
- **Search and filters:** text search over titles and descriptions, plus filters for assignee, label and list,
  returned in pages.
- **Dashboard:** workspace summary (boards, members, tasks per list), served from a cache.
- **Notifications:** assigning a task creates a notification through a background job.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS, Socket.IO client, @hello-pangea/dnd |
| Backend | Node.js, Express, Socket.IO, Mongoose |
| Database | MongoDB |
| Auth | JWT access tokens, rotating refresh tokens, bcrypt |
| Tests and CI | Jest, Supertest, ESLint, GitHub Actions |

## Running locally

You need Node.js 20 or newer and a MongoDB instance (a local `mongod` or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd backend
cp .env.example .env     # on Windows: copy .env.example .env
