# SOPET Momentum Backend (NestJS REST API)

**Product**: SOPET Momentum  
**Master Ecosystem**: THE SOFT PERSONA TOOL — SOPET  
**Organization**: ACoS EduTech and Consultancy  
**Architecture**: NestJS 11 + TypeScript + Prisma ORM + PostgreSQL + Argon2id + Google Gemini 2.5 Flash

---

## 1. System Architecture & Core Philosophy

The SOPET Momentum backend is a production-grade, privacy-conscious execution and developmental progress API built strictly according to the *SOPET Momentum Web Application Development Workflow* and the *SOPET Momentum Manual Pilot Protocol BASIC*.

### Core Principles
1. **Action Over Label**: Never pathologize or clinically label the person; diagnose action boundaries and friction points.
2. **AI Suggests, User Confirms, App Writes**: The AI engine proposes diagnoses and actions; the user retains explicit authority to accept, modify, or reject before anything is committed to the database.
3. **MMA Restores Momentum, Never Completes Parent**: Completing a Minimum Meaningful Action (MMA, 10–15 min) lowers resistance and restores forward movement; it explicitly **does not** mark the parent action as completed.
4. **Guilt-Free Restart Protocol**: Interruptions are natural. Fast recovery without shame is tracked via 5 diagnostic questions and immediate restart action creation.
5. **Zero-Knowledge Privacy Support**: Private goals, barrier explanations, and reflection notes can be client-encrypted. Raw private keys are never stored on the server.

---

## 2. API Endpoints Reference

### Development/staging administrator bootstrap

The administration UI is at `http://localhost:3000/administration` after normal sign-in. It requires an eligible admin role **and** `admin.dashboard.view`; backend admin APIs independently enforce roles and permissions. Production `SYSTEM_OWNER` administration additionally requires MFA.

On a development or staging database, first apply migrations and run `npm run prisma:seed` with `SEED_DEMO_USERS` unset/false so current roles and permissions exist. Set these values **locally** in `backend/.env` (never commit the password):

```dotenv
BOOTSTRAP_ADMIN_ENABLED=true
BOOTSTRAP_ADMIN_EMAIL=admin@sopet.local
BOOTSTRAP_ADMIN_PASSWORD=<developer-selected-secret-of-at-least-12-characters>
BOOTSTRAP_ADMIN_ROLE=SYSTEM_OWNER
```

Run `npm run admin:bootstrap` from `backend`, then set `BOOTSTRAP_ADMIN_ENABLED=false`. The explicit command creates a verified account only when its email is absent; rerunning never resets or promotes an existing account. Production startup and the command reject enabled bootstrap mode. Use the normal login form, change the bootstrap password, and enable MFA. `SEED_DEMO_USERS` is not needed and must not be enabled in production. No role grants access to another user's private Goal without a valid `GoalAccessGrant` and, for encrypted content, the recipient's own key.

The current UI supports metadata-only user search/status, role assignment by system owners, verification/password-reset email triggers, session revocation, security/audit history, pending deletion visibility, and health summaries. Admin invitation acceptance and a complete account-lockout inventory are not yet implemented.

All routes are prefixed with `/api/v1`. Interactive OpenAPI/Swagger documentation is hosted at `/api/docs`.

### Authentication (`/api/v1/auth`)
- `POST /register`: Register participant account with Argon2id password hashing.
- `POST /login`: Authenticate email/password with brute-force rate tracking.
- `POST /refresh`: Secure refresh token rotation (SHA-256 token hash storage, reuse detection).
- `POST /logout`: Revoke current session and clear HttpOnly cookies.
- `POST /logout-all`: Invalidate all active sessions for current user.
- `GET /me`: Get authenticated user profile, roles, and granular permissions.

### Sessions & Devices (`/api/v1/sessions`)
- `GET /`: List active sessions (IP, user agent, last active time).
- `DELETE /:id`: Revoke specific session.
- `DELETE /`: Revoke all sessions except the current one.

### Goals (`/api/v1/goals`)
- `GET /`: List all goals for the authenticated user.
- `GET /:id`: Get specific goal with milestones, actions, and KPIs (strict ownership check).
- `POST /`: Create new meaningful goal (optional primary designation).
- `PATCH /:id/status`: Update goal status (ACTIVE, PAUSED, COMPLETED) with history tracking.

