#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

const apiDir = path.resolve(process.cwd());
const workspaceDir = path.resolve(apiDir, '..');
const bDir = path.join(workspaceDir, 'insurance_code_B');
const pDir = path.join(workspaceDir, 'insurance_code_P');
const runtimeDir = path.join(apiDir, '.runtime');
const logDir = path.join(runtimeDir, 'logs');
const pidFile = path.join(runtimeDir, 'dev-processes.json');

const services = [
  {
    key: 'api',
    name: 'API',
    cwd: apiDir,
    cmd: 'npm',
    args: ['run', 'dev:api:skeleton'],
    port: 4000,
    logFile: path.join(logDir, 'api.log'),
  },
  {
    key: 'c',
    name: 'C',
    cwd: apiDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3003', '--host=0.0.0.0'],
    port: 3003,
    logFile: path.join(logDir, 'c.log'),
  },
  {
    key: 'b',
    name: 'B',
    cwd: bDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3004', '--host=0.0.0.0'],
    port: 3004,
    logFile: path.join(logDir, 'b.log'),
  },
  {
    key: 'p',
    name: 'P',
    cwd: pDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3005', '--host=0.0.0.0'],
    port: 3005,
    logFile: path.join(logDir, 'p.log'),
  },
];

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

function writePids(next) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(pidFile, JSON.stringify(next, null, 2));
}

function ensureReady() {
  fs.mkdirSync(logDir, { recursive: true });
}

function startService(svc) {
  const out = fs.openSync(svc.logFile, 'a');
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });
  child.unref();
  return child.pid;
}

function hasRunningManagedProcesses(stored) {
  return services.some((svc) => alive(Number(stored?.[svc.key]?.pid)));
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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  ensureReady();
  const stored = readPids();
  if (hasRunningManagedProcesses(stored)) {
    console.error('[dev-start-all] managed stack is already running. Run: npm run dev:stack:stop');
    process.exit(1);
  }

  for (const svc of services) {
    const holders = pidsOnPort(svc.port);
    if (holders.length > 0) {
      console.error(`[dev-start-all] port ${svc.port} is occupied by pid(s): ${holders.join(', ')}`);
      console.error('[dev-start-all] please run: npm run dev:stack:stop');
      process.exit(1);
    }
  }

  const next = {};
  for (const svc of services) {
    const pid = startService(svc);
    next[svc.key] = {
      pid,
      port: svc.port,
      cwd: svc.cwd,
      startedAt: new Date().toISOString(),
      logFile: svc.logFile,
    };
    console.log(`[dev-start-all] started ${svc.name}: pid=${pid} port=${svc.port}`);
  }

  writePids(next);
  await wait(1200);

  const failed = [];
  for (const svc of services) {
    if (!alive(Number(next?.[svc.key]?.pid))) failed.push(svc.name);
  }

  if (failed.length > 0) {
    console.error(`[dev-start-all] failed services: ${failed.join(', ')}`);
    console.error(`[dev-start-all] check logs under ${logDir}`);
    process.exit(1);
  }

  console.log('[dev-start-all] all services launched.');
  console.log(`[dev-start-all] C=http://localhost:3003 B=http://localhost:3004 P=http://localhost:3005 API=http://localhost:4000`);
}

main().catch((err) => {
  console.error('[dev-start-all] error:', err?.message || err);
  process.exit(1);
});
