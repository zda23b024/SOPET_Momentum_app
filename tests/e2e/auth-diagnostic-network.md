# Single-login diagnostic network capture

Cookie values and response bodies are excluded.

| METHOD | PATH | STATUS | PHASE |
|---|---|---|---|
| GET | /api/v1/auth/me | 401 | A login 1 |
| GET | /api/v1/privacy/keys/metadata | 401 | A login 1 |
| GET | /api/v1/auth/me | 401 | A login 1 |
| GET | /api/v1/privacy/keys/metadata | 401 | A login 1 |
| GET | /api/v1/auth/csrf-token | 200 | A login 1 |
| POST | /api/v1/auth/refresh | 401 | A login 1 |
| GET | /api/v1/auth/me | 401 | A login 1 |
| POST | /api/v1/auth/refresh | 401 | A login 1 |
| POST | /api/v1/auth/login | 200 | login submit |
| GET | /api/v1/privacy/keys/metadata | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/auth/me | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/privacy/keys/metadata | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/auth/me | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/auth/me | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/health | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/users/profile | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/goals | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/milestones | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/actions | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/barriers | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/reviews | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/interventions | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/lessons | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/barriers/taxonomy | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/adjustments | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/kpis/momentum | 200 | immediately after login / dashboard bootstrap |
| GET | /api/v1/sessions | 200 | A authenticated settings |
| GET | /api/v1/users/profile | 200 | A authenticated settings |
| GET | /api/v1/sessions | 200 | A authenticated settings |
| GET | /api/v1/users/profile | 200 | A authenticated settings |
| GET | /api/v1/auth/csrf-token | 200 | A logout |
| POST | /api/v1/auth/logout | 200 | A logout |
| GET | /api/v1/auth/me | 401 | A logout |
| GET | /api/v1/privacy/keys/metadata | 401 | A logout |
| GET | /api/v1/auth/me | 401 | A logout |
| GET | /api/v1/privacy/keys/metadata | 401 | A logout |
| GET | /api/v1/auth/csrf-token | 200 | A logout |
| POST | /api/v1/auth/refresh | 401 | A logout |
| GET | /api/v1/auth/me | 401 | A logout |
| GET | /api/v1/auth/me | 401 | A logout |
