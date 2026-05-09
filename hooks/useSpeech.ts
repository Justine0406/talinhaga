'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Mode } from '@/lib/prompts';

interface UseSpeechArgs {
  text: string;
  mode: Mode;
}

interface UseSpeechReturn {
  isPlaying: boolean;
  isSupported: boolean;
  hasFilipinoVoice: boolean;
  toggle: () => void;
  stop: () => void;
}

// Voice selection priority for the Web Speech fallback path. Same chain as v1
// of this hook — fil-PH first, then tl-PH, then any fil/tl variant, then
// English-Philippine prosody, then null (default voice).
function pickFilipinoVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.lang === 'fil-PH') ??
    voices.find((v) => v.lang === 'tl-PH') ??
    voices.find((v) => v.lang.startsWith('fil')) ??
    voices.find((v) => v.lang.startsWith('tl')) ??
    voices.find((v) => v.lang.startsWith('en-PH')) ??
    null
  );
}

// Mode-aware pacing for the Web Speech fallback only. ElevenLabs pacing is
// driven by voice_settings on the server (see lib/elevenlabs.ts) and the text
// itself — we don't post-process cloud audio. These values are unchanged from
// v1 of the hook.
const FALLBACK_PACING: Record<Mode, { rate: number; pitch: number }> = {
  makata: { rate: 0.85, pitch: 0.95 },
  hugot: { rate: 0.95, pitch: 1.0 },
  salawikain: { rate: 0.8, pitch: 0.95 },
};

/**
 * Voice playback hook with cloud-first, Web-Speech-fallback strategy.
 *
 * Primary path: POST /api/speak → MP3 blob → new Audio(url).play()
 * Fallback path: window.speechSynthesis (browser-native, free, lower quality)
 *
 * The hook hides this behind a provider-agnostic surface. OutputCard.tsx
 * doesn't know which path executed — that's the test of the abstraction.
 *
 * Caller responsibilities:
 * - Render the play/stop button only when `isSupported`.
 * - Call `toggle()` from a user gesture (onClick). iOS Safari blocks both
 *   audio.play() and speechSynthesis.speak() outside user gestures.
 *
 * On first cloud failure (429, 401, 502, network), the hook fires a one-time
 * toast and silently switches to Web Speech for that call. Subsequent calls
 * still try cloud first — silent recovery when cloud comes back.
 */
export function useSpeech({ text, mode }: UseSpeechArgs): UseSpeechReturn {
  // Always supported in a browser context — either cloud (assumed reachable)
  // or Web Speech can serve audio. SSR-safe: defaults false, flipped on mount.
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // hasFilipinoVoice stays true from cloud's POV: ElevenLabs handles Tagalog
  // via multilingual training. Kept in the surface so the contract matches v1
  // of the hook — OutputCard's existing voiceHinted toast becomes inert here,
  // which is correct: the fallback-to-default messaging now lives in this hook
  // (more accurate, since cloud failure is a server condition, not a device one).
  const [hasFilipinoVoice] = useState(true);

  // Web Speech voice is held for the fallback path. Voices populate async on
  // Chrome/Edge; the voiceschanged listener picks the best available voice.
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Active playback handles. We track both paths because either could be live.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // One-time fallback toast guard. Once we've told the user we fell back,
  // don't keep nagging on subsequent fallbacks within the same session.
  const fellBackRef = useRef(false);

  // Detect Web Speech support + select voice for the fallback path. Cloud
  // support is assumed (we trust the route is deployed). We still set
  // isSupported = true here because, in the worst case, fallback gives
  // *some* audio — better than nothing.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(true);

    if (!('speechSynthesis' in window)) return;

    const refreshVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current = pickFilipinoVoice(voices);
    };

    refreshVoice();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoice);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoice);
    };
  }, []);

  // Stop both possible playback paths, free any held blob URL, reset flags.
  // The blob URL needs explicit revocation — without it, every cloud play
  // leaks ~50KB of audio data into the browser's URL store until tab close.
  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Cleanup when text or mode changes mid-flight, or when the hook unmounts.
  // The cleanup of the previous effect runs before the new effect, so swapping
  // output A → B mid-playback cancels A cleanly on both paths.
  useEffect(() => {
    return () => stop();
  }, [text, mode, stop]);

  // Web Speech fallback. Pure-client, no network, robotic-but-functional.
  // Returns synchronously; isPlaying is reset on utterance end/error.
  const playWebSpeechFallback = useCallback((spokenText: string, spokenMode: Mode) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      // No fallback available either — give up gracefully.
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(spokenText);
    const pacing = FALLBACK_PACING[spokenMode];
    utter.rate = pacing.rate;
    utter.pitch = pacing.pitch;

    if (voiceRef.current) {
      utter.voice = voiceRef.current;
      utter.lang = voiceRef.current.lang;
    } else {
      utter.lang = 'fil-PH';
    }

    utter.onend = () => setIsPlaying(false);
    utter.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utter);
  }, []);

  const toggle = useCallback(async () => {
    if (!isSupported || !text) return;

    // Second tap during playback is a stop, not a re-fetch.
    if (isPlaying) {
      stop();
      return;
    }

    // Optimistically flip to playing — the button updates immediately, the
    // network fetch is masked by the icon change.
    setIsPlaying(true);

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      });

      if (!res.ok) {
        throw new Error(`speak responded ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        if (blobUrlRef.current === url) blobUrlRef.current = null;
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => {
        // Decode/playback error — also clean up. This is rare for a known-good
        // MP3 from ElevenLabs, but iOS occasionally errors on the first audio
        // element of a session.
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        if (blobUrlRef.current === url) blobUrlRef.current = null;
        if (audioRef.current === audio) audioRef.current = null;
      };

      // play() returns a Promise that rejects if the user gesture chain
      // is broken (rare with our click handler). Catch and fall back.
      await audio.play();
    } catch (err) {
      console.warn('[useSpeech] cloud path failed, falling back to Web Speech:', err);

      // One-time toast per session — don't nag on repeated fallbacks.
      if (!fellBackRef.current) {
        fellBackRef.current = true;
        toast('Bumalik tayo sa default na boses pansamantala.');
      }

      playWebSpeechFallback(text, mode);
    }
  }, [isSupported, isPlaying, text, mode, stop, playWebSpeechFallback]);

  return { isPlaying, isSupported, hasFilipinoVoice, toggle, stop };
}
