# SkillOS — Your Personal Learning OS

SkillOS turns a learning goal into an executable system: a structured roadmap, a
plan that tells you exactly what to do today, guided learning sessions, practice,
assessment, projects, and an AI mentor that actually remembers your progress.

Built as a single SvelteKit application with a fully typed tRPC API, PostgreSQL +
Drizzle persistence, Better Auth sessions, and Grok (xAI) behind the mentor.

---

## Table of contents

- [Overview](#overview)
- [Feature tour](#feature-tour)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Tech stack](#tech-stack)
- [Local setup](#local-setup)
- [Database & migrations](#database--migrations)
- [Development](#development)
- [Testing](#testing)
- [Production build](#production-build)
- [Deploying to Render](#deploying-to-render)
- [Grok / xAI setup](#grok--xai-setup)
- [Design system](#design-system)
- [Performance & security](#performance--security)
- [Troubleshooting](#troubleshooting)

---

## Overview

Most learning tools give you a pile of videos and leave the sequencing to you.
SkillOS is built around a different premise: **a learner should never have to
decide what to do next.**

The system holds a curated knowledge catalog (domains → topics → concepts →
practice → project → assessment), instantiates a personal roadmap from a chosen
goal, and then runs a daily loop:

1. **Dashboard** answers *"What should I do today?"* with a concrete, time-boxed plan.
2. **Learning sessions** walk you through concepts with curated resources.
3. **Practice & assessment** verify understanding with graded questions.
4. **Projects** apply the skill in something real.
5. **Revision** schedules what you're about to forget using spaced repetition.
6. **The AI mentor** answers questions grounded in *your* roadmap, level, mistakes
   and preferences — not generic advice.

Everything is persisted per-user in PostgreSQL, so progress survives across devices
and sessions.

---

## Feature tour

### Onboarding
A multi-step flow (name → interest → level → existing skills → daily time →
learning style → career goal → optional deadline) with a progress indicator and
smooth transitions. Completing it generates the first goal and roadmap
automatically. Progress is resumable — reloading mid-flow restores your place.

### Goals
Create and edit goals, mark a primary goal, set target dates, and archive the
rest. Each goal produces one or more roadmaps.

### Roadmap
A hierarchy of **goal → phase → topic → concept → practice → project →
assessment → milestone**, persisted in PostgreSQL and rendered as a vertical
timeline. Every node carries a state — `locked`, `available`, `current`,
`in_progress`, `completed` — derived from prerequisite completion, so the next
action is always unambiguous.

### Today's plan
The daily plan engine composes a realistic session from what's available: the
current topic's next concept, one practice block, a revision block for anything
due, and project time when a milestone is close. The plan respects your
configured daily minutes, and items can be started, completed or skipped
individually.

### Learning sessions
Concept-level pages with curated resources, notes, and a "mark understood"
action that advances topic progress. Session time is tracked and feeds streaks.

### Practice & assessment
Four question kinds — **MCQ**, **true/false**, **short answer**, and **code**.
Attempts are graded server-side, stored, and rolled up into topic mastery. Weak
areas surface on the dashboard and to the mentor.

### Projects
Milestone-based project guidance. Each project is broken into checkpoints you
tick off, with the mentor available for targeted help on the step you're stuck on.

### Revision (spaced repetition)
A scheduler (SM-2 style) tracks per-topic review state and intervals. Due items
appear on the dashboard, in the plan, and in a dedicated revision surface.

### 3D Skill Universe
Your roadmap rendered as an explorable 3D graph with Three.js + Threlte. Nodes
are roadmap items, colored by state; supporting rotate, zoom, pan and selection.
The scene is lazy-loaded, falls back to an equivalent 2D view on low-power
devices or when WebGL is unavailable, and fully respects
`prefers-reduced-motion`.

### AI mentor
A conversational mentor powered by Grok through the Vercel AI SDK, streamed to
the browser. It is grounded in a per-learner context bundle — goal, current
phase, current topic, weak areas, recent mistakes, preferences and memory — so
answers reference your actual roadmap. Structured actions (explain, generate
exercises, quiz, weekly insight, project guidance, roadmap adaptation) are cached
per input to avoid redundant model calls.

### Notes
Searchable notes attached to topics, resources or projects. Autosaved, and
indexed into a `search_documents` table so the command palette can find them.

### Command palette
`Cmd/Ctrl + K` from anywhere. Navigates to any goal, topic, roadmap, project,
note or conversation; searches the curated resource catalog; and exposes direct
actions (start today's plan, open the universe, log a check-in).

### Settings
Preferences (3D mode, reduced motion, reminder hour, intensity, mentor answer
style), usage stats, AI cache clearing, full JSON data export, and activity reset.

---

## Architecture

```
Browser (Svelte 5 runes + TanStack Svelte Query)
        │  tRPC over HTTP  ─────────────────────────────┐
        │  AI stream (SSE) ──────────────────┐           │
        ▼                                    ▼           ▼
SvelteKit (adapter-node)  ──►  /api/trpc  ──►  tRPC routers ──► services ──► Drizzle ──► PostgreSQL
        │                       /api/mentor/stream ──► Vercel AI SDK ──► Grok (xAI)
        │                       /api/auth/[...all] ──► Better Auth
        ▼
SSR pages + persistent app shell
```

**Layering rules**

- `src/routes/**` — pages and HTTP endpoints only. No business logic.
- `src/lib/server/trpc/routers/**` — transport concerns: input validation (Zod),
  authorization, shaping responses. No raw SQL beyond simple scoped queries.
- `src/lib/server/services/**` — business logic: dashboard composition, learner
  context, progress, insights, AI orchestration.
- `src/lib/server/engine/**` — pure, deterministic logic: roadmap instantiation,
  plan generation, grading, spaced repetition. Unit-tested in isolation.
- `src/lib/server/db/**` — schema and client. The only place that touches the DB.
- `src/lib/components/**` — presentational Svelte components.
- `src/lib/styles/**` — design tokens. Components consume CSS variables only.

**Auth & authorization.** Every request carries a Better Auth session resolved in
`hooks.server.ts`. tRPC exposes `publicProcedure` and `protectedProcedure`; the
protected one injects a non-null `user` into context. Every query filters by
`user_id` — there is no code path that reads another learner's rows.

---

## Folder structure

```
SkillOS/
├── drizzle/                      # Generated SQL migrations + journal
│   ├── 0000_init.sql             # 33 tables, 46 indexes, all enums
│   └── meta/
├── scripts/
│   └── check-urls.ts             # Verifies every curated resource URL resolves
├── src/
│   ├── app.css                   # Global styles + component primitives
│   ├── app.d.ts                  # Ambient types (session, locals)
│   ├── app.html                  # Shell: theme bootstrapping, fonts
│   ├── hooks.server.ts           # Session resolution, security headers
│   ├── lib/
│   │   ├── components/           # UI components (nav, cards, states, ...)
│   │   ├── server/
│   │   │   ├── ai/               # xAI client, gateway (rate limit + cache), prompts
│   │   │   ├── catalog/          # Curated knowledge catalog (topics, projects, resources, tracks)
│   │   │   ├── db/               # Drizzle client + schema modules
│   │   │   ├── engine/           # Pure logic: roadmap, planner, grader, srs
│   │   │   ├── services/         # access, dashboard, progress, insights, learner-context, ai-planner
│   │   │   ├── trpc/             # init, router, routers/*
│   │   │   ├── auth.ts           # Better Auth configuration
│   │   │   ├── env.ts            # Validated environment
│   │   │   ├── errors.ts         # Typed application errors
│   │   │   └── logger.ts         # Structured logging
│   │   ├── styles/tokens.css     # Design tokens (color, space, type, motion)
│   │   ├── trpc/client.ts        # Typed tRPC client
│   │   └── utils.ts              # Shared helpers (dates, formatting, clamp)
│   └── routes/
│       ├── api/auth/[...all]/    # Better Auth handler
│       ├── api/mentor/stream/    # Streaming mentor endpoint
│       ├── api/trpc/[...trpc]/   # tRPC HTTP handler
│       ├── app/                  # Authenticated application
│       │   ├── (dashboard, today, check-in, onboarding)
│       │   ├── goals/  roadmap/  learn/  resources/
│       │   ├── projects/  revision/  assessments/
│       │   ├── universe/  mentor/  notes/  settings/
│       │   └── +layout.svelte    # Persistent left nav + mobile nav
│       └── +page.svelte          # Public landing page
├── tests/                        # Vitest unit + Playwright e2e
├── biome.json                    # Lint + format
├── drizzle.config.ts
├── playwright.config.ts
├── render.yaml                   # Render blueprint
├── svelte.config.js
└── vite.config.ts
```

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | SvelteKit (Svelte 5 runes) |
| Language | TypeScript (strict) |
| Runtime / package manager | Bun |
| Styling | Tailwind CSS 4 + CSS variables |
| API | tRPC v11 |
| Data fetching | TanStack Svelte Query |
| Validation | Zod |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Better Auth (Drizzle adapter) |
| AI | Vercel AI SDK + Grok (xAI) |
| 3D | Three.js + Threlte |
| Background jobs | Trigger.dev (optional) |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Lint / format | Biome |
| Icons | Lucide Svelte |
| Deployment | Render (Node adapter + Render PostgreSQL) |

---

## Local setup

**Prerequisites:** Bun ≥ 1.1, PostgreSQL ≥ 15 (local, Docker, or a Render instance).

```bash
git clone https://github.com/ngl-ankit/SkillOS.git
cd SkillOS
bun install
cp .env.example .env      # then fill in the values below
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`). |
| `BETTER_AUTH_SECRET` | yes | Session signing secret. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | yes | Public origin of the app, e.g. `http://localhost:5173`. |
| `XAI_API_KEY` | yes | xAI API key. The only external AI credential required. |
| `XAI_MODEL` | no | Grok model id. Defaults to `grok-4-fast`. |
| `PUBLIC_APP_URL` | yes | Public URL used in links and redirects. |
| `TRIGGER_SECRET_KEY` | no | Enables Trigger.dev background jobs. |
| `TRIGGER_PROJECT_REF` | no | Trigger.dev project reference. |
| `LOG_LEVEL` | no | `debug` \| `info` \| `warn` \| `error` (default `info`). |

`XAI_API_KEY`, `DATABASE_URL` and `BETTER_AUTH_SECRET` are read **only** on the
server (`$lib/server/env`). Nothing in the client bundle can reach them.

---

## Database & migrations

The schema covers: users, accounts, verifications, profiles, preferences, goals,
roadmaps, roadmap phases, topics, topic prerequisites, topic progress, resources,
topic resources, saved resources, learning sessions, daily plans, daily plan
items, check-ins, assessments, assessment questions, assessment attempts,
projects, project progress, notes, AI conversations, AI messages, AI memory,
AI cache, notifications, search documents and background jobs.

```bash
bun run db:generate     # generate SQL from schema changes
bun run db:migrate      # apply migrations
bun run db:push         # push schema directly (dev only)
bun run db:studio       # browse data
bun run db:seed         # seed the curated catalog + demo account
```

Migrations are checked in under `drizzle/`. Production deploys apply them with
`bun run db:migrate` as a pre-deploy step, never with `db:push`.

---

## Development

```bash
bun run dev             # dev server on http://localhost:5173
bun run check           # svelte-check (types + a11y)
bun run lint            # Biome lint
bun run format          # Biome format
```

The app runs without an `XAI_API_KEY`: every AI surface degrades to a clear
"mentor unavailable" state instead of failing.

---

## Testing

```bash
bun run test            # Vitest unit tests (engine, utils, validators)
bun run test:e2e        # Playwright end-to-end
bun run test:e2e:ui     # Playwright UI mode
```

Unit tests target the pure engine modules — roadmap instantiation, plan
generation, grading, and spaced repetition — because they encode the rules the
whole product depends on. E2E tests cover the critical journeys: landing page,
onboarding completion, dashboard render, plan start/complete, note creation,
command palette, and the auth guard.

---

## Production build

```bash
bun run build           # → build/ (adapter-node)
bun run preview         # run the built server locally
node build/index.js     # or run it directly
```

The Node adapter emits `build/index.js`, which reads `PORT` and `HOST` from the
environment. Static assets are served by the app itself, so a single Render web
service is sufficient.

---

## Deploying to Render

`render.yaml` defines the whole stack as a blueprint.

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, select the repo. Render reads `render.yaml`.
3. Provide the environment variables marked `sync: false`:
   `BETTER_AUTH_SECRET`, `XAI_API_KEY`, and optionally `TRIGGER_SECRET_KEY`.
   `DATABASE_URL` is wired automatically from the managed database.
4. Deploy. The build runs `bun install && bun run build`; migrations run as a
   pre-deploy command (`bun run db:migrate`).

**Service shape**

| Setting | Value |
| --- | --- |
| Environment | Node |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Pre-deploy command | `bun run db:migrate` |
| Start command | `node build/index.js` |
| Health check path | `/api/health` |
| Database | Render PostgreSQL (blueprint-managed) |

After the first deploy, set `BETTER_AUTH_URL` and `PUBLIC_APP_URL` to the
service's public URL so auth callbacks resolve correctly.

---

## Grok / xAI setup

1. Create an API key at [console.x.ai](https://console.x.ai).
2. Set `XAI_API_KEY` (server-side only) and optionally `XAI_MODEL`.
3. Verify with `bun run dev`, open **AI Mentor**, and send a message.

The AI layer is deliberately thin and cacheable:

- `src/lib/server/ai/client.ts` — constructs the xAI provider, exposes
  `aiAvailable()` and `modelId()`.
- `src/lib/server/ai/gateway.ts` — per-user rate-limit buckets and a
  content-addressed cache table, so repeated prompts cost nothing.
- `src/lib/server/ai/prompts.ts` — system prompts and the JSON contracts for
  structured tasks.
- `src/lib/server/services/learner-context.ts` — assembles the grounding bundle.

---

## Design system

Dark-first, premium, futuristic — with a fully supported light mode.

- **Base:** deep near-black (`--surface-0`), with multiple raised surface levels.
- **Depth:** subtle 1px borders plus low-opacity shadows instead of heavy glows.
- **Accent:** one controlled accent hue, used for state and emphasis only.
- **Type scale:** Display, H1–H3, Body, Caption — consistent line heights.
- **Motion:** fast, short, subtle. Every transition is disabled under
  `prefers-reduced-motion: reduce`.
- **Navigation:** persistent left rail on desktop; a dedicated bottom tab bar on
  mobile. No horizontal scroll at any width.

Tokens live in `src/lib/styles/tokens.css`; components never hard-code colors.
Breakpoints are verified at 320, 375, 390, 430, 768, 1024, 1280, 1440 and
1920 px.

---

## Performance & security

**Performance**

- SvelteKit SSR for first paint; hydration is progressive.
- TanStack Query caching with conservative stale times; mutations invalidate
  precisely.
- Indexed PostgreSQL access paths (46 indexes) and single-round-trip aggregates.
- Route-level code splitting; the 3D universe bundle is lazy-loaded and never
  shipped to devices that won't render it.
- Search is debounced, and AI responses are cached and rate-limited per user.

**Security**

- All data access is session-authenticated and scoped by `user_id`.
- Every mutation validates input with Zod at the transport boundary.
- Secrets live only in `$lib/server`; the client bundle contains no keys.
- Security headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`) are set in `hooks.server.ts`.
- SQL is parameterized throughout via Drizzle — no string-built queries.

---

## Troubleshooting

**`DATABASE_URL is not set`** — env validation fails fast at boot. Copy
`.env.example` to `.env` and fill it in.

**Auth redirects loop in production** — `BETTER_AUTH_URL` and `PUBLIC_APP_URL`
must match the exact public origin (including scheme, no trailing slash).

**Migrations fail on deploy** — the pre-deploy command needs the database to be
reachable from the build environment. Confirm `DATABASE_URL` is wired from the
blueprint (`fromDatabase`).

**Mentor replies "AI is unavailable"** — `XAI_API_KEY` is missing or invalid.
The rest of the app is unaffected by design.

**3D universe shows the 2D fallback** — expected on devices without WebGL, in
`reduced motion` mode, or when `universeMode` is set to `2d` in Settings.

**Bun install fails on Render** — `.bun-version` pins the toolchain; make sure
the runtime is `node` with `bun` available, and keep `bun.lock` committed.

**Resource links 404** — run `bun run check:urls` to re-verify the curated
catalog.

---

## License

Private / all rights reserved unless stated otherwise in the repository.
