#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const apiDir = path.resolve(process.cwd());
const runtimeDir = path.join(apiDir, '.runtime');
const pidFile = path.join(runtimeDir, 'dev-processes.json');
const ports = [4000, 3003, 3004, 3005];

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPids() {
  if (!fs.existsSync(pidFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(pidFile, 'utf8'));
  } catch {
    return {};
  }
}

function signalPid(pid, sig) {
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function pidsOnPort(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split(/\s+/)
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);
  } catch {
    return [];
  }
}

async function main() {
  const stored = readPids();
  const known = Object.values(stored)
    .map((v) => Number(v?.pid))
    .filter((v) => Number.isInteger(v) && v > 0);

  for (const pid of known) {
    if (alive(pid)) {
      signalPid(pid, 'SIGTERM');
      console.log(`[dev-stop-all] SIGTERM pid=${pid}`);
    }
  }

  await wait(900);

  for (const pid of known) {
    if (alive(pid)) {
      signalPid(pid, 'SIGKILL');
      console.log(`[dev-stop-all] SIGKILL pid=${pid}`);
    }
  }

  for (const port of ports) {
    const pids = pidsOnPort(port);
    for (const pid of pids) {
      if (alive(pid)) {
        signalPid(pid, 'SIGTERM');
        console.log(`[dev-stop-all] clear port ${port} pid=${pid}`);
      }
    }
  }

  await wait(600);

  for (const port of ports) {
    const pids = pidsOnPort(port);
    for (const pid of pids) {
      if (alive(pid)) {
        signalPid(pid, 'SIGKILL');
        console.log(`[dev-stop-all] force clear port ${port} pid=${pid}`);
      }
    }
  }

  fs.rmSync(pidFile, { force: true });
  console.log('[dev-stop-all] stack stopped.');
}

main().catch((err) => {
  console.error('[dev-stop-all] error:', err?.message || err);
  process.exit(1);
});
