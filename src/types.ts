// Shapes follow https://docs.tracksim.app. Fields the docs leave undocumented are typed loosely.

export type Game = 'eut2' | 'ats';
export type JobType = 'truck' | 'car' | 'bus';

export interface ToggleSettings {
  job_logging: boolean;
  live_tracking: boolean;
}

export interface Driver {
  id: number;
  steam_id: string;
  username: string;
  profile_photo_url: string;
  client: {
    is_installed: boolean;
    version: { version: string; branch: string; platform: string } | null;
  };
  settings: {
    eut2: { truck: ToggleSettings; coach: ToggleSettings };
    ats: { truck: ToggleSettings; car: ToggleSettings };
  };
  is_banned: boolean;
  last_active: string;
}

export interface DriverSettingsUpdate {
  eut2_job_logging?: boolean;
  eut2_live_tracking?: boolean;
  eut2_coach_job_logging?: boolean;
  eut2_coach_live_tracking?: boolean;
  ats_job_logging?: boolean;
  ats_live_tracking?: boolean;
  ats_car_job_logging?: boolean;
  ats_car_live_tracking?: boolean;
}

export interface RoutePoint {
  x: number;
  z: number;
  /** Unix seconds */
  time: number;
}

export interface BusRoutePoint extends RoutePoint {
  speed_kmh: number;
  satisfaction: number;
  peak_lateral_g: number;
  peak_braking_g: number;
  peak_acceleration_g: number;
  peak_vertical_g: number;
}

export interface MapSession {
  full_url: string;
  /** JWT, expires after 24 hours. Treat as a secret. */
  flag: string;
}

export interface MapRouteSummary {
  id: string;
  game: Game;
  map: string;
  name: string | null;
  convoy: boolean;
  created_at: string;
  updated_at: string;
}

export interface MapRoute extends MapRouteSummary {
  waypoints: unknown;
  tenant: {
    id: number;
    slug: string;
    name: string;
    custom_domain: { domain: string | null };
  };
}

// ---- Webhooks ----

export type TruckEventType =
  | 'job.started' | 'job.delivered' | 'job.cancelled';
export type CarEventType =
  | 'car_job.started' | 'car_job.delivered' | 'car_job.cancelled';
export type BusEventType =
  | 'bus_job.started' | 'bus_job.completed' | 'bus_job.cancelled'
  | 'satisfaction_decrease' | 'satisfaction_increase';
export type SharedEventType =
  | 'fine' | 'tollgate' | 'ferry' | 'train' | 'collision'
  | 'repair' | 'refuel' | 'teleport' | 'speeding';
export type WebhookEventType = TruckEventType | CarEventType | BusEventType | SharedEventType;

export interface WebhookEvent<T = Record<string, any>> {
  object: 'event';
  type: WebhookEventType | (string & {});
  data: T;
}

export interface JobEvent {
  type: string;
  /** ISO 8601 UTC */
  real_time: string;
  /** Unix seconds */
  time: number;
  location: { x: number; y: number; z: number };
  meta: Record<string, any>;
}

interface Named { unique_id: string; name: string | null }

export interface TruckJob {
  id: number;
  object: string;
  driver: {
    id: number;
    steam_id: string;
    username: string;
    profile_photo_url: string;
    client: { version: { name: string; branch_name: string; platform: string } };
    last_active: string;
  };
  start_time: string;
  stop_time: string | null;
  time_spent: number;
  planned_distance: number;
  driven_distance: number;
  adblue_used: number;
  fuel_used: number;
  is_special: boolean;
  is_late: boolean;
  market: string;
  cargo: Named & { mass: number; damage: number };
  game: { short_name: Game; language: string | null; had_police_enabled: boolean };
  multiplayer: { mode: string; meta: { player_id: number | string; server: string } } | null;
  source_city: Named;
  source_company: Named;
  destination_city: Named;
  destination_company: Named;
  truck: Record<string, any>;
  trailers: Record<string, any>[];
  events: JobEvent[];
  [key: string]: unknown;
}
