import { createSession, dateOnly, formatUser, getState, nextId, persistState } from '../common/state.mjs';
import { validateBody } from '../common/middleware.mjs';
import { recordPoints } from '../services/points.service.mjs';
import { sendCodeBodySchema, verifyBasicBodySchema } from '../schemas/auth.schemas.mjs';

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function resolveTenantForRegistration(state, req) {
  const tenantIdCandidates = [
    toPositiveInt(req.headers['x-tenant-id']),
    toPositiveInt(req.body?.tenantId),
  ].filter((x) => Number.isFinite(Number(x)) && Number(x) > 0);
  for (const candidate of tenantIdCandidates) {
    const found = (state.tenants || []).find((t) => Number(t.id) === Number(candidate));
    if (found) return found;
  }
  const rawKey = String(
    req.headers['x-tenant-code'] || req.headers['x-tenant-key'] || req.body?.tenantCode || req.body?.tenantKey || ''
  )
    .trim()
    .toLowerCase();
  if (!rawKey) return null;
  return (
    (state.tenants || []).find((t) => {
      const key = String(t.tenantCode || t.code || t.tenantKey || `tenant_${t.id}`)
        .trim()
        .toLowerCase();
      return Boolean(key) && key === rawKey;
    }) || null
  );
}

function resolveDefaultOrgAndTeam(state, tenantId) {
  const tenantOrg = (state.orgUnits || [])
    .filter((x) => Number(x.tenantId) === Number(tenantId))
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
  const tenantTeam = (state.teams || [])
    .filter((x) => Number(x.tenantId) === Number(tenantId))
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
  return {
    orgId: tenantOrg ? Number(tenantOrg.id) : null,
    teamId: tenantTeam ? Number(tenantTeam.id) : null,
  };
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/send-code', validateBody(sendCodeBodySchema), (req, res) => {
    const state = getState();
    const { mobile } = req.body;

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const today = dateOnly(new Date());
      const sentToday = state.smsCodes.filter((s) => s.mobile === mobile && String(s.createdAt || '').startsWith(today)).length;
      if (sentToday >= 5) {
        return res.status(429).json({ code: 'SMS_LIMIT_REACHED', message: '今日验证码次数已达上限' });
      }
    }

    const code = process.env.DEV_SMS_CODE || '123456';
    state.smsCodes.push({
      id: nextId(state.smsCodes),
      mobile,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    });
    persistState();

    const body = { ok: true, message: '验证码已发送' };
    if (process.env.NODE_ENV !== 'production') body.dev_code = code;
    return res.json(body);
  });

  app.post('/api/auth/verify-basic', validateBody(verifyBasicBodySchema), (req, res) => {
    const state = getState();
    const { name, mobile, code } = req.body;
    const tenant = resolveTenantForRegistration(state, req);

    const isProd = process.env.NODE_ENV === 'production';
    const devBypassCode = process.env.DEV_SMS_CODE || '123456';
    const isDevBypass = !isProd && code === devBypassCode;

    const sms = [...state.smsCodes]
      .reverse()
      .find((s) => s.mobile === mobile && s.code === code && !s.used);

    if (!sms && !isDevBypass) {
      return res.status(400).json({ code: 'CODE_NOT_FOUND', message: '验证码错误或已失效' });
    }
    if (sms && isProd && new Date(sms.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ code: 'CODE_EXPIRED', message: '验证码已过期' });
    }
    if (sms) sms.used = true;

    let user = state.users.find((u) => u.mobile === mobile);
    if (!user) {
      if (!tenant) {
        return res.status(400).json({
          code: 'TENANT_REQUIRED',
          message: '缺少租户标识，请携带 tenantId（或 tenantCode/tenantKey 兜底）',
        });
      }
      const userId = nextId(state.users);
      const { orgId, teamId } = resolveDefaultOrgAndTeam(state, Number(tenant.id));
      user = {
        id: userId,
        tenantId: Number(tenant.id),
        orgId,
        teamId,
        // 默认未分配给业务员，后续由系统分配接口绑定 ownerUserId 与租户归属
        ownerUserId: 0,
        name,
        mobile,
        openId: '',
        unionId: '',
        nickName: name,
        avatarUrl: '',
        memberLevel: 1,
        growthValue: 0,
        lastActiveAt: new Date().toISOString(),
        deviceInfo: String(req.headers['user-agent'] || ''),
        isVerifiedBasic: true,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      recordPoints({
        userId: user.id,
        direction: 'in',
        amount: 200,
        sourceType: 'onboard',
        sourceId: String(user.id),
        idempotencyKey: `onboard:${user.id}`,
        description: '新用户基础积分',
      });
    } else {
      user.name = name;
      user.nickName = user.nickName || name;
      user.isVerifiedBasic = true;
      user.verifiedAt = new Date().toISOString();
      user.lastActiveAt = new Date().toISOString();
      user.deviceInfo = user.deviceInfo || String(req.headers['user-agent'] || '');
      if (!Number.isFinite(Number(user.tenantId)) && tenant) {
        const { orgId, teamId } = resolveDefaultOrgAndTeam(state, Number(tenant.id));
        user.tenantId = Number(tenant.id);
        user.orgId = orgId;
        user.teamId = teamId;
      } else {
        user.tenantId = Number.isFinite(Number(user.tenantId)) ? Number(user.tenantId) : null;
        user.orgId = Number.isFinite(Number(user.orgId)) ? Number(user.orgId) : null;
        user.teamId = Number.isFinite(Number(user.teamId)) ? Number(user.teamId) : null;
      }
      // 保留已有归属；未分配时保持 0，避免被错误回写成“客户自己”
      user.ownerUserId = Number(user.ownerUserId ?? 0);
    }

    const token = createSession(user.id);
    persistState();
    const session = (state.sessions || []).find((s) => String(s.token) === String(token));

    return res.json({ token, csrfToken: session?.csrfToken || '', user: formatUser(user) });
  });
}
