# AGENTS.md

## Repository Layout

- `frontend/` — Turborepo monorepo (all application code lives here)
  - `apps/web/` — Vite + React 19 SPA (the runnable app)
  - `packages/ui/` — `@workspace/ui` shared shadcn/ui component library
- `docs/devlogs/` — development logs (tracked in git despite root `docs/*` gitignore)

## Commands

All commands run from `frontend/`. Package manager is **bun** (not npm/pnpm).

```bash
bun install          # install deps
bun run dev          # turbo dev (persistent, uncached)
bun run build        # turbo build (tsc then vite build)
bun run lint         # turbo lint (eslint)
bun run format       # turbo format (prettier --write)
bun run typecheck    # turbo typecheck (tsc --noEmit)
```

To run a single package's task directly:
```bash
bun run dev --filter=web
bun run lint --filter=@workspace/ui
```

## Adding shadcn Components

Components are added to the shared `@workspace/ui` package via the web app context:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

This writes to `packages/ui/src/components/`. Import in app code as:
```tsx
import { Button } from "@workspace/ui/components/button"
```

**shadcn style is `base-lyra` with phosphor icons.** Do not use lucide-react.

## Architecture

- **Path aliases**: `@/*` → `apps/web/src/*`; `@workspace/ui/*` → `packages/ui/src/*`
- **CSS**: Tailwind v4 (via `@tailwindcss/vite` plugin), globals at `packages/ui/src/styles/globals.css`
- **UI dependencies**: base-ui, dnd-kit, tanstack/react-table, recharts, vaul, sonner, zod
- **No test framework is configured** — no test scripts or test dependencies exist yet

## Git Commit Conventions

- Commits in this repo use author identity `beeforge-dev-ai <jandetech@outlook.com>` (set via conditional `~/.gitconfig` include)
- **Conventional Commits enforced by a commit-msg hook**: format `<type>(<scope>): <description>`
- Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Non-conforming messages are rejected

## Code Style

- No semicolons, single quotes (enforced by Prettier)
- Trailing comma: `es5`, print width: 80, LF line endings
- Tailwind class sorting handled by `prettier-plugin-tailwindcss`
