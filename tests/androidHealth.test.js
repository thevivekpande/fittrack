import test from 'node:test';
import assert from 'node:assert/strict';

let moduleNumber = 0;
async function bridgeHarness(t, { native = true } = {}) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const listeners = new Map();
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  const fakeWindow = {
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
  };
  if (native) fakeWindow.FitTrackAndroid = { postMessage: text => requests.push(JSON.parse(text)) };
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: fakeWindow });
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else delete globalThis.window;
  });
  const bridge = await import(`../src/androidHealth.js?test=${++moduleNumber}`);
  return {
    ...bridge, window: fakeWindow, listeners, requests, timers,
    reply(detail) { for (const handler of listeners.get('fittrack:native') || []) handler({ detail }); },
    expire(id) { const timer = timers.get(id); timers.delete(id); timer?.callback(); },
  };
}

test('a normal browser rejects native requests without pretending to be connected', async t => {
  const bridge = await bridgeHarness(t, { native: false });
  assert.equal(bridge.isAndroidCompanion(), false);
  await assert.rejects(bridge.requestAndroidHealth('availability'), /Android companion/);
  assert.equal(bridge.listeners.size, 0);
  assert.equal(bridge.timers.size, 0);
  bridge.window.FitTrackAndroid = { postMessage: true };
  assert.equal(bridge.isAndroidCompanion(), false);
  delete globalThis.window;
  assert.equal(bridge.isAndroidCompanion(), false);
});

test('concurrent native replies are correlated by request ID even when returned out of order', async t => {
  const bridge = await bridgeHarness(t);
  assert.equal(bridge.isAndroidCompanion(), true);
  const payload = Object.freeze({ json: '{"format":"fittrack-health-v1"}', label: 'Health export' });
  const first = bridge.requestAndroidHealth('availability');
  const second = bridge.requestAndroidHealth('exportHealth', payload);
  assert.equal(bridge.requests.length, 2);
  assert.equal(bridge.requests[0].method, 'availability');
  assert.equal(bridge.requests[1].method, 'exportHealth');
  assert.deepEqual(bridge.requests[1].args, payload);
  assert.ok(bridge.requests.every(request => typeof request.id === 'string' && request.id.length > 0));
  assert.notEqual(bridge.requests[0].id, bridge.requests[1].id);
  assert.equal(bridge.listeners.get('fittrack:native').length, 1);
  const exported = { exported: true };
  bridge.reply({ id: bridge.requests[1].id, ok: true, result: exported });
  assert.deepEqual(await second, exported);
  const availability = { available: true, granted: ['steps'] };
  bridge.reply({ id: bridge.requests[0].id, ok: true, result: availability });
  assert.deepEqual(await first, availability);
  assert.equal(bridge.timers.size, 0);
});

test('unsolicited, missing-ID, and duplicate native replies do not settle another request', async t => {
  const bridge = await bridgeHarness(t);
  let settled = false;
  const pending = bridge.requestAndroidHealth('sync').then(value => { settled = true; return value; });
  for (const detail of [undefined, null, {}, 'not a reply', { id: 'unknown', ok: true }, { ok: true, result: 'missing ID' }]) bridge.reply(detail);
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(bridge.timers.size, 1);
  const id = bridge.requests[0].id;
  bridge.reply({ id, ok: true, result: 'first result' });
  bridge.reply({ id, ok: false, error: { message: 'late error' } });
  assert.equal(await pending, 'first result');
  assert.equal(bridge.timers.size, 0);
});

test('native failures reject with their message and release the request timer', async t => {
  const bridge = await bridgeHarness(t);
  const request = bridge.requestAndroidHealth('sync');
  const assertion = assert.rejects(request, /Permission was revoked/);
  bridge.reply({ id: bridge.requests[0].id, ok: false, error: { message: 'Permission was revoked.' } });
  await assertion;
  assert.equal(bridge.timers.size, 0);

  const generic = bridge.requestAndroidHealth('sync');
  const genericAssertion = assert.rejects(generic, /could not finish/);
  bridge.reply({ id: bridge.requests[1].id, ok: false });
  await genericAssertion;
  assert.equal(bridge.timers.size, 0);
});

test('a native postMessage exception does not leak a timer or prevent the next request', async t => {
  const bridge = await bridgeHarness(t);
  const failure = new Error('Native bridge closed');
  bridge.window.FitTrackAndroid.postMessage = () => { throw failure; };
  await assert.rejects(bridge.requestAndroidHealth('sync'), error => error === failure);
  assert.equal(bridge.timers.size, 0);
  bridge.window.FitTrackAndroid.postMessage = text => bridge.requests.push(JSON.parse(text));
  const next = bridge.requestAndroidHealth('availability');
  bridge.reply({ id: bridge.requests[0].id, ok: true, result: { available: true } });
  assert.deepEqual(await next, { available: true });
  assert.equal(bridge.timers.size, 0);
});

test('permission prompts get a longer timeout and late replies cannot affect later requests', async t => {
  const bridge = await bridgeHarness(t);
  const connection = bridge.requestAndroidHealth('connect');
  const sync = bridge.requestAndroidHealth('sync');
  const connectionAssertion = assert.rejects(connection, /timed out/);
  const syncAssertion = assert.rejects(sync, /timed out/);
  const timerEntries = [...bridge.timers.entries()];
  assert.equal(timerEntries[0][1].delay, 120000);
  assert.equal(timerEntries[1][1].delay, 45000);
  bridge.expire(timerEntries[1][0]);
  bridge.expire(timerEntries[0][0]);
  await Promise.all([connectionAssertion, syncAssertion]);
  const next = bridge.requestAndroidHealth('availability');
  bridge.reply({ id: bridge.requests[0].id, ok: true, result: 'expired connect result' });
  bridge.reply({ id: bridge.requests[1].id, ok: true, result: 'expired sync result' });
  assert.equal(bridge.timers.size, 1);
  bridge.reply({ id: bridge.requests[2].id, ok: true, result: 'current result' });
  assert.equal(await next, 'current result');
  assert.equal(bridge.timers.size, 0);
});

test('an immediate native reply is received because registration happens before postMessage', async t => {
  const bridge = await bridgeHarness(t);
  bridge.window.FitTrackAndroid.postMessage = text => {
    const request = JSON.parse(text);
    bridge.reply({ id: request.id, ok: true, result: { available: true } });
  };
  assert.deepEqual(await bridge.requestAndroidHealth('availability'), { available: true });
  assert.equal(bridge.timers.size, 0);
});
