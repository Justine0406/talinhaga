'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder: string;
}

const MAX_LENGTH = 500;
const WARN_THRESHOLD = MAX_LENGTH - 50; // 450 — turns the counter maroon as a soft warning

export function InputArea({ value, onChange, onSubmit, isLoading, placeholder }: InputAreaProps) {
  const trimmedEmpty = value.trim().length === 0;
  const submitDisabled = trimmedEmpty || isLoading;
  const nearLimit = value.length >= WARN_THRESHOLD;

  // Cmd/Ctrl+Enter submits. We preventDefault so the textarea doesn't insert a newline
  // *before* the parent's onSubmit fires — otherwise users would get a stray '\n'
  // submitted as the last character.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitDisabled) {
        e.preventDefault();
        onSubmit();
      }
    },
    [submitDisabled, onSubmit],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Visually-hidden label — screen readers know what the textarea is for, but the visible
          UI relies on the rotating placeholder + page heading for sighted users. */}
      <label htmlFor="talinhaga-input" className="sr-only">
        Itanong sa talinhaga
      </label>

      <div className="relative">
        <Textarea
          id="talinhaga-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={MAX_LENGTH}
          disabled={isLoading}
          rows={4}
          className="min-h-28 resize-none bg-white pr-4 pb-7 focus-visible:border-maroon focus-visible:ring-maroon/30"
        />
        <span
          aria-live="polite"
          className={`pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums ${
            nearLimit ? 'text-maroon' : 'text-neutral-500'
          }`}
        >
          {value.length}/{MAX_LENGTH}
        </span>
      </div>

      {/* animate-pulse on the loading button reads as "thinking" without adding spinner
          visual noise — the button is text-only and the rest of the UI is calm. */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        size="lg"
        className={`h-11 self-start bg-maroon px-6 text-base text-white hover:bg-maroon/90 focus-visible:ring-maroon/40 ${
          isLoading ? 'animate-pulse' : ''
        }`}
      >
        {isLoading ? 'Iniisip pa...' : 'Gawing Talinhaga'}
      </Button>
    </div>
  );
}
