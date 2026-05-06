# Talinhaga — Project Context

## What this is
Talinhaga is a single-page web tool that transforms basic Tagalog or English text into deep, poetic Tagalog. Users paste a sentence, pick a mode, get back a transformed version they can copy and screenshot.

The name means "metaphor" or "figure of speech" in Filipino.

## Why it exists
This is a content-first project. The goal is not revenue — it's audience. Specifically, it's designed to produce viral TikTok moments where Filipino users screenshot the input/output of their own personal text (an ex's message, a boss's email, song lyrics) transformed into deep Tagalog.

The user's *own input* is what makes the output shareable. Generic AI poems don't go viral. "Yung text ng ex ko, ginawang Florante at Laura" goes viral.

## Who's building this
Justine — 18-year-old Filipino solo creator-builder based in Batangas. Self-taught, learning to code primarily by reading code Claude generates. Treats Claude Code as a pair programmer / mentor, not a code dispenser.

## Audience
Filipino users on TikTok, Instagram, and Twitter — primarily 16-30 years old, primarily Tagalog/Taglish speakers, primarily on mobile.

## Three modes (the product surface)
1. **Makata** — Classical, lyrical, archaic Tagalog. Florante at Laura energy. For users who want their text to feel like a Balagtas verse.
2. **Hugot** — Modern spoken-word style. Bob Ong / Juan Miguel Severo energy. For heartbreak posts and emotional captions.
3. **Salawikain** — Proverb style. Short, weighty, memorable. Lola wisdom.

All three modes share one job: transform user input. They are NOT separate generators. The user always brings their own text.

## Non-negotiable design principles
- **Single purpose.** One input, one output, one button per session. No accounts, no history, no settings.
- **Mobile-first.** Most usage is on phones, often while recording a video.
- **Copy-and-screenshot ready.** The output card is the centerpiece. Typography matters more than chrome.
- **Watermark visible but classy.** "talinhaga.ph" appears on every output so screenshots distribute the brand for free.
- **Friction = death.** No login walls, no email gates, no "share this to unlock". The whole thing is free and instant.

## Out of scope for v1 (do not build these)
- Authentication / accounts
- Database / persistence
- History or "saved" outputs
- Social sharing buttons (screenshots are intentional)
- Analytics
- Image export
- Multi-language UI (Tagalog + English UI labels only, no localization framework)

## Tech stack
- **Framework:** Next.js 15 with App Router, TypeScript
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui (Button, Textarea, Tabs, Sonner)
- **AI:** Anthropic Claude API via `@anthropic-ai/sdk`
- **Model:** `claude-sonnet-4-5-20250929`
- **Deployment:** Railway with custom domain
- **No database, no auth library, no state management library.** useState only.

## Folder structure (target)
```
talinhaga/
├── app/
│   ├── page.tsx              ← single page UI
│   ├── layout.tsx            ← metadata, fonts
│   ├── globals.css           ← tailwind base
│   └── api/transform/route.ts ← server-side Claude API call
├── lib/
│   ├── prompts.ts            ← the 3 system prompts (THE product)
│   ├── examples.ts           ← rotating placeholder inputs
│   └── anthropic.ts          ← Claude client wrapper
├── components/
│   ├── ModeSelector.tsx
│   ├── InputArea.tsx
│   └── OutputCard.tsx
└── .env.local                ← ANTHROPIC_API_KEY
```

## Design language
- **Background:** Cream/off-white (`#FAF7F2`)
- **Text:** Deep ink (`#1A1A1A`)
- **Accent:** Deep maroon (`#6B1F2E`) — buttons, active tab, focus states
- **Fonts:** Fraunces (serif, for headers and Makata-mode output) + Inter (sans, for UI and other modes), loaded from Google Fonts
- **Tone:** Minimalist, content-first, generous whitespace, the output card is the hero

## Critical architectural decisions (and why)
- **Prompts live in `lib/prompts.ts`, separate from API route.** The prompts ARE the product. Iterating on them shouldn't require touching API or UI code.
- **API key stays server-side.** All Claude calls go through `app/api/transform/route.ts`. The browser never sees the key.
- **No client-side AI calls.** Even though it'd be slightly faster, it would leak the API key.
- **Examples are data, not hardcoded JSX.** Lives in `lib/examples.ts` so adding/editing requires no UI knowledge.

## How Claude Code should work with Justine on this project
- Justine is learning to code. Explain decisions, don't just write code silently.
- Push back when his requests conflict with the principles above.
- Ask before making structural changes (adding deps, changing folder structure, introducing new patterns).
- When writing code, add brief comments explaining *why* — not just *what*.
- Default to the simplest solution that works. Avoid over-engineering.

## Current build status
[Update this as you go]
- [x] Step 1: Project scaffolding
- [x] Step 2: API route + Anthropic wrapper
- [x] Step 3: Prompts + examples files
- [x] Step 4: UI components
- [x] Step 5: Page assembly + styling polish
- [ ] Manual testing across 30+ inputs
- [ ] Deploy to Railway

**Next: deployment.** Manual QA pass at 375px / 768px / 1280px viewports, then push to Railway with `ANTHROPIC_API_KEY` env var set and `talinhaga.ph` DNS configured.

## Production hardening
- [x] Rate limiting (5 req/min/IP, sliding window, Upstash Redis) — `lib/ratelimit.ts`, `app/api/transform/route.ts`
- [~] Abuse smoke test — initial pass surfaced defamation + prompt-injection issues; patched SHARED_RULES on 2026-05-06; refined name-handling rule on 2026-05-06 to distinguish public figures (refuse) from common first names (generalize); needs re-test before deploy
- [ ] Caching identical inputs (Redis keyed on `mode + sha256(input)`, 24h TTL — saves Anthropic calls on repeat queries)