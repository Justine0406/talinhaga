# Talinhaga

A Filipino AI tool that turns any sentence into deep, poetic Tagalog — three modes: **Makata** (classical, Florante-at-Laura), **Hugot** (modern spoken-word), **Salawikain** (proverbial). Paste your text, pick a mode, copy the output, screenshot it.

Built by [@justineph](https://x.com/justineph) in Batangas. Content-first, no accounts, no analytics.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (CSS-first theme tokens in `app/globals.css`)
- shadcn/ui (Button, Textarea, Tabs, Sonner)
- Anthropic Claude API (`claude-sonnet-4-5-20250929`) via `@anthropic-ai/sdk`
- `next/font/google` for Fraunces + Inter

## Local development

1. **Clone** and `cd` into `ewanqsau/`.
2. **Copy the env example** and fill in your secrets:
   ```powershell
   Copy-Item .env.local.example .env.local
   # then edit .env.local with your real values (see Environment variables below)
   ```
3. **Install** dependencies:
   ```powershell
   npm install
   ```
4. **Run** the dev server:
   ```powershell
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

If `npm install` or `npm run dev` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, it's an SSL-inspection / corporate-AV issue — set `$env:NODE_OPTIONS = "--use-system-ca"` and retry.

### Environment variables

All three are required in production. In development the Upstash vars are optional — if missing, rate limiting is disabled and a warning is logged at startup.

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys |
| `UPSTASH_REDIS_REST_URL` | [upstash.com](https://upstash.com) → create a Redis database → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | Same dashboard, same tab as the URL |

## Project layout

```
ewanqsau/
├── app/
│   ├── page.tsx              ← single-page UI (state lives here)
│   ├── layout.tsx            ← fonts, metadata, <Toaster />
│   ├── globals.css           ← Tailwind v4 + design tokens
│   └── api/transform/route.ts ← server-side Claude call
├── lib/
│   ├── prompts.ts            ← three system prompts (THE product)
│   ├── examples.ts           ← rotating placeholder phrases
│   └── anthropic.ts          ← Claude client wrapper
├── components/
│   ├── ModeSelector.tsx
│   ├── InputArea.tsx
│   ├── OutputCard.tsx
│   └── ui/                   ← shadcn primitives
└── .env.local                ← ANTHROPIC_API_KEY (git-ignored)
```

## Deployment (Railway)

> Placeholder — write the real version after Step 6 of the build.

- Set `ANTHROPIC_API_KEY` in the Railway service variables.
- Point `talinhaga.ph` at the Railway domain via DNS CNAME.
- `npm run build` should pass cleanly before pushing.

## Design principles (non-negotiable)

- One purpose, one screen. No accounts, no history, no settings.
- Mobile-first; the screenshot is the product.
- Friction = death. No login, no email gate, no share-to-unlock.
- The watermark `talinhaga.ph` appears on every output card.
