#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, 'docs');
const allowedExternalRoots = [path.resolve(repoRoot, '..', 'shared-contracts')];
const checkAll = process.argv.includes('--all');
const mdFiles = checkAll
  ? fs
      .readdirSync(docsDir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => path.join(docsDir, name))
  : [path.join(docsDir, 'INDEX.md')];

const missing = [];
const oldAbsolute = [];

function normalizeTarget(raw, fileDir) {
  const target = String(raw || '').trim();
  if (!target) return null;
  if (target.startsWith('http://') || target.startsWith('https://')) return null;
  if (target.startsWith('#')) return null;
  if (target.startsWith('mailto:')) return null;
  if (target.startsWith('./') || target.startsWith('../')) {
    const noAnchor = target.split('#')[0].split('?')[0];
    return path.resolve(fileDir, noAnchor);
  }
  if (target.startsWith('/Users/')) {
    return target;
  }
  return null;
}

for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const fileDir = path.dirname(file);

  if (text.includes('/Users/wenshuping/Documents/New project/')) {
    oldAbsolute.push({ file, hint: 'contains old absolute path prefix /Users/wenshuping/Documents/New project/' });
  }

  const codePathMatches = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const markdownLinkMatches = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  const candidates = [...codePathMatches, ...markdownLinkMatches];

  for (const c of candidates) {
    const resolved = normalizeTarget(c, fileDir);
    if (!resolved) continue;
    const allowedExternal = allowedExternalRoots.some((root) => resolved.startsWith(root));
    if (resolved.startsWith('/Users/') && !resolved.startsWith(repoRoot) && !allowedExternal) {
      missing.push({ file, target: c, resolved, reason: 'path points outside current repo' });
      continue;
    }
    if (!fs.existsSync(resolved)) {
      missing.push({ file, target: c, resolved, reason: 'target not found' });
    }
  }
}

if (oldAbsolute.length > 0) {
  console.error('[check-doc-links] old absolute path usage found:');
  oldAbsolute.forEach((x) => console.error(`- ${x.file}: ${x.hint}`));
}

if (missing.length > 0) {
  console.error('[check-doc-links] broken or out-of-repo links:');
  missing.forEach((x) => console.error(`- ${x.file}: ${x.target} -> ${x.resolved} (${x.reason})`));
}

if (oldAbsolute.length > 0 || missing.length > 0) {
  process.exit(1);
}

console.log(`[check-doc-links] ok, checked ${mdFiles.length} markdown file(s)${checkAll ? ' (all mode)' : ' (index mode)'}.`);
