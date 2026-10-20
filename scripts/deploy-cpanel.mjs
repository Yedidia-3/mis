/**
 * Upload a built API and frontend to cPanel over SFTP, then restart the API.
 *
 * The hosting account has no shell, so this never runs a remote command.
 * Passenger restarts the Node app when tmp/restart.txt changes.
 *
 * Required env:
 *   CPANEL_SSH_KEY   private key, PEM text
 * Optional env:
 *   CPANEL_HOST      default 198.38.92.236
 *   CPANEL_USER      default jerichoschoolac
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import SftpClient from 'ssh2-sftp-client';

const root = process.env.REPO_ROOT || join(fileURLToPath(new URL('.', import.meta.url)), '..');
const apiDist = join(root, 'apps/api/dist');
const webDist = join(root, 'apps/frontend/dist');
const home = '/home/jerichoschoolac';
const apiRemote = `${home}/api.jerichoschool.ac.rw/dist`;
const webRemote = `${home}/mis.jerichoschool.ac.rw`;

function privateKey() {
  const raw = process.env.CPANEL_SSH_KEY ?? '';
  const key = raw.replace(/\\n/g, '\n').trim();
  if (!key.includes('BEGIN')) {
    throw new Error('CPANEL_SSH_KEY is missing. Add the cPanel private key as a GitHub secret.');
  }
  return key.endsWith('\n') ? key : `${key}\n`;
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

async function uploadTree(sftp, localDir, remoteDir) {
  await sftp.mkdir(remoteDir, true);
  for (const file of walk(localDir)) {
    const dest = join(remoteDir, relative(localDir, file)).split('\\').join('/');
    await sftp.mkdir(dest.slice(0, dest.lastIndexOf('/')), true);
    await sftp.fastPut(file, dest);
  }
}

const sftp = new SftpClient();
await sftp.connect({
  host: process.env.CPANEL_HOST || '198.38.92.236',
  port: 22,
  username: process.env.CPANEL_USER || 'jerichoschoolac',
  privateKey: privateKey(),
  readyTimeout: 20000,
});

try {
  await uploadTree(sftp, apiDist, apiRemote);
  await sftp.fastPut(join(webDist, 'index.html'), `${webRemote}/index.html`);
  await uploadTree(sftp, join(webDist, 'assets'), `${webRemote}/assets`);
  await sftp.put(
    Buffer.from(`${new Date().toISOString()}\n`),
    `${home}/api.jerichoschool.ac.rw/tmp/restart.txt`,
  );
  console.log('Uploaded API dist, frontend, and restart.txt');
} finally {
  await sftp.end();
}
