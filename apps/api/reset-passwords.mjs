import bcrypt from 'bcrypt';
import pg from 'pg';
import { readFileSync } from 'fs';

// Read DB config from .env
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const client = new pg.Client({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USERNAME || 'postgres',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'jericho_school',
});

await client.connect();

const accounts = [
  { email: 'admin@jericho.rw', password: 'Admin@Jericho2025!' },
  { email: 'dean@gmail.com',   password: 'Dean@Jericho2025!'  },
  { email: 'test@gmail.com',   password: 'Test@Jericho2025!'  },
];

for (const { email, password } of accounts) {
  const hash = await bcrypt.hash(password, 10);
  const res = await client.query(
    `UPDATE users SET password=$1, failed_login_attempts=0, locked_until=NULL WHERE email=$2 RETURNING email, role`,
    [hash, email]
  );
  if (res.rows.length) {
    console.log(`✓ Reset ${res.rows[0].email} (${res.rows[0].role}) → password: ${password}`);
  } else {
    console.log(`✗ Not found: ${email}`);
  }
}

await client.end();
console.log('\nDone. You can now log in with the passwords above.');
