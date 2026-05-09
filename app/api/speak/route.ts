// POST /api/speak
//
// Accepts: { text: string, mode: 'makata' | 'hugot' | 'salawikain' }
// Returns 200: audio/mpeg bytes (raw MP3, ready for new Audio(blobUrl))
// Returns 400: { error: string (Tagalog) }   — input validation failure
// Returns 429: { error: string (Tagalog) }   — our rate limiter (3/60s)
// Returns 502: { error: string (Tagalog) }   — ElevenLabs unavailable; client
//                                              should fall back to Web Speech
// Returns 500: { error: string (Tagalog) }   — server bug (Redis, etc.)
//
// Cache: same text+mode+voice+model → same audio. Keyed by SHA-256, stored
// base64-encoded in Upstash Redis with 30-day TTL. Cache hits skip the
// ElevenLabs call entirely (and its cost).
//
// Rate limit: 3/60s per IP, separate from /api/transform's 5/60s. TTS chars
// cost ~10x more than Claude tokens, hence the tighter cap.

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

import {
  ElevenLabsError,
  MODEL_ID,
  synthesize,
  VOICE_ID,
} from '@/lib/elevenlabs';
import type { Mode } from '@/lib/prompts';
import { checkSpeakRateLimit, SPEAK_RATE_LIMIT } from '@/lib/ratelimit';

const VALID_MODES: readonly Mode[] = ['makata', 'hugot', 'salawikain'];
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAX_TEXT_LENGTH = 500;                  // matches /api/transform's cap

function isValidMode(value: unknown): value is Mode {
  return (
    typeof value === 'string' &&
    (VALID_MODES as readonly string[]).includes(value)
  );
}

// Same IP-extraction as /api/transform — first hop in x-forwarded-for, then
// x-real-ip, then 'anonymous' so local curls still bucket together. Keeps both
// limiters' identifier semantics aligned.
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

// Lazy Redis init: returning null on missing creds lets the route work in
// dev without Upstash (no cache, every call hits ElevenLabs — which is the
// dev tradeoff the project already accepts for the rate limiter).
function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return Redis.fromEnv();
}

// Cache key includes voice + model so swapping ELEVENLABS_VOICE_ID or
// ELEVENLABS_MODEL invalidates cache cleanly — without that, you'd serve
// the old voice's audio for 30 days under the new voice's identity.
function cacheKey(text: string, mode: Mode): string {
  const hash = createHash('sha256')
    .update(`${text}|${mode}|${VOICE_ID}|${MODEL_ID}`)
    .digest('hex');
  return `talinhaga:audio:${hash}`;
}

// Wrap audio bytes in a Response with the right Content-Type.
//
// Why the explicit ArrayBuffer copy: TS strict's lib-dom types distinguish
// ArrayBuffer from SharedArrayBuffer, and Buffer.prototype.buffer is typed
// ArrayBufferLike (the union). Even though Node never hands us a
// SharedArrayBuffer here, the BodyInit / BlobPart types refuse the union.
// Copying into a fresh ArrayBuffer satisfies the checker without a cast.
// The copy is ~50KB per first-play call — negligible vs the ElevenLabs
// roundtrip we just paid for, and zero on cache hits (where the buffer
// already exists in memory anyway).
function audioResponse(buffer: Buffer, fromCache: boolean): Response {
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      // Browsers may cache for a day per-user; CDN/edge stays opaque (private).
      'Cache-Control': 'private, max-age=86400',
      'X-Cache': fromCache ? 'HIT' : 'MISS',
      'X-RateLimit-Limit': String(SPEAK_RATE_LIMIT),
    },
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = await checkSpeakRateLimit(ip);

  if (!rate.success) {
    return Response.json(
      {
        error:
          'Sandali lang sa pakikinig — sumosobra ka. Subukan mo ulit sa loob ng isang minuto.',
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Hindi valid ang request.' }, { status: 400 });
  }

  const { text, mode } = (body ?? {}) as { text?: unknown; mode?: unknown };

  if (!isValidMode(mode)) {
    return Response.json({ error: 'Hindi valid ang mode.' }, { status: 400 });
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'Walang teksto.' }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: 'Sobrang haba.' }, { status: 400 });
  }

  const key = cacheKey(trimmed, mode);
  const redis = getRedis();

  // Cache lookup — best-effort. Redis errors fall through to ElevenLabs.
  if (redis) {
    try {
      const cached = await redis.get<string>(key);
      if (cached) {
        return audioResponse(Buffer.from(cached, 'base64'), true);
      }
    } catch (err) {
      console.error('[/api/speak] redis cache lookup failed:', err);
    }
  }

  // Cache miss → call ElevenLabs.
  let audio: Buffer;
  try {
    audio = await synthesize(trimmed);
  } catch (err) {
    if (err instanceof ElevenLabsError) {
      // Log full status + reason server-side; return 502 to the client so
      // useSpeech.ts knows to fall back to Web Speech. We don't differentiate
      // 401/429/5xx for the client — all "cloud unavailable" looks the same
      // from the user's POV ("we fell back to default voice").
      console.error(`[/api/speak] elevenlabs ${err.status}:`, err.reason);
      return Response.json(
        { error: 'Hindi available ang voice ngayon. Bumalik sa default.' },
        { status: 502 },
      );
    }
    console.error('[/api/speak] unexpected error:', err);
    return Response.json({ error: 'May problema sa server.' }, { status: 500 });
  }

  // Cache write is fire-and-forget — a Redis write failure should never block
  // the audio response. If it fails, we'll just regenerate next time.
  if (redis) {
    redis
      .set(key, audio.toString('base64'), { ex: CACHE_TTL_SECONDS })
      .catch((err) => console.error('[/api/speak] redis cache write failed:', err));
  }

  return audioResponse(audio, false);
}
