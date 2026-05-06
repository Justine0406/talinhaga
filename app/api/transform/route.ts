// POST /api/transform
// Accepts: { input: string, mode: 'makata' | 'hugot' | 'salawikain' }
// Returns 200: { output: string }            — transformed text from Claude
// Returns 400: { error: string (Tagalog) }   — input validation failure
// Returns 429: { error: string (Tagalog) }   — rate limit exceeded
// Returns 500: { error: string (Tagalog) }   — Claude or server error
//
// Rate limit policy: 5 requests per 60 seconds per IP, sliding window,
// implemented via Upstash Redis. Fail-OPEN on Redis error — see
// lib/ratelimit.ts for rationale. Rate-limit check runs BEFORE input
// validation so we don't spend compute on requests we're going to deny.

import { transformText } from '@/lib/anthropic';
import type { Mode } from '@/lib/prompts';
import { checkRateLimit, RATE_LIMIT } from '@/lib/ratelimit';

const VALID_MODES: readonly Mode[] = ['makata', 'hugot', 'salawikain'];

// Type guard so `mode` narrows to `Mode` after the check, no `as` cast needed.
function isValidMode(value: unknown): value is Mode {
  return (
    typeof value === 'string' &&
    (VALID_MODES as readonly string[]).includes(value)
  );
}

// `x-forwarded-for` is a comma-separated chain (client, proxy1, proxy2, ...).
// The first entry is the real client; everything after is the proxy hop chain.
// Falls back to `x-real-ip` (set by some proxies), then `'anonymous'` so local
// curls without proxy headers still bucket together for the rate limiter.
function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'anonymous';
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(ip);

  if (!rate.success) {
    return Response.json(
      {
        error:
          'Sandali lang — sumosobra ka sa pag-request. Subukan mo ulit sa loob ng isang minuto.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // Headers we'll attach to every successful response so clients can self-pace.
  const successHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT),
    'X-RateLimit-Remaining': String(rate.remaining),
    'X-RateLimit-Reset': String(rate.reset),
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'Hindi valid ang request.' },
      { status: 400, headers: successHeaders },
    );
  }

  const { input, mode } = (body ?? {}) as { input?: unknown; mode?: unknown };

  if (!isValidMode(mode)) {
    return Response.json(
      { error: 'Hindi valid ang mode.' },
      { status: 400, headers: successHeaders },
    );
  }

  if (typeof input !== 'string' || input.trim().length === 0) {
    return Response.json(
      { error: 'Magpasok ka muna ng text.' },
      { status: 400, headers: successHeaders },
    );
  }

  const trimmed = input.trim();
  if (trimmed.length > 500) {
    return Response.json(
      { error: 'Sobrang haba — 500 characters lang ang max.' },
      { status: 400, headers: successHeaders },
    );
  }

  try {
    const output = await transformText(trimmed, mode);
    return Response.json({ output }, { headers: successHeaders });
  } catch (err) {
    // Log full error server-side; return a generic message to the client.
    console.error('[/api/transform] Claude call failed:', err);
    return Response.json(
      { error: 'May problema sa server. Subukan mo ulit.' },
      { status: 500, headers: successHeaders },
    );
  }
}
