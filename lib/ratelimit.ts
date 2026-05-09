// lib/ratelimit.ts
//
// IP-based sliding-window rate limiting on /api/transform.
// Policy: 5 requests per 60 seconds per identifier (typically the client IP),
// fail-OPEN on Redis errors so an Upstash hiccup doesn't take the product down.
//
// Why sliding window over fixed window:
//   Fixed-window limiters reset on the minute boundary, so a user can fire 5
//   requests at :59 and another 5 at :00 — 10 in two seconds. Sliding window
//   weights recent activity smoothly across a rolling 60-second range, which
//   gives a steadier UX and prevents the thundering-herd burst at boundaries.
//
// Why fail-OPEN on Redis error:
//   This is a content tool, not a security-critical endpoint. If Upstash is
//   unreachable, blocking legitimate users would be worse than allowing a few
//   extra requests. The Anthropic spend limit (configured in console.anthropic.com)
//   is the second line of defense against runaway costs during a Redis outage.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const LIMIT = 5;
const WINDOW = '60 s' as const;

// Speak limiter is more aggressive than transform: TTS chars cost ~10x more
// per call than Claude tokens, and a single user holding the play button on
// loop could blow $5 of quota in minutes. 3/min = ~4,300/day max per IP at
// the cap, which lines up with a $5/mo budget (plus a hard cap in the
// ElevenLabs dashboard as the second line of defense).
const SPEAK_LIMIT = 3;
const SPEAK_WINDOW = '60 s' as const;

// In production, missing env vars should crash the process loudly — same pattern
// as lib/anthropic.ts. In development, we warn once and export a no-op limiter
// so UI/CSS work isn't blocked on having Upstash credentials. The warning is
// loud enough that you won't forget about it before deploy.
function buildLimiter(prefix: string, limit: number, window: '60 s'): Ratelimit | null {
  const haveCreds =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!haveCreds) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.',
      );
    }
    // Only warn once per process — the second limiter would double the noise.
    if (prefix === 'talinhaga') {
      console.warn(
        '⚠ Upstash env vars not set — rate limiting disabled in development. ' +
          'Add them to .env.local before deploy.',
      );
    }
    return null;
  }

  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  });
}

const ratelimit = buildLimiter('talinhaga', LIMIT, WINDOW);
// Distinct Redis prefix so transform and speak counters don't share a bucket.
const speakRatelimit = buildLimiter('talinhaga:speak', SPEAK_LIMIT, SPEAK_WINDOW);

/**
 * Check the rate-limit bucket for a single identifier (typically a client IP).
 *
 * Always resolves — never rejects. On Redis error or missing credentials,
 * returns success=true with remaining=-1 as a sentinel so the route handler
 * can include the bypass in headers without breaking parsers.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  // No limiter configured (development without Upstash) — fail open.
  if (!ratelimit) {
    return { success: true, limit: LIMIT, remaining: -1, reset: Date.now() + 60_000 };
  }

  try {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error('[ratelimit] Redis unreachable, failing open:', err);
    return { success: true, limit: LIMIT, remaining: -1, reset: Date.now() + 60_000 };
  }
}

/**
 * Same shape as checkRateLimit, but for /api/speak.  Separate Redis prefix
 * (talinhaga:speak) and tighter caps (3/60s vs 5/60s) because TTS calls are
 * an order of magnitude more expensive per request than text transforms.
 */
export async function checkSpeakRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!speakRatelimit) {
    return { success: true, limit: SPEAK_LIMIT, remaining: -1, reset: Date.now() + 60_000 };
  }

  try {
    const result = await speakRatelimit.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error('[ratelimit/speak] Redis unreachable, failing open:', err);
    return { success: true, limit: SPEAK_LIMIT, remaining: -1, reset: Date.now() + 60_000 };
  }
}

export { LIMIT as RATE_LIMIT, WINDOW as RATE_WINDOW, SPEAK_LIMIT as SPEAK_RATE_LIMIT };
