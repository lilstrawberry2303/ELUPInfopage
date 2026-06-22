# ELUP Management System

A specialized React application for planning and executing the **Electrical Load Upgrading Programme (ELUP)** across HDB (Housing & Development Board) high-rise blocks in Singapore.

## Overview

The app provides a multi-role dashboard for different stakeholders to track progress, schedule appointments, and manage surveys and cable work status across HDB blocks.

## Tech Stack

- **Framework**: TanStack Start (full-stack React with SSR)
- **Language**: TypeScript
- **Build System**: Vite 7
- **Package Manager**: Bun
- **UI**: Tailwind CSS v4, Radix UI primitives, Shadcn/UI components, Lucide React icons
- **State Management**: React Context + useReducer
- **Routing**: TanStack Router (file-based)
- **Backend/Data**: Firebase / Firestore
- **Deployment**: Cloudflare Workers (via `@cloudflare/vite-plugin` + nitro)

## Project Structure

- `src/routes/` — File-based routing (TanStack Router)
- `src/components/elup/` — Core business logic components (Manager dashboard, Surveyor view, Block chart, etc.)
- `src/components/ui/` — Reusable Shadcn/UI primitives
- `src/lib/elup/` — App-specific logic, types, store, and Firestore facade
- `src/lib/firebase.ts` — Firebase/Firestore/Storage initialization

## Running Locally

```bash
bun run dev   # starts Vite dev server on port 5000
bun run build # production build
```

## Important Notes

- Vite dev server runs on port 5000 with `host: "0.0.0.0"` and `allowedHosts: true` for Replit proxy compatibility
- Firebase config is hardcoded in `src/lib/firebase.ts` (public web config, not a secret)
- The `@lovable.dev/vite-tanstack-config` package manages Vite plugin setup — do not add duplicate plugins manually
- Bun's file watcher can cause EMFILE errors against its own cache; clearing `~/.cache/.bun` resolves this

## User Preferences

- Use Bun as the package manager for all dependency operations
