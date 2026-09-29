# SOPET Momentum

[![CI](https://github.com/zda23b024/SOPET_Momentum_app/actions/workflows/ci.yml/badge.svg)](https://github.com/zda23b024/SOPET_Momentum_app/actions/workflows/ci.yml)

SOPET Momentum helps people turn goals into meaningful actions, identify barriers, recover from interruptions, and reflect on progress. It is part of **The Soft Persona Tool (SOPET)** by **ACoS EduTech and Consultancy**.

## What the application supports

- Goals, milestones, daily actions, and readiness checks.
- Barrier reviews, interventions, and Minimum Meaningful Actions.
- Restart workflows, weekly reviews, and progress indicators.
- Client-side encryption for protected content and explicit goal sharing.
- AI suggestions with user consent and confirmation.
- Account privacy controls and audit-chain verification.

## Project status

The project is preparing for staging validation. Passing CI does not establish production readiness. Live service acceptance, privacy checks, and a backup/restore rehearsal remain release gates. Full browser-side readable portability export remains an open feature gap.

## Technology and repository layout

| Area | Technology / location |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS in `src/` |
| Backend | NestJS and TypeScript in `backend/src/` |
| Database | PostgreSQL with Prisma schema and migrations in `backend/prisma/` |
| Browser tests | Playwright in `tests/e2e/` |
| CI | GitHub Actions in `.github/workflows/ci.yml` |
| Deployment configuration | `vercel.json` and `backend/railway.toml` |

## Local development

Use Node.js 22 to match CI. Install dependencies separately from the project root and from `backend/`:

```sh
npm ci
cd backend
npm ci
npx prisma generate
```

Configure the backend using `backend/.env.example` and the documentation below. Keep credentials in local environment files or a secret manager; never commit them or expose backend secrets through frontend variables. Use a dedicated development database.

After configuration, run the frontend from the project root:

```sh
npm run dev
```

Run the API from `backend/` in another terminal:

```sh
npm run start:dev
```

The frontend defaults to port 3000 and the API to port 4000 with the `/api/v1` prefix.

## Validation

Frontend, from the project root:

```sh
npm run lint
npm run test:crypto
npm run test:ai
npm run build
npm audit --omit=dev --audit-level=high
```

Backend, from `backend/`:

```sh
npx prisma generate
npx prisma migrate status
npm test -- --runInBand
npm run build
npm run audit:verify
npm audit --omit=dev --audit-level=high
```

Migration status and audit verification require the configured PostgreSQL database. Both dependency trees temporarily override `deepmerge-ts` to version `8.0.1`; retain the override until the upstream Prisma dependency resolves the advisory safely.

## Documentation

- [Backend architecture and API reference](backend/README.md)
- [Privacy architecture](docs/privacy-architecture.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Staging readiness](docs/STAGING_READINESS.md)
- [Production release gates](docs/PRODUCTION_RELEASE_GATE.md)
- [Backup and restore runbook](BACKUP_RESTORE_RUNBOOK.md)

Stage and validate changes before a production release. Do not use real private user data for staging tests.
