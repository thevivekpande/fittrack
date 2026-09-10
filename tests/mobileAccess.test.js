import test from 'node:test';
import assert from 'node:assert/strict';
import { getMobileAccessUrls, getNetworkAccess, isLoopbackHostname } from '../src/mobileAccess.js';

const interfaces = {
  lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  en0: [{ address: '192.168.1.23', family: 'IPv4', internal: false }, { address: 'fe80::123', family: 'IPv6', internal: false }],
  en1: [{ address: '203.0.113.9', family: 'IPv4', internal: false }],
  en2: [{ address: '10.1.0.5', family: 4, internal: false }],
  en3: [{ address: '169.254.3.4', family: 'IPv4', internal: false }],
  alias: [{ address: '192.168.1.23', family: 'IPv4', internal: false }],
};

test('public QR preserves the exact origin and pathname while stripping query and hash', () => {
  assert.deepEqual(getMobileAccessUrls('https://fit.example/app/workouts?name=Sam#session'), ['https://fit.example/app/workouts']);
  assert.deepEqual(getMobileAccessUrls('http://192.168.1.23:4173/fittrack/?token=private#home'), ['http://192.168.1.23:4173/fittrack/']);
});

test('loopback development addresses never become mobile QR targets', () => {
  for (const host of ['localhost', 'studio.localhost', '127.0.0.1', '127.2.3.4', '[::1]']) {
    assert.equal(isLoopbackHostname(host), true);
    assert.deepEqual(getMobileAccessUrls(`http://${host}:4173/`), []);
  }
  assert.deepEqual(getMobileAccessUrls('http://0.0.0.0:4173/'), []);
  assert.deepEqual(getMobileAccessUrls('http://[::]:4173/'), []);
  assert.deepEqual(getMobileAccessUrls('http://2130706433:4173/'), []);
  assert.deepEqual(getMobileAccessUrls('http://[::ffff:127.0.0.1]:4173/'), []);
  assert.deepEqual(getMobileAccessUrls('http://[0:0:0:0:0:0:0:1]:4173/'), []);
});

test('network discovery uses actual bound port, excludes internal/link-local/IPv6, and prefers private IPs', () => {
  assert.deepEqual(getNetworkAccess({ interfaces, boundAddress: '0.0.0.0', port: 4174 }), {
    urls: ['http://10.1.0.5:4174', 'http://192.168.1.23:4174', 'http://203.0.113.9:4174'], loopbackOnly: false,
  });
  assert.deepEqual(getNetworkAccess({ interfaces, boundAddress: '192.168.1.23', port: 4173, protocol: 'https:' }), {
    urls: ['https://192.168.1.23:4173'], loopbackOnly: false,
  });
});

test('a loopback-only or unstarted Vite socket cannot advertise reachable network links', () => {
  for (const boundAddress of ['127.0.0.1', '::1', null, undefined]) {
    assert.deepEqual(getNetworkAccess({ interfaces, boundAddress, port: 4173 }), { urls: [], loopbackOnly: true });
  }
  assert.deepEqual(getMobileAccessUrls('http://localhost:4173/', { urls: ['http://192.168.1.23:4173'], loopbackOnly: true }), []);
});

test('LAN links retain app paths without leaking URL parameters', () => {
  const network = getNetworkAccess({ interfaces, boundAddress: '::', port: 4173 });
  assert.deepEqual(getMobileAccessUrls('http://localhost:4173/fittrack/?profile=private#today', network), [
    'http://10.1.0.5:4173/fittrack/', 'http://192.168.1.23:4173/fittrack/', 'http://203.0.113.9:4173/fittrack/',
  ]);
});

test('unsafe URLs, credentials, malformed responses, and external discovery targets are rejected', () => {
  for (const value of ['javascript:alert(1)', 'data:text/plain,test', '//example.com', 'file:///tmp/index.html', 'not a URL', 'https://person:secret@example.com/', 'http://224.0.0.1/']) {
    assert.deepEqual(getMobileAccessUrls(value), []);
  }
  const bad = ['https://external.example/', 'http://external.example:4173/', 'javascript:alert(1)',
    'http://127.0.0.1:4173', 'http://0.0.0.0:4173', 'http://169.254.1.2:4173', 'http://239.1.1.1:4173',
    'http://192.168.1.23:9999', 'https://192.168.1.23:4173', 'http://user:pass@192.168.1.23:4173',
    'http://192.168.1.23:4173/redirect', 'http://192.168.1.23:4173/?secret=yes'];
  assert.deepEqual(getMobileAccessUrls('http://localhost:4173/', { urls: bad, loopbackOnly: false }), []);
  assert.deepEqual(getMobileAccessUrls('http://localhost:4173/', { urls: 'not an array', loopbackOnly: false }), []);
});
