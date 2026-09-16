# Jericho School Management System

Management information system for Jericho School: enrolment, class composition,
timetabling, attendance and fee tracking, with role-based access for the people
who run the school.

**Live:**

| Part | URL | Hosted on |
| --- | --- | --- |
| Frontend | https://mis.jerichoschool.ac.rw | Vercel |
| API | https://api.jerichoschool.ac.rw | Railway |

---

## Stack

- **API** — NestJS 10, TypeORM, PostgreSQL, JWT auth, Socket.IO for live notifications
- **Frontend** — React 18 + Vite, shadcn/ui, Tailwind, MUI
- **Monorepo** — plain npm, two independent apps under `apps/`. There is no
  workspace linking; each app installs and builds on its own.

## Repository layout

```
apps/
  api/                 NestJS API
    src/
      entities/        TypeORM entities + the shared entity registry (index.ts)
      migrations/      Schema history — the only supported way to change the DB
      academics/       Academic year, P-levels, classes, shuffle
      accountant/      Feeding & transport enrolments, payments, zones
      admin/           User management
      auth/            Login, JWT, password policy
      audit/           Audit log interceptor
      notifications/   WebSocket notifications
      database/        Seed, admin recovery, shared DB config
  frontend/            React + Vite client (38 screens)
docs/sample-data/      Example student import spreadsheets (P1–P6)
```

## Roles

Five roles, defined on the user entity and enforced by guards on every route:

| Role | Does what |
| --- | --- |
| `super_admin` | Creates and manages all other users. The only seeded account. |
| `dean` | Runs the class shuffle and imports students |
| `principal` | Reviews and approves proposed shuffles |
| `teacher` | Records attendance for their own classes |
| `accountant` | Feeding and transport enrolments, payment tracking, zones |

## How the domain fits together

```
Academic year → P-level (P1…P6) → Class (P1 A, P1 B, …) → Student
```

The **shuffle** is the centrepiece. The dean picks an algorithm and the system
proposes a redistribution of students across the classes of one P-level; the
principal then approves or rejects it. Nothing moves until approval.

Three algorithms are available, in `apps/api/src/academics/shuffle/shuffle-algorithms.ts`:

- **`round_robin`** — deal students to classes in rotation
- **`snake_draft`** — same, but reversing every other pass, which evens out ability
- **`balanced_bands`** — split into thirds by rank and deal each third across the classes

> **Known limitation:** `balanced_bands` restarts its rotation at the first class
> for each band, so with a cohort smaller than roughly three times the class
> count it can leave a class empty (4 students across 3 classes gives 2, 2, 0).
> This behaviour is pinned by a test. Changing it changes how children are
> grouped, so it is the school's decision, not a silent fix.

---

## Running locally

**Prerequisites:** Node.js ≥ 18, npm ≥ 9, PostgreSQL 14+.

### 1. API

```bash
cd apps/api
npm ci
cp .env.example .env    # then edit DB_PASSWORD and JWT_SECRET
createdb jericho_school
npm run migration:run   # creates the schema
npm run seed            # creates the Super Admin
```

The API listens on <http://localhost:3001>. Health check:
<http://localhost:3001/api/v1/health>.

Seeded login — you are forced to change the password on first sign-in:

```
admin@jericho.rw / Admin@Jericho2025!
```

### 2. Start both apps

From the **repository root**:

```bash
# Start frontend (Vite dev server on http://localhost:5173)
npm run dev

# Start backend (NestJS watch mode on http://localhost:3001)
npm run start:dev
```

Both commands are defined in the root `package.json` and delegate to the
appropriate sub-package with `--prefix`. No need to `cd` into either folder.

> If the login screen says **"Failed to fetch"**, the API is either not running
> or is rejecting the browser's origin. Check that `FRONTEND_URL` in
> `apps/api/.env` lists the address Vite is actually serving on — port `5173`,
> not `3000`.

---

## Build

```bash
# Build the frontend for production (output → apps/frontend/dist)
npm run build
```

The build command is also what Vercel runs — see [vercel.json](vercel.json).

---

## Database schema

The schema is managed **exclusively by migrations**. TypeORM's `synchronize`
would alter and drop columns to match the entities, so it is off unless
`SYNCHRONIZE_DB=true` is set deliberately — never do that against a database
holding real records.

```bash
npm run migration:run                              # apply pending migrations
npm run migration:show                             # what has and hasn't run
npm run migration:generate src/migrations/AddThing # after changing entities
npm run migration:revert                           # undo the last one
```

After editing an entity, generate a migration and commit it alongside the
entity change. `migration:generate` diffs the entities against the database it
connects to, so point it at a database that is already up to date.

Entities are registered once, in `apps/api/src/entities/index.ts`. Add new ones
there and every DataSource picks them up.

## Tests

```bash
cd apps/api
npm test
```

Covers the two places where a silent bug does real damage — the shuffle
algorithms (a child in the wrong class) and grade calculations. CI runs these
on every push and pull request.

## Deployment

### Frontend → Vercel

The frontend deploys automatically from the `main` branch.
All Vercel configuration lives in [`vercel.json`](vercel.json) at the repo root —
**do not set overrides in the Vercel dashboard** or they will shadow this file.

```jsonc
// vercel.json — source of truth for every Vercel setting
{
  "version": 2,

  // Install only the frontend's dependencies (monorepo: no root node_modules)
  "installCommand": "npm --prefix apps/frontend install",

  // Build the frontend; output goes to apps/frontend/dist
  "buildCommand": "npm --prefix apps/frontend run build",
  "outputDirectory": "apps/frontend/dist",

  "framework": "vite",

  // SPA fallback — all routes served from index.html
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Key points for Vercel:**

| Setting | Value | Why |
|---------|-------|-----|
| Root directory | *(repo root, not `apps/frontend`)* | Vercel reads `vercel.json` from root |
| Install command | `npm --prefix apps/frontend install` | Only installs frontend deps |
| Build command | `npm --prefix apps/frontend run build` | Runs `vite build` inside the sub-package |
| Output directory | `apps/frontend/dist` | Where Vite writes the bundle |
| Framework preset | Vite | Enables Vite-specific optimisations |

**Environment variables** required in the Vercel project settings:

```
VITE_API_URL=https://api.jerichoschool.ac.rw
```

### Backend → Railway

The API deploys automatically from `main`. See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Operating the system

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for backups, admin lockout recovery, and
the checks worth doing at the start of each academic year.

Thank you for working with us!
