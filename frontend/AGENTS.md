# Agent Guide

KickOff 3D — a 3D browser soccer game built with Next.js, React Three Fiber, and Rapier physics.

## 1. Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Bun (package manager)
- Three.js + React Three Fiber (3D rendering)
- Rapier physics (`@dimforge/rapier3d-compat`)
- Framer Motion (UI animations)
- `i18next` + `react-i18next` — `en-US` / `zh-CN` UI
- shadcn/ui, lucide-react
- Zustand (state management)
- `@modelcontextprotocol/sdk` (MCP server)

## 2. Commands

```bash
bun install
bun dev
bun run lint
bun run build
bun start
bun run cleanup:demo
```

## 3. Project Structure

```
src/
  app/
    page.tsx                    — main game entry (splash → playing → post-match)
    layout.tsx                  — root layout with i18n provider
    api/
      mcp/route.ts             — MCP Streamable HTTP server
  components/
    screens/                    — game screens (Splash, PostMatch)
    game/                       — GameCanvas (Three.js + Rapier)
    i18n/                       — locale switcher and sync
    ui/                         — shadcn/ui primitives
  lib/
    config/                     — configuration utilities
    game/                       — game constants and logic
    i18n/                       — locale utilities
    mcp/                        — MCP server and tools
    services/                   — service layer
  stores/                       — Zustand stores
  i18n/                         — i18next config and locale files
  utils/                        — Tailwind class helpers
```

## 4. Coding Requirements

### 4.1 Component Encapsulation

- `page.tsx` must remain a thin entry point
- One component per file, PascalCase named exports
- Group by feature under `src/components/<feature>/`

### 4.2 File Size Limits

| File type | Soft limit | Hard limit |
|---|---|---|
| Page component | 30 lines | 50 lines |
| Feature component | 150 lines | 250 lines |
| API route handler | 60 lines | 100 lines |

### 4.3 Imports

- Use `@/` path aliases everywhere
- Import UI primitives from `@/components/ui/`

## 5. Project Rules

- Prefer Bun for all install and script commands
- Keep the codebase lean and framework-native
- Before shipping, run `bun run lint` and `bun run build`

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
