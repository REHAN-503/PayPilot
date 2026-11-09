const baseUrl = process.env.SMOKE_API_URL || 'http://localhost:4000';
const origin = process.env.SMOKE_ORIGIN || 'http://localhost:3000';
const email = `smoke-${Date.now()}@example.com`;
const password = process.env.SMOKE_PASSWORD || 'Password123!';
let cookie = '';

async function call(method, path, body, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}`);
  }
  return data;
}

const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push([name, 'PASS']);
  } catch (error) {
    checks.push([name, 'FAIL', error instanceof Error ? error.message : String(error)]);
  }
}

await check('GET /health', async () => {
  let health;
  try {
    health = await call('GET', '/health');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('expected 200, got 404')) throw error;
    health = await call('GET', '/');
  }
  if (health.status !== 'ok') throw new Error('health status is not ok');
});

await check('sign up and sign in', async () => {
  await call('POST', '/api/auth/sign-up/email', { email, password, name: 'Smoke User' }, 200);
  await call('POST', '/api/auth/sign-in/email', { email, password }, 200);
});

let plan;
await check('create intent and plan', async () => {
  const result = await call('POST', '/intents', {
    rawInput: 'I need a developer monitor under $250. Prioritize text clarity and value.',
  }, 201);
  plan = result.plan;
  if (!plan?.id || !plan.items?.length || !Array.isArray(plan.alternatives)) {
    throw new Error('plan is missing items or alternatives');
  }
});

await check('evaluate and approve plan', async () => {
  await call('POST', `/plans/${plan.id}/evaluate`, undefined, 201);
  await call('POST', `/plans/${plan.id}/approve`, { note: 'Smoke approval' }, 201);
});

let payment;
await check('create payment order', async () => {
  const result = await call('POST', `/plans/${plan.id}/pay`, undefined, 201);
  payment = result.payment;
  if (!result.orderId || !payment?.id) throw new Error('orderId/payment missing');
});

const config = await call('GET', '/health/config');
if (config.simulatorEnabled) {
  await check('simulate capture and verify ledger state', async () => {
    await call('POST', '/dev/webhooks/simulate', {
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: payment.id,
    });
    const updated = await call('GET', `/payments/${payment.id}`);
    if (updated.status !== 'CAPTURED' || !updated.webhookConfirmedAt) {
      throw new Error('capture was not confirmed');
    }
    const summary = await call('GET', '/analytics/summary');
    if (summary.transactionCount !== undefined && summary.transactionCount < 1) {
      throw new Error('ledger count did not increment');
    }
    const duplicate = await call('POST', '/dev/webhooks/simulate', {
      eventType: 'duplicate',
      duplicateEventId: 'SIM-DUP-EVENT-001',
      paymentId: payment.id,
    });
    if (!duplicate.replayedDuplicate) throw new Error('duplicate was not ignored');
  });
}

await check('reject forged webhook', async () => {
  await call('POST', '/webhooks/paypal', { id: 'forged' }, 401);
});

console.table(checks.map(([name, result, detail]) => ({ check: name, result, detail: detail || '' })));
if (checks.some(([, result]) => result === 'FAIL')) process.exit(1);
