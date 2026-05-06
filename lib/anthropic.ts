import Anthropic from '@anthropic-ai/sdk';
import { PROMPTS, type Mode } from './prompts';

// Fail fast at module load: a missing key is a deploy-config bug, not a
// runtime condition. Crashing startup is louder than silently 500-ing.
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env.local.');
}

// Singleton: the SDK keeps an HTTPS agent / connection pool internally,
// so reusing one instance per process avoids per-request setup overhead.
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function transformText(input: string, mode: Mode): Promise<string> {
  // Prompt goes in `system` (model instructions), not as a user message.
  // Anthropic uses the system slot for steering; folding instructions into
  // the user turn weakens that steering.
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system: PROMPTS[mode],
    messages: [{ role: 'user', content: input }],
  });

  // `content` is a discriminated union (TextBlock | ToolUseBlock | ...).
  // Narrow on the tag instead of casting so a future shape change fails loud.
  const first = response.content[0];
  if (!first || first.type !== 'text') {
    throw new Error(
      `Unexpected response shape: first block was ${first?.type ?? 'undefined'}`,
    );
  }

  return first.text.trim();
}
