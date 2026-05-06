'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { InputArea } from '@/components/InputArea';
import { ModeSelector } from '@/components/ModeSelector';
import { OutputCard } from '@/components/OutputCard';
import { EXAMPLES } from '@/lib/examples';
import type { Mode } from '@/lib/prompts';

export default function Home() {
  const [mode, setMode] = useState<Mode>('makata');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Initial value is deterministic to avoid SSR/CSR hydration mismatch.
  // After mount, useEffect picks a random one — running Math.random() in the
  // initializer would render different placeholders on server vs client.
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);

  // modeRef lets the post-fetch closure read the *current* mode without going stale.
  // If the user switches mode mid-flight, the response for the old mode is discarded —
  // otherwise we'd render Makata text under a Hugot tab, which is the exact failure
  // mode this app exists to prevent.
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Intentional client-side random pick: doing this in the useState initializer
  // (or during render) would produce a different placeholder on server vs client
  // and trip Next's hydration mismatch warning.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaceholder(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  }, []);

  // Switching mode wipes the current output. Re-rendering Hugot text in Makata serif
  // would be visually confusing — a fresh canvas per mode is the kinder UX.
  const handleModeChange = (next: Mode) => {
    setMode(next);
    if (output) setOutput('');
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const requestedMode = modeRef.current;
    setIsLoading(true);
    setOutput('');

    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed, mode: requestedMode }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error ?? 'May problema. Subukan mo ulit.');
        return;
      }

      // Discard if user switched modes mid-flight — see modeRef comment above.
      if (modeRef.current !== requestedMode) return;
      setOutput(data.output);
    } catch {
      toast.error('May problema sa koneksyon. Subukan mo ulit.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <header className="mb-12 text-center md:mb-16">
        <h1 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
          Talinhaga
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          Gawing malalim ang anumang sabihin mo.
        </p>
      </header>

      <div className="mb-8">
        <ModeSelector value={mode} onValueChange={handleModeChange} />
      </div>

      <div className="mb-8">
        <InputArea
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder={placeholder}
        />
      </div>

      <OutputCard output={output} mode={mode} />

      <footer className="mt-24 text-center text-sm text-neutral-500 md:mt-32">
        Built by{' '}
        {/* TODO: confirm @justineph is the right handle before deploy */}
        <a
          href="https://x.com/justineph"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          @justineph
        </a>{' '}
        in Batangas
      </footer>
    </main>
  );
}
