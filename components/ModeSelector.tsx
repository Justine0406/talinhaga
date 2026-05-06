'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Mode } from '@/lib/prompts';

interface ModeSelectorProps {
  value: Mode;
  onValueChange: (mode: Mode) => void;
}

// Order is fixed: classical → modern → proverbial. Same order as the `Mode` union in lib/prompts.ts.
const MODES: ReadonlyArray<{ value: Mode; name: string; description: string }> = [
  { value: 'makata', name: 'Makata', description: 'Klasiko, malalim, parang Florante at Laura' },
  { value: 'hugot', name: 'Hugot', description: 'Modern, hugot, parang spoken word' },
  { value: 'salawikain', name: 'Salawikain', description: 'Maikli, matalinghaga, parang lola wisdom' },
];

export function ModeSelector({ value, onValueChange }: ModeSelectorProps) {
  return (
    <Tabs
      value={value}
      // Base UI's onValueChange is (value, eventDetails) — we ignore the second arg.
      // Cast is safe because every TabsTrigger below has value typed as Mode.
      onValueChange={(v) => onValueChange(v as Mode)}
    >
      <TabsList
        variant="line"
        aria-label="Pumili ng mode"
        className="w-full gap-0 border-b border-neutral-200"
      >
        {MODES.map((m) => (
          <TabsTrigger
            key={m.value}
            value={m.value}
            // Override default `h-8 whitespace-nowrap` so name + description can stack on two lines
            // and the description text wraps gracefully on narrow viewports.
            // Maroon underline + maroon active text make this read like a literary chapter selector
            // rather than a generic settings tab.
            className="h-auto flex-col items-center gap-0.5 px-3 py-3 whitespace-normal text-center data-active:text-maroon data-active:after:bg-maroon focus-visible:ring-maroon/40"
          >
            <span className="text-base font-medium leading-tight">{m.name}</span>
            <span className="text-xs font-normal text-neutral-500 leading-tight">{m.description}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
