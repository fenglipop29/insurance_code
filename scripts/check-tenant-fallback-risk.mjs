#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const allowlistFile = path.join(repoRoot, 'scripts', 'tenant-fallback-allowlist.txt');
const updateBaseline = process.argv.includes('--update-baseline');

const targetFiles = [
  'server/skeleton-c-v1/routes/p-admin.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin.routes.mjs',
  'server/skeleton-c-v1/routes/track.routes.mjs',
  'server/skeleton-c-v1/routes/uploads.routes.mjs',
  'server/skeleton-c-v1/common/access-control.mjs',
  'server/skeleton-c-v1/services/customer-assignment.service.mjs',
];

const riskyPatterns = [
  /req\.tenantContext\.[a-zA-Z]+\s*\|\|\s*1/,
  /req\.(body|query)\?\.tenantId\s*\|\|\s*req\.tenantContext\?\.tenantId\s*\|\|\s*1/,
  /Number\(row\.tenantId\s*\|\|\s*1\)\s*===\s*Number\(req\.tenantContext\.tenantId\s*\|\|\s*1\)/,
];

function collectFindings() {
  const findings = [];
  for (const rel of targetFiles) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const hit = riskyPatterns.some((re) => re.test(line));
      if (!hit) return;
      findings.push(`${rel}::${line.trim()}`);
    });
  }
  return [...new Set(findings)].sort();
}

function readAllowlist() {
  if (!fs.existsSync(allowlistFile)) return [];
  return fs
    .readFileSync(allowlistFile, 'utf8')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .sort();
}

const findings = collectFindings();

if (updateBaseline) {
  fs.writeFileSync(allowlistFile, findings.join('\n') + (findings.length ? '\n' : ''));
  console.log(`[tenant-fallback-risk] baseline updated: ${findings.length} item(s).`);
  process.exit(0);
}

const allowlist = new Set(readAllowlist());
const unexpected = findings.filter((x) => !allowlist.has(x));

if (unexpected.length > 0) {
  console.error('[tenant-fallback-risk] new risky fallback usages found:');
  unexpected.forEach((x) => console.error(`- ${x}`));
  console.error('[tenant-fallback-risk] if intentional, review and update baseline with --update-baseline');
  process.exit(1);
}

console.log(`[tenant-fallback-risk] ok, ${findings.length} known item(s), no new regressions.`);
