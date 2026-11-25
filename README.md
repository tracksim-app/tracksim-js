<p align="center">
  <img src="https://tracksim-prod.s3.eu-west-2.amazonaws.com/public/logos/TrackSim-logo-full-color.png" alt="TrackSim" width="360" />
</p>

<h1 align="center">TrackSim JavaScript / TypeScript SDK</h1>

<p align="center">
  An open-source, zero-dependency client for the <a href="https://docs.tracksim.app">TrackSim API</a> and webhooks.<br/>
  Works in Node.js 20+, Bun, Deno, and edge runtimes (anything with <code>fetch</code> and Web Crypto).
</p>

---

## Install

```bash
npm install @tracksim/sdk
```

## Quick start

Generate an API key on the **API** tab of [tracksim.app/integrations](https://tracksim.app/integrations). You can only see the key once, so copy it when you create it.

```ts
import { TrackSim } from '@tracksim/sdk';

const tracksim = new TrackSim({ apiKey: process.env.TRACKSIM_API_KEY! });

const company = await tracksim.me();
```

## API

All methods return Promises. Response types are exported (`Driver`, `RoutePoint`, `MapRoute`, …).

### Drivers

```ts
await tracksim.drivers.add('76561198000000000');      // POST   /v1/drivers/add
await tracksim.drivers.remove('76561198000000000');   // DELETE /v1/drivers/remove
await tracksim.drivers.get('76561198000000000');      // GET    /v3/drivers/{steam_id}/details

await tracksim.drivers.manage('76561198000000000', {  // PATCH  /v3/drivers/{steam_id}/manage
  eut2_job_logging: true,
  eut2_live_tracking: false,
  ats_car_job_logging: true,
});
```

### Jobs

```ts
// GET /v2/jobs/{job_id}/route?job_type=truck|car|bus
const points = await tracksim.jobs.route(12345, 'truck'); // [{ x, z, time }]
const bus = await tracksim.jobs.route(12345, 'bus');      // adds speed_kmh, satisfaction, peak_*_g
```

A job's route doesn't change once it's recorded, so cache it to stay under the rate limits.

### Route Planner (maps)

This needs a paid plan and the Route Planner add-on. It's limited to 60 requests a minute.

```ts
const { full_url, flag } = await tracksim.maps.create(); // POST   /v3/maps/create
await tracksim.maps.edit(routeId);                       // PATCH  /v3/maps/{route_id}/edit
await tracksim.maps.list();                              // GET    /v3/maps/routes
await tracksim.maps.get(routeId);                        // GET    /v3/maps/{route_id}/route
await tracksim.maps.delete(routeId);                     // DELETE /v3/maps/{route_id}/route
```

`flag` is a JWT that expires after 24 hours. Treat it, and `full_url`, as secrets.

### Anything else

If an endpoint isn't wrapped yet, use the low-level helper. It adds auth and error handling:

```ts
const data = await tracksim.request('GET', '/v1/me');
```

### Errors

Non-2xx responses throw a `TrackSimError`:

```ts
import { TrackSimError } from '@tracksim/sdk';

try {
  await tracksim.drivers.add(steamId);
} catch (err) {
  if (err instanceof TrackSimError) {
    console.log(err.status); // 403
    console.log(err.code);   // e.g. "steam_profile_private", "max_driver_limit_reached"
    console.log(err.body);   // parsed response body
  }
}
```

## Webhooks

Set up webhooks in [tracksim.app/settings](https://tracksim.app/settings). TrackSim signs each delivery with HMAC-SHA256 using your webhook secret and puts the hex digest in the `tracksim-signature` header.

```ts
import express from 'express';
import { constructWebhookEvent, SIGNATURE_HEADER } from '@tracksim/sdk';

const app = express();

// Use the raw body: re-serialising parsed JSON can change the bytes and break the signature.
app.post('/tracksim', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const event = await constructWebhookEvent(req.body, req.get(SIGNATURE_HEADER), process.env.TRACKSIM_WEBHOOK_SECRET!);

    if (event.type === 'job.delivered') {
      console.log('Delivered job', event.data.id);
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(401);
  }
});
```

Any 2xx response counts as delivered. TrackSim retries a failed delivery up to 3 times (after 5, 10 and 20 minutes).

If you only need the check, `verifyWebhookSignature(rawBody, signature, secret)` returns `Promise<boolean>`.

Event types (typed as `WebhookEventType`):

| Job type | Events |
| --- | --- |
| Truck | `job.started`, `job.delivered`, `job.cancelled` |
| Car | `car_job.started`, `car_job.delivered`, `car_job.cancelled` |
| Coach | `bus_job.started`, `bus_job.completed`, `bus_job.cancelled`, `satisfaction_decrease`, `satisfaction_increase` |
| Shared | `fine`, `tollgate`, `ferry`, `train`, `collision`, `repair`, `refuel`, `teleport`, `speeding` |

See the [payload reference](https://docs.tracksim.app/docs/truck-jobs/integrations/webhook-payloads) for full payloads. A `TruckJob` type is exported.

## Development

```bash
npm install
npm test      # builds with tsc, then runs node:test
```

Contributions are welcome. Open an issue or pull request.

## License

[MIT](./LICENSE)
