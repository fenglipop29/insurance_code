#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (!key.startsWith('--')) continue;
    if (!next || next.startsWith('--')) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function sqlInsert(table, cols, row, conflict) {
  const values = cols.map((c) => sqlValue(row[c]));
  const base = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')})`;
  return conflict ? `${base} ${conflict};` : `${base};`;
}

function iconByType(type) {
  if (type === '医疗') return 'stethoscope';
  if (type === '重疾') return 'heart-pulse';
  return 'shield';
}

function directionByType(type) {
  return type === 'consume' ? 'out' : 'in';
}

function statusFromLegacy(status, expiresAt) {
  if (status === 'written_off') return 'written_off';
  if (status === 'cancelled') return 'cancelled';
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'expired';
  return 'pending';
}

function isValidIsoDate(dateText) {
  if (!dateText) return false;
  return !Number.isNaN(new Date(dateText).getTime());
}

function countBy(arr, keyFn) {
  const result = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

function buildReport(db) {
  const issues = [];

  const userIds = new Set((db.users || []).map((u) => Number(u.id)));
  const mallItemIds = new Set((db.mallItems || []).map((i) => Number(i.id)));
  const courseIds = new Set((db.learningCourses || []).map((c) => Number(c.id)));
  const policyIds = new Set((db.policies || []).map((p) => Number(p.id)));

  for (const row of db.redemptions || []) {
    if (!userIds.has(Number(row.userId))) {
      issues.push(`redemptions.id=${row.id} has missing userId=${row.userId}`);
    }
    if (!mallItemIds.has(Number(row.itemId))) {
      issues.push(`redemptions.id=${row.id} has missing itemId=${row.itemId}`);
    }
    if (!row.writeoffToken) {
      issues.push(`redemptions.id=${row.id} has empty writeoffToken`);
    }
  }

  const tokenCount = countBy(db.redemptions || [], (r) => String(r.writeoffToken || ''));
  for (const [token, count] of tokenCount.entries()) {
    if (!token || token === 'undefined' || token === 'null') continue;
    if (count > 1) issues.push(`writeoffToken duplicated: ${token} x${count}`);
  }

  for (const row of db.courseCompletions || []) {
    if (!userIds.has(Number(row.userId))) {
      issues.push(`courseCompletions.id=${row.id} has missing userId=${row.userId}`);
    }
    if (!courseIds.has(Number(row.courseId))) {
      issues.push(`courseCompletions.id=${row.id} has missing courseId=${row.courseId}`);
    }
  }

  for (const row of db.mallItems || []) {
    if (Number(row.stock) < 0) issues.push(`mallItems.id=${row.id} has negative stock=${row.stock}`);
  }

  const pointRows = [...(db.pointTransactions || [])].sort((a, b) => Number(a.id) - Number(b.id));
  const runningByUser = new Map();
  for (const row of pointRows) {
    const userId = Number(row.userId);
    const prev = runningByUser.get(userId) || 0;
    const amount = Math.abs(Number(row.amount) || 0);
    const expected = row.type === 'consume' ? prev - amount : prev + amount;
    const actual = Number(row.balance) || 0;
    if (expected !== actual) {
      issues.push(
        `pointTransactions.id=${row.id} balance mismatch userId=${userId}, expected=${expected}, actual=${actual}`
      );
    }
    runningByUser.set(userId, actual);
  }

  for (const policy of db.policies || []) {
    if (!policyIds.has(Number(policy.id))) continue;
    if (!Array.isArray(policy.responsibilities) || policy.responsibilities.length === 0) {
      issues.push(`policies.id=${policy.id} has empty responsibilities`);
    }
    if (!Array.isArray(policy.paymentHistory) || policy.paymentHistory.length === 0) {
      issues.push(`policies.id=${policy.id} has empty paymentHistory`);
    }
  }

  const summary = {
    users: (db.users || []).length,
    pointTransactions: (db.pointTransactions || []).length,
    mallItems: (db.mallItems || []).length,
    redemptions: (db.redemptions || []).length,
    learningCourses: (db.learningCourses || []).length,
    courseCompletions: (db.courseCompletions || []).length,
    policies: (db.policies || []).length,
    policyResponsibilities: (db.policies || []).reduce(
      (sum, p) => sum + (Array.isArray(p.responsibilities) ? p.responsibilities.length : 0),
      0
    ),
    policyPaymentHistory: (db.policies || []).reduce(
      (sum, p) => sum + (Array.isArray(p.paymentHistory) ? p.paymentHistory.length : 0),
      0
    ),
    issues: issues.length,
  };

  return { summary, issues };
}

function buildSql(db) {
  const now = new Date().toISOString();
  const sql = [];
  sql.push('-- db.json -> PostgreSQL migration SQL (v1)');
  sql.push('-- generated by scripts/migrate_dbjson_to_postgres_v1.mjs');
  sql.push('BEGIN;');

  for (const user of db.users || []) {
    const row = {
      id: Number(user.id),
      name: user.name || '未知用户',
      mobile_enc: user.mobile || '',
      mobile_masked: user.mobile || '',
      is_verified_basic: Boolean(user.isVerifiedBasic),
      verified_at: user.verifiedAt || null,
      created_at: user.createdAt || now,
      updated_at: now,
    };
    sql.push(
      sqlInsert(
        'users',
        ['id', 'name', 'mobile_enc', 'mobile_masked', 'is_verified_basic', 'verified_at', 'created_at', 'updated_at'],
        row,
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_verified_basic = EXCLUDED.is_verified_basic, verified_at = EXCLUDED.verified_at, updated_at = EXCLUDED.updated_at'
      )
    );
  }

  for (const tx of db.pointTransactions || []) {
    const row = {
      id: Number(tx.id),
      user_id: Number(tx.userId),
      direction: directionByType(tx.type),
      amount: Math.abs(Number(tx.amount) || 0),
      source_type: tx.source || 'legacy',
      source_id: String(tx.sourceId || tx.id),
      idempotency_key: `legacy-pt-${tx.id}`,
      balance_after: Number(tx.balance) || 0,
      created_at: tx.createdAt || now,
    };
    sql.push(
      sqlInsert(
        'point_transactions',
        [
          'id',
          'user_id',
          'direction',
          'amount',
          'source_type',
          'source_id',
          'idempotency_key',
          'balance_after',
          'created_at',
        ],
        row,
        'ON CONFLICT (id) DO NOTHING'
      )
    );
  }

  const accountBalance = new Map();
  for (const tx of [...(db.pointTransactions || [])].sort((a, b) => Number(a.id) - Number(b.id))) {
    accountBalance.set(Number(tx.userId), Number(tx.balance) || 0);
  }
  for (const [userId, balance] of accountBalance.entries()) {
    sql.push(
      sqlInsert(
        'point_accounts',
        ['user_id', 'balance', 'updated_at'],
        { user_id: userId, balance, updated_at: now },
        'ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at'
      )
    );
  }

  for (const item of db.mallItems || []) {
    const row = {
      id: Number(item.id),
      name: item.name || '',
      points_cost: Number(item.pointsCost) || 0,
      stock: Number(item.stock) || 0,
      is_active: Boolean(item.isActive),
      sort_order: 0,
      created_at: now,
      updated_at: now,
    };
    sql.push(
      sqlInsert(
        'mall_items',
        ['id', 'name', 'points_cost', 'stock', 'is_active', 'sort_order', 'created_at', 'updated_at'],
        row,
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, points_cost = EXCLUDED.points_cost, stock = EXCLUDED.stock, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at'
      )
    );
  }

  const itemNameById = new Map((db.mallItems || []).map((item) => [Number(item.id), item.name || '']));
  for (const order of db.redemptions || []) {
    const row = {
      id: Number(order.id),
      user_id: Number(order.userId),
      item_id: Number(order.itemId),
      item_name: itemNameById.get(Number(order.itemId)) || '',
      points_cost: Number(order.pointsCost) || 0,
      writeoff_token: order.writeoffToken || `LEGACY-${order.id}`,
      status: statusFromLegacy(order.status, order.expiresAt),
      expires_at: order.expiresAt || null,
      written_off_at: order.writtenOffAt || null,
      created_at: order.createdAt || now,
    };
    sql.push(
      sqlInsert(
        'redemption_orders',
        [
          'id',
          'user_id',
          'item_id',
          'item_name',
          'points_cost',
          'writeoff_token',
          'status',
          'expires_at',
          'written_off_at',
          'created_at',
        ],
        row,
        'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, written_off_at = EXCLUDED.written_off_at'
      )
    );
  }

  for (const course of db.learningCourses || []) {
    const row = {
      id: Number(course.id),
      title: course.title || '',
      desc: course.desc || '',
      type: course.type || 'article',
      type_label: course.typeLabel || '',
      progress: Number(course.progress) || 0,
      time_left: course.timeLeft || '',
      image: course.image || '',
      action: course.action || '',
      color: course.color || '',
      btn_color: course.btnColor || '',
      points: Number(course.points) || 0,
      category: course.category || '',
      content: course.content || '',
      created_at: now,
      updated_at: now,
    };
    sql.push(
      sqlInsert(
        'learning_courses',
        [
          'id',
          'title',
          'desc',
          'type',
          'type_label',
          'progress',
          'time_left',
          'image',
          'action',
          'color',
          'btn_color',
          'points',
          'category',
          'content',
          'created_at',
          'updated_at',
        ],
        row,
        'ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, progress = EXCLUDED.progress, updated_at = EXCLUDED.updated_at'
      )
    );
  }

  for (const completion of db.courseCompletions || []) {
    const row = {
      id: Number(completion.id),
      user_id: Number(completion.userId),
      course_id: Number(completion.courseId),
      points_awarded: Number(completion.pointsAwarded) || 0,
      created_at: completion.createdAt || now,
    };
    sql.push(
      sqlInsert(
        'learning_course_completions',
        ['id', 'user_id', 'course_id', 'points_awarded', 'created_at'],
        row,
        'ON CONFLICT (id) DO NOTHING'
      )
    );
  }

  let responsibilityId = 0;
  let paymentHistoryId = 0;
  for (const policy of db.policies || []) {
    const row = {
      id: Number(policy.id),
      user_id: Number(policy.createdBy) || null,
      company: policy.company || '',
      name: policy.name || '',
      type: policy.type || '',
      icon: policy.icon || iconByType(policy.type),
      amount: Number(policy.amount) || 0,
      next_payment: policy.nextPayment || '',
      status: policy.status || '',
      applicant: policy.applicant || '',
      insured: policy.insured || '',
      period_start: policy.periodStart || '',
      period_end: policy.periodEnd || '',
      annual_premium: Number(policy.annualPremium) || 0,
      payment_period: policy.paymentPeriod || '',
      coverage_period: policy.coveragePeriod || '',
      policy_no: policy.policyNo || `LEGACY-${policy.id}`,
      created_at: isValidIsoDate(policy.createdAt) ? policy.createdAt : now,
      updated_at: now,
    };

    sql.push(
      sqlInsert(
        'insurance_policies',
        [
          'id',
          'user_id',
          'company',
          'name',
          'type',
          'icon',
          'amount',
          'next_payment',
          'status',
          'applicant',
          'insured',
          'period_start',
          'period_end',
          'annual_premium',
          'payment_period',
          'coverage_period',
          'policy_no',
          'created_at',
          'updated_at',
        ],
        row,
        'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, annual_premium = EXCLUDED.annual_premium, updated_at = EXCLUDED.updated_at'
      )
    );

    for (const rs of policy.responsibilities || []) {
      responsibilityId += 1;
      sql.push(
        sqlInsert(
          'policy_responsibilities',
          ['id', 'policy_id', 'name', 'desc', 'limit_amount', 'sort_order'],
          {
            id: responsibilityId,
            policy_id: Number(policy.id),
            name: rs.name || '',
            desc: rs.desc || '',
            limit_amount: Number(rs.limit) || 0,
            sort_order: responsibilityId,
          },
          'ON CONFLICT (id) DO NOTHING'
        )
      );
    }

    for (const ph of policy.paymentHistory || []) {
      paymentHistoryId += 1;
      sql.push(
        sqlInsert(
          'policy_payment_history',
          ['id', 'policy_id', 'payment_date', 'amount', 'note', 'status', 'sort_order'],
          {
            id: paymentHistoryId,
            policy_id: Number(policy.id),
            payment_date: ph.date || '',
            amount: Number(ph.amount) || 0,
            note: ph.note || '',
            status: ph.status || '',
            sort_order: paymentHistoryId,
          },
          'ON CONFLICT (id) DO NOTHING'
        )
      );
    }
  }

  sql.push('COMMIT;');
  return sql.join('\n') + '\n';
}

function buildMarkdownReport(report, inputPath) {
  const lines = [];
  lines.push('# db.json -> PostgreSQL 数据校验报告（v1）');
  lines.push('');
  lines.push(`- 输入文件：\`${inputPath}\``);
  lines.push(`- 生成时间：\`${new Date().toISOString()}\``);
  lines.push(`- 结论：${report.issues.length === 0 ? 'PASS（可迁移）' : `FAIL（发现 ${report.issues.length} 项问题）`}`);
  lines.push('');
  lines.push('## 计数汇总');
  lines.push('');
  lines.push('| 项目 | 数量 |');
  lines.push('|---|---:|');
  for (const [k, v] of Object.entries(report.summary)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('## 校验规则');
  lines.push('');
  lines.push('- 兑换单外键完整性（user/item）。');
  lines.push('- 核销码唯一性。');
  lines.push('- 课程完成记录外键完整性。');
  lines.push('- 商城库存非负。');
  lines.push('- 积分流水余额一致性（逐用户按流水重算）。');
  lines.push('- 保单责任/缴费历史完整性。');
  lines.push('');
  lines.push('## 问题明细');
  lines.push('');
  if (report.issues.length === 0) {
    lines.push('- 无问题。');
  } else {
    for (const issue of report.issues.slice(0, 200)) {
      lines.push(`- ${issue}`);
    }
    if (report.issues.length > 200) {
      lines.push(`- ... 其余 ${report.issues.length - 200} 项已省略`);
    }
  }
  lines.push('');
  lines.push('## 执行建议');
  lines.push('');
  lines.push('1. 先在 staging 执行 SQL 导入并再次跑校验。');
  lines.push('2. 确认 `point_accounts.balance` 与 `point_transactions.balance_after` 一致。');
  lines.push('3. 抽样验证兑换核销、学习积分、保单详情三条链路。');
  lines.push('');
  return lines.join('\n');
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in || 'server/data/db.json');
  const sqlOut = path.resolve(args['sql-out'] || 'server/data/dbjson_to_postgres_v1.sql');
  const reportOut = path.resolve(args['report-out'] || 'docs/dbjson-migration-validation-report-v1.md');

  const db = readJson(inputPath);
  const report = buildReport(db);
  const sql = buildSql(db);
  const markdown = buildMarkdownReport(report, inputPath);

  ensureDir(sqlOut);
  ensureDir(reportOut);
  fs.writeFileSync(sqlOut, sql, 'utf-8');
  fs.writeFileSync(reportOut, markdown, 'utf-8');

  const summary = {
    input: inputPath,
    sqlOut,
    reportOut,
    issues: report.issues.length,
    status: report.issues.length === 0 ? 'PASS' : 'FAIL',
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  process.exit(report.issues.length === 0 ? 0 : 2);
}

main();
