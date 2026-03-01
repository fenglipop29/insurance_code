#!/usr/bin/env node

const base = process.env.API_BASE_URL || 'http://127.0.0.1:4000';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  console.log(`[smoke] base=${base}`);

  const badCode = await request('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ mobile: '123' }),
  });
  assert(badCode.status === 400, 'send-code failure case mismatch');

  const sent = await request('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ mobile: '13800000001' }),
  });
  assert(sent.status === 200 && sent.body?.ok === true, 'send-code success case mismatch');

  const badVerify = await request('/api/auth/verify-basic', {
    method: 'POST',
    body: JSON.stringify({ name: 'A', mobile: '13800000001', code: '123456' }),
  });
  assert(badVerify.status === 400, 'verify-basic failure case mismatch');

  const verify = await request('/api/auth/verify-basic', {
    method: 'POST',
    body: JSON.stringify({ name: '张三', mobile: '13800000001', code: '123456' }),
  });
  assert(verify.status === 200 && verify.body?.token, 'verify-basic success case mismatch');

  const token = verify.body.token;
  const authHeader = { Authorization: `Bearer ${token}` };

  const me = await request('/api/me', { headers: authHeader });
  assert(me.status === 200 && me.body?.user?.is_verified_basic === true, '/api/me mismatch');

  const activities = await request('/api/activities', { headers: authHeader });
  assert(activities.status === 200 && Array.isArray(activities.body?.activities), '/api/activities mismatch');

  const signIn = await request('/api/sign-in', { method: 'POST', headers: authHeader });
  // This account may have already signed in today in shared test environments.
  assert(
    (signIn.status === 200 && signIn.body?.ok === true) ||
      (signIn.status === 409 && signIn.body?.code === 'ALREADY_SIGNED'),
    '/api/sign-in success case mismatch'
  );

  const signInAgain = await request('/api/sign-in', { method: 'POST', headers: authHeader });
  assert(signInAgain.status === 409 && signInAgain.body?.code === 'ALREADY_SIGNED', '/api/sign-in failure case mismatch');

  const completeTask = await request('/api/activities/3/complete', { method: 'POST', headers: authHeader });
  // Shared test account may have already completed the task.
  assert(
    (completeTask.status === 200 && completeTask.body?.ok === true) ||
      (completeTask.status === 409 && completeTask.body?.code === 'ALREADY_COMPLETED'),
    '/api/activities/:id/complete success mismatch'
  );

  const completeTaskAgain = await request('/api/activities/3/complete', { method: 'POST', headers: authHeader });
  assert(
    completeTaskAgain.status === 409 && completeTaskAgain.body?.code === 'ALREADY_COMPLETED',
    '/api/activities/:id/complete failure mismatch'
  );

  const pointsSummary = await request('/api/points/summary', { headers: authHeader });
  assert(pointsSummary.status === 200 && Number.isFinite(pointsSummary.body?.balance), '/api/points/summary mismatch');

  const pointsTx = await request('/api/points/transactions', { headers: authHeader });
  assert(pointsTx.status === 200 && Array.isArray(pointsTx.body?.list), '/api/points/transactions mismatch');

  const unauthorized = await request('/api/points/summary');
  assert(unauthorized.status === 401 && unauthorized.body?.code === 'UNAUTHORIZED', 'unauthorized case mismatch');

  console.log('[smoke] auth/user/activities/points passed');
})().catch((err) => {
  console.error('[smoke] failed:', err.message);
  process.exit(1);
});
