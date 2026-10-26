# Mentoring Workspace & Realtime

Mentoring Workspace owns the lifecycle of mentor-mentee connect requests,
booked sessions, temporary slot locks, and session messages. It also hosts the
browser-facing Socket.IO connection for realtime messaging. Identity & Access
provides identity, Profile & Discovery provides availability, and Payments
owns wallets and escrow.

## Responsibilities

- Create and manage connect requests, including mentor responses,
  participant-specific request lists, ongoing requests, and mentee
  cancellation.
- Lock and release time slots during checkout, with expiring locks and
  conflict checks against active locks and accepted requests.
- Manage session slots, trusted meeting links, completion marks, cancellations,
  and rescheduling.
- Persist and retrieve connect-request messages and unread counts.
- Deliver messages through the Workspace-owned Socket.IO server.
- Provide internal availability blockers to Profile, payment context/state
  operations to Payments, and report/user projections to Admin & Moderation.
- Publish notification events for asynchronous delivery when configured.

## API

Authenticated browser-facing routes use `/api/v1`:

| Route prefix | Operations |
| --- | --- |
| `/connect-requests` | Create requests; list own, incoming, or ongoing requests; read details; respond or cancel |
| `/slot-locks` | Lock/unlock slots, unlock all locks for a user, and read a mentor's active locks |
| `/sessions` | Read slots; set meeting links; mark completion; add, cancel, or reschedule slots |
| `/messages` | Read a connect request's message history and unread count |

Trusted internal routes use `/internal/v1` and require service authentication.
They expose availability blockers, payment context/state, and the user,
engagement, and report data needed by Admin & Moderation.

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP and Socket.IO server, database/stream lifecycle
clients/               Identity, Profile, and Notifications integrations
config/                Environment and database configuration
container/             Dependency wiring
controllers/            HTTP request handlers
middleware/             Authentication, internal auth, validation, and errors
models/                 ConnectRequest, Message, Report, and SlotLock
repositories/           Workspace data access
routes/                 Browser and internal API route definitions
services/               Requests, sessions, messages, and slot locks
socket/                 Socket.IO authentication and event handlers
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set MongoDB, Redis, JWT, and internal-service configuration in .env.
npm ci
npm run dev
```

The local default port is `5003`. MongoDB is required for persistence. Redis
Streams and the Notifications URL/token configure asynchronous notification
delivery; use the matching shared access-token and internal-service
configuration across services. See [`.env.example`](./.env.example) for all
settings. Do not commit `.env` or real credentials.

Run the tests with:

```bash
npm test
```

## Health and container

- `GET /health/live` reports whether the process is running.
- `GET /health/ready` reports whether the service is ready to handle requests.

Build this service's standalone image from the repository's `services` folder:

```bash
docker build -f mentoring-workspace/Dockerfile -t leapmentor/mentoring-workspace:local mentoring-workspace
```
