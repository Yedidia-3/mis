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
  ssl?: { rejectUnauthorized: boolean } | boolean;
};

export type DbConnection = UrlConnection | HostConnection;

export function buildDbConnection(env: NodeJS.ProcessEnv = process.env): DbConnection {
  const isProduction = env.NODE_ENV === 'production';
  const databaseUrl = (env.DATABASE_URL ?? env.RAILWAY_DATABASE_URL)?.trim();

  if (databaseUrl) {
    // Managed Postgres on Railway requires SSL
    return { url: databaseUrl, ssl: { rejectUnauthorized: false } };
  }

  return {
    host: env.PGHOST || env.DB_HOST || 'localhost',
    port: Number(env.PGPORT ?? env.DB_PORT ?? 5432),
    username: env.PGUSER || env.DB_USERNAME || 'postgres',
    password: env.PGPASSWORD || env.DB_PASSWORD || '',
    database: env.PGDATABASE || env.DB_NAME || 'jericho_school',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}

/**
 * Schema auto-sync. Explicit opt-in only.
 */
export function shouldSynchronize(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SYNCHRONIZE_DB === 'true';
}