# LeapMentor Microservices

This repository contains the independently deployable LeapMentor services.

The existing monolith remains in `../Leapmentor-backend` and the frontend remains
in `../Leapmentor-frontend`. Those folders keep their own Git repositories.

## Planned services

- `identity-access/`
- `profile-discovery/`
- `mentoring-workspace/`
- `payments/`
- `notifications-support/`
- `admin-moderation/`

Each service will use the established application structure from the monolith:

- `app.js`
- `server.js`
- `container/`
- `controllers/`
- `services/`
- `repositories/`
- `models/`
- `routes/`
- `middleware/`
- `config/`
- `tests/`

All six service processes now have their initial `app.js`, `server.js`,
`container/`, `config/`, and `package.json` foundation. Business routes and
owned models will be added one complete lifecycle at a time; the monolith is
not copied into every service.

Identity & Access currently owns the local authentication flows plus the
Google, LinkedIn, and generic social-auth routes. It also exposes the
authenticated account DTO at `GET /api/v1/users/me`. Provider credentials are
configured through environment variables and are not committed to this
repository.

Profile & Discovery now owns the mentor- and mentee-profile lifecycles. It calls
Identity's internal user-summary endpoint for role authorization and does not
import Identity models or repositories.

It also owns mentor availability schedules and slot generation. Bookings and
temporary slot locks remain in Mentoring Workspace; Profile calls Workspace's
internal blocker projection when generating selectable slots.

Mentor discovery is served by `GET /api/v1/mentors/search`. Profile filters
complete, published mentor profiles and asks Identity for name matches and
batch user summaries. Search results use a safe public projection and do not
include phone numbers or verification documents.

Profile also owns the public upload endpoints under `/api/v1/upload`. Files are
held in memory and streamed through the Cloudinary adapter; mentor verification
metadata is written back to `MentorProfile` with provider-asset rollback on a
failed database update. Cloudinary credentials are environment-only.

Google Calendar integration is also owned by Profile under
`/api/v1/google-calendar`. OAuth state is signed and short-lived, tokens are
hidden in the Availability model, and busy/event reads are normalized before
being returned to the browser.

Payments now owns the mentee wallet read at `GET /api/v1/escrow/wallet`. The
route verifies the shared Identity access-token signature and always selects
the role-scoped mentee wallet, so dual-role accounts do not receive a mentor
wallet by query-order accident.

Payments also owns the escrow ledger operations under `/api/v1/escrow/pay`,
`/pay-additional`, `/release`, `/refund`, and `/status`. Connect-request state
remains in Mentoring Workspace and is changed only through the internal payment
context boundary. Final session release has a durable Workspace pending marker,
periodic retry, and a permanent unique Payments ledger key. Initial payment and
refund projection recovery still need the D3 policy and live replica-set checks.

Mentoring Workspace now owns the initial connect-request lifecycle under
`/api/v1/connect-requests`: creation, request lists, mentor response, detail,
ongoing reads, and mentee cancellation. Participant IDs are returned directly;
Identity participant names/emails are composed on request reads. Connect
request toast events preserve the browser's `{ title, message, type }` contract;
request state events preserve their request ID/status payload. Email and
realtime side effects are implemented through Notifications and Socket.IO.

Workspace also owns temporary checkout locks under `/api/v1/slot-locks`. Locks
expire after ten minutes, are protected by a unique exact-slot index, and are
checked against both accepted Workspace requests and other active locks.

Session slot operations are exposed under `/api/v1/sessions`: slot reads,
trusted meeting links, two-party completion marks, additional slots,
cancellation, and rescheduling. Payments release is retried safely after
transient failures, and Profile reschedule availability follows the monolith's
empty-schedule and request-only slot exclusions.

## Local foundation ports

| Service                        | Port |
| ------------------------------ | ---: |
| Identity & Access              | 5001 |
| Profile & Discovery            | 5002 |
| Mentoring Workspace & Realtime | 5003 |
| Payments                       | 5004 |
| Notifications & Support        | 5005 |
| Admin & Moderation             | 5006 |

These are local development defaults. Kubernetes service ports will be
configured later and will not be exposed directly to the browser.

## Container packaging

Each backend service has its own multi-stage `Dockerfile` and `.dockerignore`
inside its service directory. The frontend has its own multi-stage Dockerfile
and unprivileged Nginx runtime. Build all seven application images through the
workspace Compose configuration:

```bash
docker compose build
```

The Compose file assigns the same deterministic image names used by the
Kubernetes Deployments, such as `leapmentor-local-payments:latest`.

Each service now has a dedicated `.env.example`; copy it to that service's
ignored `.env` before using `start-local.sh`, or run
`./setup-local-env.sh` to create placeholder local files without overwriting
existing configuration. The launcher no longer loads or forwards one shared
environment file to every service. See
`CONTAINER_BUILD.md` for the image, runtime, and verification details.
