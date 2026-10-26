# Admin & Moderation

The Admin & Moderation service provides the administrative API for LeapMentor.
It authenticates administrators and coordinates administrative operations
across Identity & Access, Profile & Discovery, Mentoring Workspace, and
Payments. It does not own or directly access those services' business records.

## Responsibilities

- Admin login, refresh, logout, and the authenticated admin identity.
- Admin user lookup and account blocking/unblocking.
- Dashboard statistics, user growth, mentor industries, and engagement metrics.
- Mentor verification review and decisions.
- Report review, refund requests, and removal of reported sessions.
- Admin settings, administrator creation, password changes, and commission
  configuration.

Admin credentials and service-specific state are stored in this service's
MongoDB database. Requests for user, profile, workspace, and payment data are
made through internal service clients.

## API

All browser-facing routes use `/api/v1`:

| Route prefix | Operations |
| --- | --- |
| `/admin/auth` | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` |
| `/admin/users` | List users, read a user's detail, and block or unblock an account |
| `/admin` | Dashboard statistics, user growth, mentor industry statistics, and engagement statistics |
| `/admin/settings` | Settings overview, add an admin, change password, read or update commission |
| `/admin/mentor-verifications` | List and read verification requests; verify or revoke a mentor |
| `/admin/reports` | Report statistics and listing; update a report, process a refund, or delete its session |

The dashboard, user, settings, verification, and report routes require a
readiness check; protected operations also enforce administrator authentication
and route-specific validation.

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP server and database lifecycle
clients/               Internal Identity, Profile, Workspace, and Payments clients
config/                Environment and database configuration
container/             Dependency wiring
controllers/            HTTP request handlers
middleware/             Admin authentication, validation, readiness, and errors
models/                 AdminUser persistence model
repositories/           Admin data access
routes/                 API route definitions
services/               Admin and orchestration business logic
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set MongoDB, JWT, and internal-service configuration in .env.
npm ci
npm run dev
```

The local default port is `5006`. Configure the Identity, Profile, Workspace,
and Payments service URLs and shared internal-service credentials in `.env`
when exercising cross-service admin operations. See [`.env.example`](./.env.example)
for the full configuration contract. Do not commit `.env` or real credentials.

Run the tests with:

```bash
npm test
```

## Health and container

- `GET /health/live` reports whether the process is running.
- `GET /health/ready` reports whether the service is ready to handle requests.

Build this service's standalone image from the repository's `services` folder:

```bash
docker build -f admin-moderation/Dockerfile -t leapmentor/admin-moderation:local admin-moderation
```
