#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const apiDir = path.resolve(process.cwd());
const runtimeDir = path.join(apiDir, '.runtime');
const pidFile = path.join(runtimeDir, 'dev-processes.json');
const labels = [
  { key: 'api', name: 'API', port: 4000, url: 'http://localhost:4000' },
  { key: 'c', name: 'C', port: 3003, url: 'http://localhost:3003' },
  { key: 'b', name: 'B', port: 3004, url: 'http://localhost:3004' },
  { key: 'p', name: 'P', port: 3005, url: 'http://localhost:3005' },
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

const stored = readPids();
for (const svc of labels) {
  const managedPid = Number(stored?.[svc.key]?.pid) || 0;
  const managedState = alive(managedPid) ? 'up' : 'down';
  const portPids = pidsOnPort(svc.port);
  console.log(`${svc.name} | managed=${managedState} pid=${managedPid || '-'} | port:${svc.port} holders=${portPids.join(',') || '-'} | ${svc.url}`);
}
