import 'reflect-metadata';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDbConnection } from './database/db-config';
import { entities } from './entities';

dotenv.config();

/**
 * DataSource used by the TypeORM CLI (`npm run migration:generate|run|revert`).
 *
 * `synchronize` is deliberately false here: the CLI's job is to produce and
 * apply migrations, and auto-sync would make those migrations meaningless.
 *
 * The migrations glob resolves against __dirname so it works both under
 * ts-node (src/migrations/*.ts) and from the compiled build (dist/migrations/*.js).
 */
// Exactly one DataSource export — the TypeORM CLI rejects the file otherwise.
export const AppDataSource = new DataSource({
  type: 'postgres',
  ...buildDbConnection(),
  entities,
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
