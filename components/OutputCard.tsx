'use client';

import { useState } from 'react';
import { Check, Copy, Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useSpeech } from '@/hooks/useSpeech';
import type { Mode } from '@/lib/prompts';

interface OutputCardProps {
  output: string;
  mode: Mode;
}

// Mode-specific typography. font-serif / font-sans now resolve through the
// design tokens in app/globals.css → which point to next/font's Fraunces/Inter
// CSS variables on <html>. Falls back gracefully if the font hasn't loaded yet
// because the token chains include Georgia / system-ui as backups.
const MODE_STYLES: Record<Mode, string> = {
  makata: 'font-serif text-xl md:text-2xl italic leading-snug',
  hugot: 'font-sans text-lg md:text-xl leading-relaxed',
  salawikain: 'font-sans text-lg uppercase tracking-[0.2em] text-center leading-snug',
};

export function OutputCard({ output, mode }: OutputCardProps) {
  const [copied, setCopied] = useState(false);
  // One-time hint: if the device has no Filipino voice, the first play falls back
  // to the browser default (English voice reading Tagalog phonemes — robotic).
  // We tell the user once per session so they understand this is a device limit,
  // not a product bug. Resets on page reload, which is fine for an MVP hint.
  const [voiceHinted, setVoiceHinted] = useState(false);

  // Web Speech is provider-agnostic at this seam: when we later swap to ElevenLabs
  // / Google fil-PH WaveNet via /api/speak, the hook's surface stays identical and
  // this component doesn't change. See plan: hooks/useSpeech.ts.
  const { isPlaying, isSupported, hasFilipinoVoice, toggle } = useSpeech({ text: output, mode });

  // Returning null when there's nothing to show means the parent in Step 4 can render
  // <OutputCard ... /> unconditionally — no `{output && ...}` guard needed at the call site.
  if (!output) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success('Kinopya na');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Hindi nagawa ang pag-copy. Subukan mong i-select at i-copy nang manu-mano.');
    }
  };

  const handleSpeak = () => {
    if (!voiceHinted && !hasFilipinoVoice) {
      toast('Walang Filipino na boses sa device — narinig mo ang default.');
      setVoiceHinted(true);
    }
    toggle();
  };

  const modeClassName = MODE_STYLES[mode];

  return (
    <article
      // Framed manuscript page: parchment-deep fill, hairline sepia border, faintest shadow.
      // rounded-md (smaller radius than before) reads as a paper card, not a chat bubble.
      className="relative animate-in fade-in duration-500 rounded-md border border-aged-rule/40 bg-parchment-deep p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:p-8"
    >
      {/* Decorative open-quote glyph straddling the top border — manuscript flourish.
          Positioned in its own pill of bg-parchment-deep so the glyph sits ON the border
          rather than inside or outside it. aria-hidden because it's pure decoration. */}
      <div
        aria-hidden="true"
        className="absolute -top-3 left-6 bg-parchment-deep px-2 font-serif text-3xl leading-none text-aged-rule"
      >
        “
      </div>

      {/* Toolbar: speak (if supported) + copy. Stacked left-to-right so tab order
          matches visual order. The speak button is conditionally rendered — on the
          rare browser without speechSynthesis, only copy shows. aria-pressed on the
          speak button gives screen readers a clean toggle-state announcement. */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {isSupported && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSpeak}
            aria-label={isPlaying ? 'Itigil ang pagsasalita' : 'Pakinggan ang talinhaga'}
            aria-pressed={isPlaying}
            className="text-aged-rule hover:bg-black/5 focus-visible:ring-maroon/40"
          >
            {isPlaying ? <Square /> : <Volume2 />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          aria-label="Kopyahin ang talinhaga"
          className="text-aged-rule hover:bg-black/5 focus-visible:ring-maroon/40"
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>

      {/* role=status + aria-live so screen readers announce the new output when it appears.
          The icon-flip handles sighted users; the toast + live region handle assistive tech.
          pt-2 nudges the text down so the open-quote glyph and the first line don't collide.
          pr-20 (was pr-10) reserves room for the two-button toolbar above. */}
      <div role="status" aria-live="polite" className="pr-20 pt-2">
        <p className={`${modeClassName} text-sepia-ink`}>{output}</p>
      </div>

      <div className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-aged-rule">
        talinhaga.ph
      </div>
    </article>
  );
}
