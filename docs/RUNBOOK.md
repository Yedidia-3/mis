# Operations runbook

For whoever keeps the Jericho School MIS running. Written to be followed by
someone who is comfortable with a terminal but did not build the system.

---

## 1. Backups

**This is the one thing that cannot be recovered by rewriting code.** Student
records, enrolments and payment history exist only in the database.

### Take a backup

Get `DATABASE_URL` from the Railway dashboard (Postgres service → Variables),
then:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="jericho-$(date +%F).dump"
```

The `--format=custom` dump is compressed and restores selectively. Keep it
somewhere that is **not** Railway — a laptop plus cloud storage is fine. A
backup stored only on the machine that holds the database is not a backup.

### Restore a backup

```bash
# Into a scratch database first — always verify before touching production.
createdb jericho_restore_check
pg_restore --dbname=jericho_restore_check --clean --if-exists jericho-2026-08-18.dump
```

Only restore over production once you have confirmed the dump is complete and
recent. Restoring is destructive and there is no undo.

### How often

Weekly during term, and always **before**:

- running a shuffle that will be approved,
- importing a batch of students,
- deploying a migration that alters existing tables.

Railway offers automated backups on paid plans. If the school is on a plan that
includes them, turn them on — an automated backup that runs without anyone
remembering beats a manual one that depends on a person.

### Check the backup is real

A dump that restores into an empty database and reports the expected row counts
is a backup. A file of the right size is not.

```bash
psql -d jericho_restore_check -c "SELECT count(*) FROM students;"
psql -d jericho_restore_check -c "SELECT count(*) FROM enrollments;"
```

---

## 2. Nobody can log in

### The Super Admin is locked out or the password is lost

Accounts lock after repeated failed attempts. From the Railway shell, in
`apps/api`:

```bash
npm run reset-admin
```

This resets `admin@jericho.rw` to `Admin@Jericho2025!`, clears the lockout, and
forces a new password at next sign-in. It recreates the account if it has been
deleted. It does not touch any other user.

Tell the person who will use it to sign in immediately and set a real password —
the temporary one is in this file and in the repository, so it is public.

### One ordinary user is locked out

The Super Admin can reset any user from **Users** inside the app. There is no
need for a shell.

### Everyone gets "Failed to fetch"

That is not a login problem — the browser is refusing to send the request. See
the troubleshooting section of [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## 3. Start of an academic year

1. **Take a backup.** Everything below is easier to undo with one.
2. Create the new academic year (Super Admin → Academic Years).
3. Create P-levels and their classes for the year.
4. Import students from the spreadsheet templates in `docs/sample-data/`.
   Import into a fresh year — do not edit last year's records in place, or the
   history is lost.
5. Have the dean run the shuffle per P-level, and the principal approve it.
   Nothing moves until approval, so a proposal can be re-run freely.
6. Assign teachers to classes.
7. Build the timetable. Read the warnings it produces — the solver reports
   under-placed courses rather than failing, so a timetable can look finished
   while a course is short of periods.

---

## 4. Schema changes

Never enable `SYNCHRONIZE_DB` in production. It lets TypeORM drop columns to
match the entity definitions, which silently destroys data.

To change the schema:

1. Edit the entity in `apps/api/src/entities/`.
2. Register it in `apps/api/src/entities/index.ts` if it is new.
3. Generate a migration against an up-to-date database:
   ```bash
   npm run migration:generate src/migrations/DescribeTheChange
   ```
4. Read the generated SQL. `migration:generate` writes what it infers, and it
   cannot tell a rename from a drop-and-add — the latter loses the column's
   data. Rewrite it by hand if that is what happened.
5. Commit the migration with the entity change, back up production, then deploy.

Check what has run with `npm run migration:show`.

---

## 5. Health checks

```bash
curl -s https://api.jerichoschool.ac.rw/api/v1/health
```

Expect HTTP 200. If it fails, look at the Railway service logs — the API retries
its database connection ten times at five-second intervals on boot, so a slow
database shows up as a delayed start rather than an immediate crash.

---

## 6. Audit log

Every mutating request is recorded by an interceptor into `audit_logs` — who,
what, when. This is the first place to look when a record changed and nobody
remembers doing it.

The table grows without bound. It is worth checking its size once a year:

```sql
SELECT count(*), min(created_at), max(created_at) FROM audit_logs;
```

---

## 7. What to hand to the next person

- Access to the Railway project (API + Postgres)
- Access to the Vercel project (frontend)
- Access to the GitHub repository
- Control of DNS for `jerichoschool.ac.rw`
- The most recent verified database backup
- This runbook and [README.md](../README.md)

Losing Railway access with no backup means losing the data outright. The
backup is what makes every other item on this list replaceable.
