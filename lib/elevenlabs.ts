// lib/elevenlabs.ts
//
// ElevenLabs text-to-speech client. We use raw fetch against the REST API
// rather than the `elevenlabs` npm package because:
//   (a) we use a single endpoint (POST /v1/text-to-speech/{voice_id}),
//   (b) the SDK adds ~200KB to node_modules for things we don't use,
//   (c) keeping the dep tree lean matches the project's Upstash-via-REST style.
//
// Caller (app/api/speak/route.ts) is responsible for caching and rate limiting;
// this lib only handles the vendor call. ElevenLabsError carries the upstream
// status code so the route can decide how to respond — 401 is config bug,
// 429/5xx is transient and the client falls back to Web Speech.

const API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';

// Fail fast on missing config — same pattern as lib/anthropic.ts. A missing
// key is a deploy-config bug, not a runtime condition. Crashing module load
// is louder than silently 500-ing every request.
if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not set. Add it to .env.local.');
}
if (!process.env.ELEVENLABS_VOICE_ID) {
  throw new Error('ELEVENLABS_VOICE_ID is not set. Add it to .env.local.');
}

const API_KEY: string = process.env.ELEVENLABS_API_KEY;
export const VOICE_ID: string = process.env.ELEVENLABS_VOICE_ID;
export const MODEL_ID: string = process.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL;

export class ElevenLabsError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(`ElevenLabs API error ${status}: ${reason}`);
    this.name = 'ElevenLabsError';
  }
}

/**
 * Synthesize speech from text. Returns the raw MP3 audio bytes.
 *
 * voice_settings reference (https://elevenlabs.io/docs):
 * - stability: 0.0 (most expressive) → 1.0 (most consistent). 0.5 is a balanced
 *   default — too low and the voice wanders; too high and it goes monotone.
 * - similarity_boost: how strongly to match the source voice's character.
 * - style: 0 = neutral. Higher values exaggerate emotional prosody but add
 *   latency and can over-act for poetic content; we keep it at 0.
 * - use_speaker_boost: bumps perceived volume/clarity slightly. Cheap win.
 */
export async function synthesize(text: string): Promise<Buffer> {
  const url = `${API_BASE}/text-to-speech/${VOICE_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  // Quota observability — log to deploy logs so you can grep for usage trends.
  // Not gating: the hard cap lives in your ElevenLabs dashboard (auto-suspend
  // at the cap), this is just so you can see it coming.
  const charsLeft = res.headers.get('character-limit-remaining');
  const charsUsed = res.headers.get('character-count');
  if (charsLeft || charsUsed) {
    console.log(`[elevenlabs] usage: used=${charsUsed ?? '?'} remaining=${charsLeft ?? '?'}`);
  }

  if (!res.ok) {
    // Cap long error bodies — ElevenLabs sometimes returns verbose JSON, and
    // we don't want a multi-KB error string in our logs or response chain.
    let reason = res.statusText;
    try {
      const errBody = await res.text();
      if (errBody) reason = errBody.slice(0, 500);
    } catch {
      // ignore — statusText is enough
    }
    throw new ElevenLabsError(res.status, reason);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
