/**
 * Single source of truth for how this app reaches Postgres.
 *
 * Hosted platforms (Railway, Render) inject a single DATABASE_URL. Some
 * Postgres add-ons instead export the standard PG* vars. Local dev and cPanel
 * use the DB_* vars from .env. All three are supported, in that order.
 */

type UrlConnection = {
  url: string;
  ssl: { rejectUnauthorized: boolean };
};

type HostConnection = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export type DbConnection = UrlConnection | HostConnection;

export function buildDbConnection(env: NodeJS.ProcessEnv = process.env): DbConnection {
  const databaseUrl = (env.DATABASE_URL ?? env.RAILWAY_DATABASE_URL)?.trim();
  if (databaseUrl) {
    // Managed Postgres terminates TLS with a cert we don't pin, so verification
    // is off. The connection is still encrypted.
    return { url: databaseUrl, ssl: { rejectUnauthorized: false } };
  }

  return {
    host: env.PGHOST || env.DB_HOST || 'localhost',
    port: Number(env.PGPORT ?? env.DB_PORT ?? 5432),
    username: env.PGUSER || env.DB_USERNAME || 'postgres',
    password: env.PGPASSWORD || env.DB_PASSWORD || '',
    database: env.PGDATABASE || env.DB_NAME || 'jericho_school',
  };
}

/**
 * Schema auto-sync. Explicit opt-in only.
 *
 * TypeORM's `synchronize` alters and drops columns to match the entities. That
 * is fine against a throwaway dev database and unacceptable against the
 * school's live one, so it is never enabled by inference — set SYNCHRONIZE_DB
 * to "true" deliberately, or leave it off and use migrations.
 */
export function shouldSynchronize(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SYNCHRONIZE_DB === 'true';
}
