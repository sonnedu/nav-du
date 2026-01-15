# Agent Guide (Nav-Du)

For agentic coding assistants operating in this repository.

## Repo Overview

- **Frontend**: Vite + React 19 + TypeScript (Source: `src/`)
- **Backend/API**: Cloudflare Pages Functions (Source: `functions/api/`)
- **Favicon Proxy**: Cloudflare Worker (Source: `workers/favicon/`)
- **Data**: `nav.yaml` (Static) + KV Storage (Runtime Overrides)
- **Testing**: Playwright E2E only (No Jest/Vitest)

### Key Paths
- `src/data/nav.yaml`: Default configuration.
- `src/lib/navTypes.ts`: Domain models (Strict TS, No Enums).
- `e2e/nav.spec.ts`: Main test suite.
- `functions/api/`: API endpoints (`/api/config`, `/api/login`).
- `workers/favicon/`: Standalone Worker for favicon proxying.

## Commands

**Package Manager**: `npm` (Lockfile: `package-lock.json`)

### Development
- **Frontend Only**: `npm run dev` (Port 5173, Mock API calls or 404s)
- **Full Stack**: `npm run dev:all` (Recommended)
  - Runs Vite + Pages Functions + Worker.
  - Essential for working on Admin/API features.
  - Access at: `http://localhost:8799`

### Verification
- **Build**: `npm run build` (Runs `tsc -b` && `vite build`)
- **Lint**: `npm run lint` (ESLint Flat Config)
- **Typecheck**: `npx tsc -p tsconfig.app.json --noEmit`

### Testing (Playwright)
**Note**: Always run E2E tests before submitting changes.

- **Run All**: `npm run test:e2e`
- **Run Specific File**: `npx playwright test e2e/nav.spec.ts`
- **Run Specific Test**: `npx playwright test -g "theme toggle"`
- **Debug (UI Mode)**: `npm run test:e2e:ui`
- **Projects**: `chromium-desktop` (default), `webkit-iphone`, `firefox-desktop`

## Code Style Guidelines

### TypeScript
- **Strict Mode**: `strict: true` is enabled.
- **Erasable Syntax**: `erasableSyntaxOnly: true`.
  - ❌ **NO ENUMS**: Use union types (`type Mode = 'light' | 'dark'`).
  - ❌ **NO NAMESPACES**: Use ES modules.
- **Imports**: Use `import type` for type-only imports.
- **No `any`**: Use `unknown` with type guards.
- **No Type Suppression**: Avoid `@ts-ignore`, `as any`.

### Formatting
- **Indentation**: 2 spaces.
- **Quotes**: Single quotes preferred.
- **Semicolons**: Always.
- **React**: Functional components with Hooks. No class components.

### Naming Conventions
- **Components**: `PascalCase` (`NavPage.tsx`)
- **Hooks**: `camelCase` (`useNavConfig.ts`)
- **Functions/Vars**: `camelCase`
- **Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE` (Module level)

### Error Handling
- **API**: Return explicit JSON errors with status codes (4xx/5xx).
- **Frontend**: Handle promises with `try/catch`. Fail gracefully (fallback to default config).
- **Worker**: Validate all inputs to prevent SSRF.

## Architecture & State

1. **Config Loading**:
   - `useNavConfig` hook loads `nav.yaml` (base) + API overrides (KV).
   - Priority: KV > YAML.
2. **State Management**:
   - Local state + Props.
   - No Redux/Zustand.
3. **Styling**:
   - Plain CSS (`App.css`, `index.css`).
   - CSS Variables for theming (`--bg-color`, `--text-color`).
   - No Tailwind.

## Agent Workflow

1. **Analysis First**:
   - Before coding, read `AGENTS.md` (this file) and `package.json`.
   - Explore existing patterns in `src/` using `ls` and `read`.
2. **Implementation**:
   - If adding a feature, follow the "Frontend Logic" -> "API" -> "Worker" flow.
   - Maintain the `erasableSyntaxOnly` constraint.
3. **Verification**:
   - Run `npm run lint` to catch style issues.
   - Run `npm run build` to ensure type safety.
   - Run `npm run test:e2e:chromium` to verify functionality.
4. **Documentation**:
   - If you add a new env var, document it in `README.md`.

## Security
- **Secrets**: Never commit `.env` files.
- **Auth**: Admin features rely on backend session validation.
- **Sanitization**: All user input in `functions/api` must be sanitized.
