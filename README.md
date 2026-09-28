# Tennis Back-Office

Angular administration app for the tennis platform: platform administration,
federations, clubs, tournaments, draws and matches. It consumes the NestJS API
in [`../tennis-backend`](../tennis-backend).

Architecture, domain model and the phase plan:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Angular 22 (standalone components, signals, zoneless), PrimeNG 22 with a
custom Aura preset, reactive forms, Vitest.

## Run it locally

```bash
# 1. API (in ../tennis-backend)
docker compose up -d
npx prisma migrate deploy && npm run db:seed
npm run start:dev                      # http://localhost:3000

# 2. Back-office (here)
npm install
npm start                              # http://localhost:4200
```

`ng serve` proxies `/api/*` to the API (`proxy.conf.json`), so the browser
sees one origin and the httpOnly refresh cookie just works.

Sign in with any development account from the backend README, e.g. the Super
Admin: **77 000 00 01 / `Admin@2026!`** (development only).

## How it is organized

```
src/app/
  core/       auth (session, guards), authz (permissions, *tbCan), api,
              http interceptors, i18n (fr default, en), workspace context,
              layout (shell + nav.config.ts), theme
  shared/     design-system components (page header, status badge, forms…)
  features/   lazy-loaded pages (auth, dashboard, profile, errors, …)
src/styles/   design tokens (_tokens.scss): the only place colors,
              spacing, radii and shadows are defined
```

- **Authorization is mirrored for UX only.** `AuthzService` answers
  `hasPermission / hasAnyPermission / hasAllPermissions / hasRole` from the
  grants returned by `GET /auth/me`. The API enforces every rule itself.
- **The menu is data.** `core/layout/nav.config.ts` declares every entry with
  the permission it needs. The shell shows what the current workspace (the
  platform, one organization or one tournament) allows. Modules not built yet
  show as "Soon".
- **Sessions.** The access token lives in memory only. The refresh token is an
  httpOnly cookie. On a 401 the app refreshes once and replays the request.
  Refreshes are serialized across tabs.
- **Errors** become `ApiError { status, code, messages }` and are shown as
  human-readable toasts; requests can opt out with `SILENT_ERRORS`.

## PrimeNG license

PrimeNG 22 requires a PrimeUI license key (free Community license for small
organizations: https://primeui.dev/licenses). Put it in
`environment*.ts → primeLicense`. Without a key, an "Invalid PrimeUI License"
notice shows in the corner.

## Scripts

```bash
npm start          # dev server with API proxy
npm run build      # production build
npm test           # unit tests (Vitest)
```
