import type {
  BusRoutePoint, Driver, DriverSettingsUpdate, JobType, MapRoute, MapRouteSummary, MapSession, RoutePoint,
} from './types.js';

export interface TrackSimOptions {
  /** API key from https://tracksim.app/integrations (API tab). */
  apiKey: string;
  /** Defaults to https://api.tracksim.app */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

export class TrackSimError extends Error {
  constructor(
    /** HTTP status code. */
    readonly status: number,
    /** Error code/message from the API, e.g. `job_does_not_exist_in_company`. */
    readonly code: string,
    /** Parsed response body (or raw text if not JSON). */
    readonly body: unknown,
  ) {
    super(`TrackSim API error ${status}: ${code}`);
    this.name = 'TrackSimError';
  }
}

export class TrackSim {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: TrackSimOptions) {
    if (!options?.apiKey) throw new TypeError('TrackSim: apiKey is required');
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? 'https://api.tracksim.app').replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  /** Low-level request helper. `path` includes the version, e.g. `/v1/me`. */
  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.#fetch(this.#baseUrl + path, {
      method,
      headers: {
        Authorization: `Api-Key ${this.#apiKey}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    if (!res.ok) {
      const code = (data && typeof data === 'object' && (data.error ?? data.reason ?? data.message)) || res.statusText || 'unknown_error';
      throw new TrackSimError(res.status, String(code), data);
    }
    return data as T;
  }

  /** Information about your company. */
  me<T = Record<string, any>>(): Promise<T> {
    return this.request('GET', '/v1/me');
  }

  readonly drivers = {
    /** Add a driver to your company by Steam64 ID. */
    add: (steamId: string): Promise<Driver> =>
      this.request('POST', '/v1/drivers/add', { steam_id: steamId }),
    /** Remove a driver from your company. */
    remove: (steamId: string): Promise<unknown> =>
      this.request('DELETE', '/v1/drivers/remove', { steam_id: steamId }),
    /** Get a driver's details. */
    get: (steamId: string): Promise<Driver> =>
      this.request('GET', `/v3/drivers/${enc(steamId)}/details`),
    /** Update a driver's job logging / live tracking settings. */
    manage: (steamId: string, settings: DriverSettingsUpdate): Promise<Driver> =>
      this.request('PATCH', `/v3/drivers/${enc(steamId)}/manage`, settings),
  };

  readonly jobs = {
    /** Recorded route of a job. Results don't change once recorded, so cache them. */
    route: (<J extends JobType>(jobId: number | string, jobType: J) =>
      this.request('GET', `/v2/jobs/${enc(jobId)}/route?job_type=${enc(jobType)}`)) as {
      (jobId: number | string, jobType: 'bus'): Promise<BusRoutePoint[]>;
      (jobId: number | string, jobType: 'truck' | 'car'): Promise<RoutePoint[]>;
    },
  };

  /** Route Planner (paid plan + Route Planner add-on, 60 requests/minute). */
  readonly maps = {
    /** Create a new route; returns a planner URL and a 24h flag. */
    create: (): Promise<MapSession> => this.request('POST', '/v3/maps/create'),
    /** Open an existing route for editing; returns a planner URL and a 24h flag. */
    edit: (routeId: string): Promise<MapSession> =>
      this.request('PATCH', `/v3/maps/${enc(routeId)}/edit`),
    /** List all routes (without waypoints). */
    list: (): Promise<MapRouteSummary[]> => this.request('GET', '/v3/maps/routes'),
    /** Get one route including waypoints. */
    get: (routeId: string): Promise<MapRoute> =>
      this.request('GET', `/v3/maps/${enc(routeId)}/route`),
    /** Delete a route. */
    delete: (routeId: string): Promise<{ deleted: boolean }> =>
      this.request('DELETE', `/v3/maps/${enc(routeId)}/route`),
  };
}

const enc = (v: string | number) => encodeURIComponent(String(v));
