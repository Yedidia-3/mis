# Deployment

Two independently hosted pieces, both deploying automatically from `main`:

| Part | Hosted on | Domain |
| --- | --- | --- |
| Frontend (React/Vite) | Vercel | https://mis.jerichoschool.ac.rw |
| API (NestJS) + PostgreSQL | Railway | https://api.jerichoschool.ac.rw |

Pushing to `main` is the whole deploy process. GitHub Actions only builds and
tests the code — it does not ship it.

---

## Environment variables

These live in the hosting dashboards, not in the repository. Nothing here is
secret except `JWT_SECRET` and the database credentials.

### Railway — API

| Key | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | |
| `DATABASE_URL` | *(auto)* | Injected by the Railway Postgres plugin |
| `JWT_SECRET` | long random string | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `2h` | |
| `FRONTEND_URL` | `https://mis.jerichoschool.ac.rw` | Comma-separate to allow several origins |
| `RUN_MIGRATIONS` | `true` | Applies pending migrations on boot |

`SYNCHRONIZE_DB` must stay **unset**. It lets TypeORM drop columns to match the
entities, which would destroy live records. Schema changes go through
migrations — see the database section of [README.md](README.md).

### Vercel — Frontend

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://api.jerichoschool.ac.rw` |

**Vite inlines this at build time, not run time.** Changing it in the Vercel
dashboard does nothing until you trigger a fresh deploy. The production build
throws without it, deliberately, so a misconfigured deploy fails loudly instead
of silently calling `localhost`.

---

## First deploy of a fresh environment

1. Provision Postgres on Railway and deploy the API with the variables above.
   With `RUN_MIGRATIONS=true`, the schema is created on first boot.
2. Create the Super Admin — from the Railway shell:
   ```bash
   npm run seed
   ```
   That is the only account the system bootstraps with:
   `admin@jericho.rw` / `Admin@Jericho2025!`, forced to change at first login.
   Every other user is created from inside the app.
3. Deploy the frontend on Vercel with `VITE_API_URL` set.
4. Set `FRONTEND_URL` on Railway to the frontend's URL and redeploy the API.

Steps 3 and 4 are mutually dependent — each side needs the other's URL, so
expect to set one, deploy, then come back for the other.

---

## Verifying a deploy

```bash
# API is up
curl -s -o /dev/null -w "%{http_code}\n" https://api.jerichoschool.ac.rw/api/v1/health

# The browser will be allowed to call it
curl -sI -X OPTIONS https://api.jerichoschool.ac.rw/api/v1/auth/login \
  -H "Origin: https://mis.jerichoschool.ac.rw" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

The second command must echo back the frontend's origin. If it returns nothing,
`FRONTEND_URL` on Railway does not match where the frontend is served from, and
every login will fail with **"Failed to fetch"** — a browser-side CORS refusal
that never reaches the API, so the API logs stay clean and unhelpful.

To confirm which API URL the deployed frontend was built against:

```bash
curl -s https://mis.jerichoschool.ac.rw/ | grep -o 'src="/assets/[^"]*\.js"'
curl -s https://mis.jerichoschool.ac.rw/assets/<file>.js | grep -o 'https://api[a-zA-Z0-9.-]*'
```

---

## Troubleshooting

**"Failed to fetch" on the login screen.** The request never left the browser.
In order of likelihood: `FRONTEND_URL` on Railway does not include the frontend
origin; the frontend was built with a stale or missing `VITE_API_URL`; the API
is down. The two `curl` checks above distinguish all three.

**Schema changes did not appear.** Migrations only run when `RUN_MIGRATIONS` is
`true`, and only migrations that are committed to the repository run at all.
Check `npm run migration:show`.

**Nobody can log in.** See the admin recovery section of
[docs/RUNBOOK.md](docs/RUNBOOK.md).

---

## Deployment history

This project previously deployed to cPanel over FTPS via GitHub Actions, and
carried a Render blueprint before that. Both were removed once Vercel and
Railway became the live stack; the configuration is still in git history if it
is ever needed.

`apps/api/Dockerfile` remains — Railway builds from it, and
`config/docker/docker-compose.yml` uses it for local development.
