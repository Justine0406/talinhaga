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
      {/* Dropped variant="line" — the active state is now a filled card, not an underline.
          gap-2 spaces the cards apart so each reads as its own labeled paper tag. */}
      <TabsList
        aria-label="Pumili ng mode"
        className="w-full gap-2 bg-transparent p-0"
      >
        {MODES.map((m) => (
          <TabsTrigger
            key={m.value}
            value={m.value}
            // Card-stock treatment: parchment fill, hairline sepia border, gentle hover lift,
            // parchment-deep when active. flex-1 keeps the three cards equal-width on every
            // viewport. whitespace-normal lets the descriptor wrap on narrow screens instead
            // of overflowing.
            className="h-auto flex-1 flex-col items-center gap-1 rounded border border-aged-rule/30 bg-parchment/40 px-3 py-3 whitespace-normal text-center font-serif transition-colors hover:bg-parchment hover:border-aged-rule/50 data-active:bg-parchment-deep data-active:border-aged-rule data-active:shadow-[0_1px_0_rgba(0,0,0,0.04)] focus-visible:ring-maroon/40"
          >
            <span className="text-base font-medium leading-tight text-sepia-ink">{m.name}</span>
            <span className="text-xs italic font-normal leading-tight text-aged-rule">{m.description}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
