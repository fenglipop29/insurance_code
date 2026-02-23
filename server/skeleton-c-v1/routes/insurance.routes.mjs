import { authRequired } from '../common/middleware.mjs';
import { getState, nextId, persistState } from '../common/state.mjs';

export function registerInsuranceRoutes(app) {
  app.get('/api/insurance/overview', (_req, res) => {
    const state = getState();
    return res.json({
      summary: state.insuranceSummary,
      familyMembers: state.familyMembers,
      reminders: state.insuranceReminders,
    });
  });

  app.get('/api/insurance/policies', (_req, res) => {
    const state = getState();
    const policies = state.policies
      .map((p) => ({ ...p, icon: iconByType(p.type) }))
      .sort((a, b) => b.id - a.id);
    return res.json({ policies });
  });

  app.get('/api/insurance/policies/:id', (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const policy = state.policies.find((p) => p.id === id);
    if (!policy) {
      return res.status(404).json({ code: 'POLICY_NOT_FOUND', message: '保单不存在' });
    }
    return res.json({ policy: { ...policy, icon: iconByType(policy.type) } });
  });

  app.post('/api/insurance/policies/scan', (_req, res) => {
    return res.json({
      ok: true,
      data: {
        company: '中国平安保险',
        name: '平安福21重疾险',
        applicant: '张三',
        insured: '张三',
        date: '2024-02-20',
        paymentPeriod: '20年交',
        coveragePeriod: '终身',
        amount: '500000',
        firstPremium: '12000',
      },
    });
  });

  app.post('/api/insurance/policies', authRequired, (req, res) => {
    const state = getState();

    const company = String(req.body?.company || '').trim();
    const name = String(req.body?.name || '').trim();
    const applicant = String(req.body?.applicant || '').trim();
    const insured = String(req.body?.insured || '').trim();
    const date = String(req.body?.date || '').trim();
    const paymentPeriod = String(req.body?.paymentPeriod || '').trim();
    const coveragePeriod = String(req.body?.coveragePeriod || '').trim();
    const amount = Number(req.body?.amount);
    const firstPremium = Number(req.body?.firstPremium);
    const type = String(req.body?.type || '').trim() || inferPolicyType(name);

    if (!company || !name || !applicant || !insured || !date || !paymentPeriod || !coveragePeriod) {
      return res.status(400).json({ code: 'INVALID_POLICY_INPUT', message: '请完整填写保单信息' });
    }
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(firstPremium) || firstPremium <= 0) {
      return res.status(400).json({ code: 'INVALID_POLICY_AMOUNT', message: '保额或首期保费不正确' });
    }

    const policy = {
      id: nextId(state.policies),
      company,
      name,
      type,
      amount,
      nextPayment: nextPaymentDate(date),
      status: '保障中',
      applicant,
      insured,
      periodStart: date,
      periodEnd: calcPeriodEnd(date, coveragePeriod),
      annualPremium: firstPremium,
      paymentPeriod,
      coveragePeriod,
      responsibilities: defaultResponsibilities(type, amount),
      paymentHistory: [
        {
          date,
          amount: firstPremium,
          note: '首期缴费',
          status: '支付成功',
        },
      ],
      policyNo: `PL${Date.now()}${Math.floor(Math.random() * 1000)}`,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };

    state.policies.push(policy);
    refreshInsuranceSummaryFromState(state);
    persistState();

    return res.status(201).json({
      ok: true,
      policy: {
        ...policy,
        icon: iconByType(policy.type),
      },
    });
  });
}

function iconByType(type) {
  if (type === '医疗') return 'stethoscope';
  if (type === '重疾') return 'heart-pulse';
  if (type === '意外') return 'shield';
  return 'shield';
}

function inferPolicyType(name) {
  if (name.includes('医疗')) return '医疗';
  if (name.includes('重疾')) return '重疾';
  if (name.includes('意外')) return '意外';
  return '保障';
}

function calcPeriodEnd(startDate, coveragePeriod) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  if (coveragePeriod === '终身') return '终身';

  const years = Number(String(coveragePeriod).replace('年', ''));
  if (!Number.isFinite(years) || years <= 0) return startDate;

  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextPaymentDate(startDate) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultResponsibilities(type, amount) {
  if (type === '重疾') {
    return [
      { name: '重大疾病保险金', desc: '覆盖常见重大疾病', limit: amount },
      { name: '轻症疾病保险金', desc: '轻症多次赔付', limit: Math.floor(amount * 0.3) },
    ];
  }

  if (type === '意外') {
    return [
      { name: '意外身故/伤残', desc: '按合同约定比例给付', limit: amount },
      { name: '意外医疗', desc: '医疗费用报销', limit: Math.floor(amount * 0.1) },
    ];
  }

  return [
    { name: '一般医疗保险金', desc: '住院及门急诊保障', limit: amount },
    { name: '重疾医疗保险金', desc: '重大疾病医疗额外保障', limit: amount * 2 },
  ];
}

function refreshInsuranceSummaryFromState(targetState) {
  const activePolicies = targetState.policies.filter((p) => p.status === '保障中').length;
  const totalCoverage = targetState.policies.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const annualPremium = targetState.policies.reduce((sum, p) => sum + Number(p.annualPremium || 0), 0);

  targetState.insuranceSummary = {
    ...(targetState.insuranceSummary || {}),
    totalCoverage,
    activePolicies,
    annualPremium,
    healthScore: targetState.insuranceSummary?.healthScore || 85,
  };
}
