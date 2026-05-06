'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

  const modeClassName = MODE_STYLES[mode];

  return (
    <article
      className="relative animate-in fade-in duration-500 rounded-2xl bg-cream-soft p-6 md:p-8"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label="Kopyahin ang talinhaga"
        className="absolute top-3 right-3 text-neutral-600 hover:bg-black/5 focus-visible:ring-maroon/40"
      >
        {copied ? <Check /> : <Copy />}
      </Button>

      {/* role=status + aria-live so screen readers announce the new output when it appears.
          The icon-flip handles sighted users; the toast + live region handle assistive tech. */}
      <div role="status" aria-live="polite" className="pr-10">
        <p className={`${modeClassName} text-ink`}>{output}</p>
      </div>

      <div className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-neutral-500/70">
        talinhaga.ph
      </div>
    </article>
  );
}
