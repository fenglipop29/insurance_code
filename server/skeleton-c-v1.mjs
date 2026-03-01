import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createSkeletonApp } from './skeleton-c-v1/app.mjs';
import { closeState, getStorageBackend, initializeState } from './skeleton-c-v1/common/state.mjs';

dotenv.config();

const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '127.0.0.1';
const RUNTIME_DIR = path.resolve(process.cwd(), '.runtime');
const LOCK_FILE = path.join(RUNTIME_DIR, `api-${PORT}.lock`);

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSingleInstanceLock() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const payload = JSON.stringify(
    {
      pid: process.pid,
      port: PORT,
      host: HOST,
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  try {
    fs.writeFileSync(LOCK_FILE, payload, { flag: 'wx' });
    return () => {
      try {
        const raw = fs.readFileSync(LOCK_FILE, 'utf8');
        const holder = JSON.parse(raw);
        if (Number(holder?.pid) === process.pid) fs.rmSync(LOCK_FILE, { force: true });
      } catch {
        fs.rmSync(LOCK_FILE, { force: true });
      }
    };
  } catch {
    let lockHolderPid = 0;
    try {
      const raw = fs.readFileSync(LOCK_FILE, 'utf8');
      const holder = JSON.parse(raw);
      lockHolderPid = Number(holder?.pid) || 0;
    } catch {
      // ignore parse/read errors and overwrite stale lock below
    }

    if (!processAlive(lockHolderPid)) {
      fs.rmSync(LOCK_FILE, { force: true });
      fs.writeFileSync(LOCK_FILE, payload, { flag: 'wx' });
      return () => {
        try {
          const raw = fs.readFileSync(LOCK_FILE, 'utf8');
          const holder = JSON.parse(raw);
          if (Number(holder?.pid) === process.pid) fs.rmSync(LOCK_FILE, { force: true });
        } catch {
          fs.rmSync(LOCK_FILE, { force: true });
        }
      };
    }

    throw new Error(`API_ALREADY_RUNNING: port ${PORT} is held by pid=${lockHolderPid}`);
  }
}

async function main() {
  const releaseLock = acquireSingleInstanceLock();
  await initializeState();

  const app = createSkeletonApp();
  const server = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`C API skeleton listening on http://${HOST}:${PORT} (storage=${getStorageBackend()})`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closeState();
      releaseLock();
      process.exit(0);
    });
  };

  process.on('exit', releaseLock);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] bootstrap failed:', err?.message || err);
  process.exit(1);
});
