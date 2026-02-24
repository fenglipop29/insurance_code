import { createSession, dateOnly, formatUser, getState, nextId, persistState } from '../common/state.mjs';
import { recordPoints } from '../services/points.service.mjs';

export function registerAuthRoutes(app) {
  app.post('/api/auth/send-code', (req, res) => {
    const state = getState();
    const mobile = String(req.body?.mobile || '').trim();

    if (!/^1[3-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ code: 'INVALID_MOBILE', message: '请输入正确手机号' });
    }

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

  app.post('/api/auth/verify-basic', (req, res) => {
    const state = getState();
    const name = String(req.body?.name || '').trim();
    const mobile = String(req.body?.mobile || '').trim();
    const code = String(req.body?.code || '').trim();

    if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) {
      return res.status(400).json({ code: 'INVALID_NAME', message: '姓名格式不正确' });
    }
    if (!/^1[3-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ code: 'INVALID_MOBILE', message: '手机号格式不正确' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ code: 'INVALID_CODE', message: '验证码格式不正确' });
    }

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
      const userId = nextId(state.users);
      user = {
        id: userId,
        tenantId: 1,
        orgId: 1,
        teamId: 1,
        ownerUserId: userId,
        name,
        mobile,
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
      user.isVerifiedBasic = true;
      user.verifiedAt = new Date().toISOString();
      user.tenantId = Number(user.tenantId || 1);
      user.orgId = Number(user.orgId || 1);
      user.teamId = Number(user.teamId || 1);
      user.ownerUserId = Number(user.ownerUserId || user.id);
    }

    const token = createSession(user.id);
    persistState();

    return res.json({ token, user: formatUser(user) });
  });
}
