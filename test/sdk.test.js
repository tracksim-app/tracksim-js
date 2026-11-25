import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { TrackSim, TrackSimError, verifyWebhookSignature, constructWebhookEvent } from '../dist/index.js';

function mockFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return { fn, calls };
}

test('sends auth header, method, path and JSON body', async () => {
  const { fn, calls } = mockFetch(200, { id: 1, steam_id: '765' });
  const ts = new TrackSim({ apiKey: 'k', fetch: fn });
  const driver = await ts.drivers.add('765');
  assert.equal(driver.id, 1);
  assert.equal(calls[0].url, 'https://api.tracksim.app/v1/drivers/add');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Api-Key k');
  assert.deepEqual(JSON.parse(calls[0].init.body), { steam_id: '765' });
});

test('builds versioned paths and query strings', async () => {
  const { fn, calls } = mockFetch(200, []);
  const ts = new TrackSim({ apiKey: 'k', fetch: fn, baseUrl: 'http://x/' });
  await ts.jobs.route(42, 'bus');
  await ts.drivers.manage('765', { ats_live_tracking: false });
  await ts.maps.delete('a/b');
  assert.equal(calls[0].url, 'http://x/v2/jobs/42/route?job_type=bus');
  assert.equal(calls[1].url, 'http://x/v3/drivers/765/manage');
  assert.equal(calls[1].init.method, 'PATCH');
  assert.equal(calls[2].url, 'http://x/v3/maps/a%2Fb/route');
  assert.equal(calls[2].init.body, undefined);
});

test('throws TrackSimError with API error code', async () => {
  const { fn } = mockFetch(404, { error: 'job_does_not_exist_in_company' });
  const ts = new TrackSim({ apiKey: 'k', fetch: fn });
  await assert.rejects(ts.jobs.route(1, 'truck'), (err) => {
    assert.ok(err instanceof TrackSimError);
    assert.equal(err.status, 404);
    assert.equal(err.code, 'job_does_not_exist_in_company');
    return true;
  });
});

test('requires an apiKey', () => {
  assert.throws(() => new TrackSim({}), TypeError);
});

test('webhook signature verification', async () => {
  const body = JSON.stringify({ object: 'event', type: 'job.delivered', data: { id: 1 } });
  const sig = createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(await verifyWebhookSignature(body, sig, 'secret'), true);
  assert.equal(await verifyWebhookSignature(body, sig, 'wrong'), false);
  assert.equal(await verifyWebhookSignature(body + ' ', sig, 'secret'), false);
  assert.equal(await verifyWebhookSignature(body, undefined, 'secret'), false);
  const evt = await constructWebhookEvent(body, sig, 'secret');
  assert.equal(evt.type, 'job.delivered');
  await assert.rejects(constructWebhookEvent(body, 'bad', 'secret'));
});