### Actions & NMAs (`/api/v1/actions`)
- `GET /`: List user actions (filterable by `goalId`).
- `GET /:id`: Get action details, readiness history, and linked barriers.
- `POST /`: Create action (optional designation as Next Meaningful Action).
- `PATCH /:id/status`: Update status (`PENDING`, `READY`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`).
- `POST /:id/nma`: Designate as current Next Meaningful Action (supersedes previous NMA).

### Action Readiness Assessment (`/api/v1/actions/:id/readiness`)
- `POST /`: 5 diagnostic questions:
  1. Clearly understood?
  2. Knows how to do?
  3. Has resources?
  4. Prerequisites met?
  5. Internal resistance low?
  - Returns provisional verdict (`READY`, `NEEDS_CLARIFICATION`, `CAPABILITY_CONCERN`, etc.).

### Barriers & ACIF Diagnosis (`/api/v1/barriers` & `/api/v1/actions/:id`)
- `GET /barriers/taxonomy`: Retrieve 13-category ACIF taxonomy, definitions, and discriminating questions.
- `GET /barriers`: List diagnosed barriers for authenticated user.
- `POST /actions/:id/block`: Mark action as `BLOCKED` and record user's qualitative friction explanation.
- `POST /actions/:id/barriers/confirm`: Confirm or modify diagnosed category ("AI suggests, User confirms").

### Interventions (`/api/v1/interventions` & `/api/v1/actions/:id/interventions`)
- `GET /interventions`: Get methodology-approved interventions (Clarity, MMA, Resource, Evidence Log, etc.).
- `POST /actions/:id/interventions`: Link intervention to a blocked or resistant action.

### Minimum Meaningful Action (`/api/v1/actions/:id/mma` & `/api/v1/mma/:id`)
- `GET /actions/:id/mma`: List micro-actions linked to parent action.
- `POST /actions/:id/mma`: Create a 10–15 min MMA.
- `PATCH /mma/:id/complete`: Complete MMA. **Crucial rule**: Restores momentum without completing parent action.

### Interruption & Restart Protocol (`/api/v1/goals/:id`)
- `GET /goals/:id/restarts`: View interruption and restart history.
- `POST /goals/:id/restart`: Execute 5-question Restart Protocol:
  1. Is the goal still meaningful?
  2. What changed in circumstances?
  3. Root cause of interruption?
  4. Is the plan realistic?
  5. Restart decision (`RESUME`, `ADJUST`, `REDUCE_ACTION`, `CHANGE_NMA`, `PAUSE_GOAL`).
  - Automatically anchors an immediate Restart Action as the new NMA.

### Weekly Review & Lessons (`/api/v1/reviews` & `/api/v1/lessons`)
- `GET /reviews`: List weekly review reflections.
- `POST /reviews`: Submit 5-question Weekly Review:
  1. Meaningful progress
  2. Actions that mattered
  3. What got in the way
  4. Interventions evaluated
  5. Interruption / restart rhythm
  - Automatically creates Lesson & Adjustment records and anchors the Next NMA.
- `GET /lessons`: Extracted lessons and concrete behavioral adjustments.

### Momentum KPIs (`/api/v1/kpis`)
- `GET /kpis/momentum`: Computes the 6 core momentum metrics:
  1. Action Completion Rate (%)
  2. Momentum Continuity (weeks)
  3. Restart Speed (days)
  4. Barrier Resolution Rate (%)
  5. Goal Milestone Progress (%)
  6. Self-Efficacy Score & Trend

### AI Methodology Engine (`/api/v1/ai`)
- `POST /ai/diagnose-barrier`: Proposes ACIF category + approved intervention via Gemini 2.5 Flash.
- `POST /ai/suggest-mma`: Generates a low-friction 10–15 min micro-step.
- `POST /ai/suggest-restart`: Recommends restart decision and immediate restart action.
- `POST /ai/sharpen-nma`: Converts vague intentions into crisp actions with clear physical boundaries.

### Privacy & Encryption (`/api/v1/privacy`)
- `POST /keys`: Register client-wrapped encryption key metadata.
- `GET /keys/metadata`: Retrieve user's key wrapping parameters for client decryption.

### Administration & Security (`/api/v1/admin` & `/api/v1/health`)
- `GET /admin/metrics`: Anonymous aggregate system metrics (Admins/Owner).
- `GET /admin/audit-logs`: Tamper-evident, sanitized audit logs (Security/Owner).
- `GET /admin/security-events`: Security events and brute-force alerts.
- `GET /health`: Heartbeat, database status, and uptime.

---

## 3. Database Management (Prisma)

### Setup & Migrations
```bash
# Generate Prisma Client
bun run prisma:generate

# Apply migrations
bun run prisma:migrate

# Seed reference data (roles, ACIF taxonomy, and approved interventions)
npm run prisma:seed

# Local/demo only: explicitly opt in to demo accounts with a private password
$env:SEED_DEMO_USERS="true"
$env:SEED_DEMO_PASSWORD="use-a-local-password-at-least-12-chars"
npm run prisma:seed

# Inspect database via GUI
bun run prisma:studio
```

### Demo Accounts

Demo accounts are never created by default and no password is stored in this repository. Create them only in a local or disposable staging database by setting `SEED_DEMO_USERS=true` and `SEED_DEMO_PASSWORD`.

1. **Pilot Participant**: `amina@example.com` (Role: `USER`)
2. **Support Specialist**: `support@sopet.local` (Role: `SUPPORT_ADMIN`)
3. **Security Lead**: `security@sopet.local` (Role: `SECURITY_ADMIN`)
4. **System Owner**: `owner@sopet.local` (Role: `SYSTEM_OWNER`)

---

## 4. Running the Backend Server

```bash
# Development mode with hot-reload
bun run start:dev

# Production build and run
bun run build
bun run start:prod
```
The server will start on port 4000 (configurable via `PORT` in `.env`).
OpenAPI Swagger UI will be live at `http://localhost:4000/api/docs`.

## 5. Production Release Runbook

1. Provision PostgreSQL with automated backups and a tested restore procedure. Set `DATABASE_URL` using a secret manager; do not commit `.env` files.
2. Set `NODE_ENV=production`, a public HTTPS `FRONTEND_URL`, `COOKIE_SECURE=true`, strong unique JWT secrets of at least 32 characters, `MAIL_PROVIDER=resend`, `MAIL_FROM`, and `RESEND_API_KEY`.
3. Build and deploy the backend artifact, then run `npx prisma migrate deploy` as a release step before starting the server. Never run the seed command with demo users in production.
4. Build and deploy the frontend with `VITE_API_BASE_URL` pointing at the HTTPS API. Configure the reverse proxy to forward `/api` and preserve secure cookies.
5. Verify `GET /api/v1/health` reports `status: "ok"` and `database: "connected"`; verify registration, email verification, login, refresh, logout, vault recovery, and account-deletion scheduling in staging.
6. Alert on non-2xx health responses, migration failures, email delivery failures, database backup failures, and sustained 429/5xx responses. Keep the previous application artifact available for rollback; do not roll back a migration without a reviewed database procedure.

## One-time SYSTEM_OWNER provisioning

From `backend/`, run `npm run admin:provision` with `DATABASE_URL` pointing to the intended database and `PROVISION_SYSTEM_OWNER_EMAIL` and `PROVISION_SYSTEM_OWNER_PASSWORD` supplied through the execution environment or secret manager. The script does not read `.env.admin` or use bootstrap credentials. Never enable `BOOTSTRAP_ADMIN_ENABLED` in production.

Use a password of 16–128 characters containing uppercase, lowercase, a digit, and a symbol. Provisioning creates or promotes the specified account, marks it active and email verified, and assigns the SYSTEM_OWNER role atomically. A different existing owner causes refusal. Repeating for the same owner preserves its password and MFA configuration. Existing-account promotion replaces its password and revokes previous sessions and recovery links; it does not reset MFA or alter encrypted vault data.

The script creates no demo data and does not seed the permission catalog or change role permissions. Existing authorization and production MFA requirements still apply. Remove the provisioning credentials from the execution environment after completion. This command must be run explicitly; it is not part of application startup or deployment.

To reset an existing owner's password explicitly, supply `PROVISION_SYSTEM_OWNER_RESET_PASSWORD=true` along with the dedicated provisioning email and new password, then run `npm run admin:provision`. Reset mode follows the normal password-reset minimum of 12 characters, uses the normal Argon2id helper, and atomically revokes all login sessions for that user. It preserves roles, MFA, and other account data while ensuring the account is active and email verified. It refuses nonexistent or non-owner accounts and prints `SYSTEM_OWNER: password-reset` on success. Without the exact value `true`, an existing owner keeps its password and the command prints `SYSTEM_OWNER: already-owner`. Remove the reset flag and credentials from the environment afterward.
