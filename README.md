# Snappy Serve — Cafe demo (frontend + tiny backend)
## Project info

[Project URL](https://lovable.dev/projects/9f364509-3667-4b85-9c5f-f667abd998df)

This repository contains a Vite + React frontend (TypeScript) and a small Express backend used for local development. The frontend fetches menu, orders and billing endpoints from the backend. The backend can run purely in-memory or be configured to persist data to MongoDB.

This README documents how to run frontend and backend, how to connect a MongoDB instance, and how to seed the database with initial menu items.

## Table of contents

- Project layout
- Requirements
- Quick start (dev)
- Frontend (detailed)
- Backend (detailed)
- Optional: Connect MongoDB & seed data
- Environment variables
- Troubleshooting
- Quality gates (build / lint / typecheck)

## Project layout

- `src/` — React app (Vite + TypeScript)
- `server/` — tiny Express backend (index.js, data.js, seed.js)
- `package.json` — frontend project scripts & deps

Note: the backend is intentionally lightweight and does not include its own package.json. This keeps the backend separate so you can install only what you need.

## Requirements

- Node.js (recommended v18+)
- npm (or yarn/pnpm)
- (Optional) MongoDB server (local or Atlas) when you want persistence between restarts

If you manage Node versions with nvm, ensure you pick a recent LTS release:

```bash
nvm install --lts
nvm use --lts
```

## Quick start (dev)

1) Install frontend dependencies and start Vite dev server:

```bash
# from repo root
npm install
npm run dev
```

2) Start the backend (in separate terminal):

```bash
cd server
# install server deps locally (see backend section below)
npm install express cors uuid mongodb dotenv
# run backend
node index.js
```

3) Open the frontend in your browser (Vite will print the local URL, usually http://localhost:5173). The frontend uses `VITE_API_URL` environment variable (if present) or falls back to `http://localhost:4001`.

## Frontend (detailed)

- The frontend is a Vite + React TypeScript app. Main entry is `src/main.tsx` and routing is defined in `src/App.tsx`.
- The app expects an API base URL in the environment variable `VITE_API_URL`. If not set, it defaults to `http://localhost:4001`.

Env usage for development:

1. Create a root `.env` file (optional):

```
# .env
VITE_API_URL=http://localhost:4001
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Build for production:

```bash
npm run build
```

Preview built output:

```bash
npm run preview
```

## Backend (detailed)

The backend is located in the `server/` folder and provides REST endpoints:

- GET `/menu` — return grouped menu items
- POST/PUT/DELETE `/menu` — manage menu
- GET `/orders`, GET `/orders/:id`, POST `/orders`, PATCH `/orders/:id` — orders
- POST `/bills`, GET `/bills/:id` — billing
- GET `/reports/daily` — simple daily report derived from billed items
- POST `/otp` and `/otp/verify` — development-only OTP helpers

By default the backend uses in-memory stores (data is lost when the server restarts). Optionally you can persist to MongoDB by setting `USE_MONGO=true` and providing `MONGODB_URI` (see next section).

Steps to run the backend locally

1. Create and install server dependencies (the `server/` folder does not include a package.json by default):

```bash
cd server
npm init -y                    # create package.json for server
npm install express cors uuid dotenv mongodb
# (optional) install nodemon for dev
npm install -D nodemon
# add a dev script if you like:
#   "dev": "nodemon index.js"
```

2. Start the server

```bash
# plain node
node index.js

# or with nodemon (auto-restart on changes)
npx nodemon index.js
```

The backend will bind to port 4001 by default (or the port provided via `PORT` env). The server logs the final bind address when started.

### Notes about server env and startup behaviour

- If `USE_MONGO=true` is set, the server will attempt to connect to MongoDB and will wait up to 5s for the initial connection during startup. If the database doesn't connect within the timeout the server exits (fail-fast). This makes it easier to catch configuration errors in CI/dev.
- If `USE_MONGO` is not set or connection fails, the server falls back to in-memory stores.

## Optional: Connect MongoDB & seed data

To persist data across restarts you can use a local MongoDB or Atlas.

1. Create `server/.env` (not committed) with the following values:

```
USE_MONGO=true
MONGODB_URI=mongodb://localhost:27017
MONGODB_DBNAME=snappy_serve
# optional: PORT=4001
```

2. Install dependencies in `server/` (see backend steps), then start the server. You should see a console message like `MongoDB connected to database: snappy_serve`.

3. Seed the `menu` collection from the built-in dataset:

```bash
cd server
# ensure MONGODB_URI is present in server/.env or export it in your shell
node seed.js
```

The `seed.js` script upserts items into the `menu` collection using the sample data in `server/data.js`.

## Environment variables summary

- Root (frontend):
	- `VITE_API_URL` — base URL used by the frontend to call the backend (example: `http://localhost:4001`). If not set, frontend falls back to `http://localhost:4001`.

- Server (backend) — create `server/.env`:
	- `USE_MONGO` — set to `true` to enable MongoDB persistence
	- `MONGODB_URI` — MongoDB connection string
	- `MONGODB_DBNAME` — database name (default: `snappy_serve`)
	- `PORT` — port to bind the backend (default 4001)

## Quick verification / troubleshooting

- Check backend is reachable:

```bash
curl http://localhost:4001/menu | jq .
```

- If the frontend shows empty menu, confirm `VITE_API_URL` is set correctly or that the backend is running on `http://localhost:4001`.
- If you enabled MongoDB but the server exits on startup: check `server/.env` and `MONGODB_URI` are correct and that your DB accepts connections.
- To enable a developer-friendly restart loop, install `nodemon` and run `npx nodemon index.js` from inside `server/`.

## Quality gates (quick)

- Build (frontend):
	- From the repo root: `npm run build` — requires dependencies installed (run `npm install` first). This will produce production assets using Vite.

- Lint: `npm run lint` — runs eslint as configured in this repo.

- Typecheck: `tsc --noEmit` (TypeScript is included in devDependencies). You can add a script if you want: `"typecheck": "tsc --noEmit"`.

If you want me to run the build/lint/typecheck locally and report the output, tell me and I'll run them (I will install dependencies where needed). If you'd prefer to keep network installs off, run the commands above on your machine.

## Example flow (local dev)

1. Start a terminal for the backend:

```bash
cd server
npm init -y
npm install express cors uuid dotenv mongodb
node index.js
```

2. Start the frontend in another terminal:

```bash
cd <repo-root>
npm install
npm run dev
```

3. Open `http://localhost:5173` and use the app. Admin menu edits (from Kitchen Dashboard) are sent to the backend and customer view polls `/menu` to reflect updates.

---

If anything is unclear or you'd like me to (A) add a `server/package.json` with scripts, (B) add a `Makefile` for convenience, or (C) run the build/lint/typecheck in this environment and report the results, tell me which and I'll do it next.

Happy hacking!
