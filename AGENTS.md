# Repository Guidelines

## Project Structure & Module Organization
PowerGuard is a monorepo combining the Expo client and NestJS API. Frontend screens live under `app/` using Expo Router; shared React pieces stay in `components/`, state providers in `context/`, and networking helpers in `services/`. Type definitions belong in `types/`, Tailwind setup in `global.css`, and static assets in `assets/`. Backend code sits in `backend/src/` with Prisma schemas in `backend/prisma/`. Infrastructure notes and diagrams are kept in `docs/`. Favor colocating feature-specific assets (component, hook, styles) to keep tabs screens focused.

## Build, Test, and Development Commands
- `npm install` then `npm run install:all` to bootstrap both workspaces.
- `npm start` spins up the Expo dev server; use `npm run android`, `npm run ios`, or `npm run web` for platform targets.
- `npm run backend` proxies to `backend npm run start:dev`; `npm run backend:build` and `npm run backend:prod` build and launch the NestJS API.
- `npm run lint` runs Expo’s flat ESLint configuration across the app.

## Coding Style & Naming Conventions
- TypeScript everywhere; keep 2-space indentation and single quotes as enforced by Expo’s ESLint preset and the Prettier Tailwind plugin.
- React components and contexts use `PascalCase` (`OutletCard`, `LocationProvider`); hooks and helpers use `camelCase`.
- Tailwind utility classes stay in JSX; extract shared styles into `global.css` if reused.
- Keep API clients thin in `services/` and colocate mock data beside consumers for clarity.

## Testing Guidelines
- Backend relies on Jest; add unit specs under `backend/src/**/__tests__` or `.spec.ts` files, then run `cd backend && npm run test` or `npm run test:cov` for coverage.
- For HTTP flows, prefer `npm run test:e2e` with Supertest fixtures in `backend/test/`.
- Expo client lacks automated tests today; please verify critical flows manually (authentication, outlet toggles, maps) before opening a PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in history; group logical changes per commit.
- PRs need a concise summary, linked issue or task, screenshots or recordings for UI tweaks, and a checklist of commands executed (`npm run lint`, backend tests).
- Flag environment or schema changes prominently and update `docs/` or Prisma seeds when behavior shifts.

## Security & Configuration Tips
- Never commit real `.env` values; start from `backend/.env.example` and document required keys in the PR.
- Run `cd backend && npx prisma migrate status` before seeding to confirm schema sync, and rotate MQTT credentials if simulator settings change.
