import type { WebhookEvent } from './types.js';

const encoder = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify the `tracksim-signature` header (hex HMAC-SHA256 of the body with your webhook secret).
 * Pass the raw request body string, exactly as received.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  return timingSafeEqual(await hmacHex(secret, rawBody), signature.trim().toLowerCase());
}

/** Verify the signature and parse the event. Throws if the signature is invalid. */
export async function constructWebhookEvent<T = Record<string, any>>(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): Promise<WebhookEvent<T>> {
  if (!(await verifyWebhookSignature(rawBody, signature, secret))) {
    throw new Error('TrackSim: invalid webhook signature');
  }
  return JSON.parse(rawBody) as WebhookEvent<T>;
}

export const SIGNATURE_HEADER = 'tracksim-signature';
