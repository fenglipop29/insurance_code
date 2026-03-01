#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_PATH="${1:-$ROOT_DIR/data/tag_rule_bundle_v1.json}"
API_BASE="${API_BASE:-http://127.0.0.1:4000}"
TENANT_ID="${TENANT_ID:-1}"
ACTOR_TYPE="${ACTOR_TYPE:-employee}"
ACTOR_ID="${ACTOR_ID:-9001}"

if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "bundle file not found: $BUNDLE_PATH" >&2
  exit 1
fi

API_BASE="$API_BASE" TENANT_ID="$TENANT_ID" ACTOR_TYPE="$ACTOR_TYPE" ACTOR_ID="$ACTOR_ID" BUNDLE_PATH="$BUNDLE_PATH" node <<'NODE'
const fs = require('fs');

const apiBase = process.env.API_BASE;
const tenantId = String(process.env.TENANT_ID || '1');
const actorType = String(process.env.ACTOR_TYPE || 'employee');
const actorId = String(process.env.ACTOR_ID || '9001');
const bundlePath = process.env.BUNDLE_PATH;

const headers = {
  'Content-Type': 'application/json',
  'x-actor-type': actorType,
  'x-actor-id': actorId,
  'x-tenant-id': tenantId,
};

async function request(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${path} ${(data && data.message) || 'request failed'}`);
  }
  return data;
}

(async () => {
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const tags = Array.isArray(bundle.tags) ? bundle.tags : [];
  const rules = Array.isArray(bundle.rules) ? bundle.rules : [];

  const tagsRes = await request('/api/p/tags?page=1&pageSize=500');
  const existingTags = Array.isArray(tagsRes.list) ? tagsRes.list : [];
  const tagByCode = new Map(existingTags.map((t) => [String(t.tagCode), t]));

  for (const tag of tags) {
    const payload = {
      id: tagByCode.get(String(tag.tagCode))?.id,
      tagCode: String(tag.tagCode || ''),
      tagName: String(tag.tagName || ''),
      tagType: String(tag.tagType || 'enum'),
      source: String(tag.source || 'rule_engine'),
      description: String(tag.description || ''),
      status: String(tag.status || 'active'),
      valueSchema: tag.valueSchema && typeof tag.valueSchema === 'object' ? tag.valueSchema : {},
    };
    const saved = await request('/api/p/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const item = saved.item || payload;
    tagByCode.set(String(item.tagCode), item);
    console.log(`[tag] upsert ${item.tagCode}(${item.id})`);
  }

  const rulesRes = await request('/api/p/tag-rules?page=1&pageSize=500');
  const existingRules = Array.isArray(rulesRes.list) ? rulesRes.list : [];
  const ruleByCode = new Map(existingRules.map((r) => [String(r.ruleCode), r]));

  for (const rule of rules) {
    const targetCodes = Array.isArray(rule.targetTagCodes)
      ? rule.targetTagCodes.map((x) => String(x || '')).filter(Boolean)
      : rule.targetTagCode
      ? [String(rule.targetTagCode)]
      : [];
    const targetIds = targetCodes
      .map((code) => Number(tagByCode.get(code)?.id || 0))
      .filter((id) => id > 0);

    if (!targetIds.length) {
      throw new Error(`rule ${rule.ruleCode} has no resolvable targetTagIds from ${targetCodes.join(',')}`);
    }

    const payload = {
      id: ruleByCode.get(String(rule.ruleCode))?.id,
      ruleCode: String(rule.ruleCode || ''),
      ruleName: String(rule.ruleName || ''),
      targetTagId: Number(targetIds[0]),
      targetTagIds: targetIds,
      priority: Number(rule.priority || 100),
      status: String(rule.status || 'active'),
      conditionDsl: rule.conditionDsl && typeof rule.conditionDsl === 'object' ? rule.conditionDsl : { op: 'and', children: [] },
      outputExpr: rule.outputExpr && typeof rule.outputExpr === 'object' ? rule.outputExpr : { mode: 'const', value: '' },
    };

    const saved = await request('/api/p/tag-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const item = saved.item || payload;
    console.log(`[rule] upsert ${item.ruleCode}(${item.id}) -> tagIds=${targetIds.join(',')}`);
  }

  console.log('import completed');
})().catch((err) => {
  console.error('import failed:', err.message || err);
  process.exit(1);
});
NODE
