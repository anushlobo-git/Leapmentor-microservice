# Payments

Payments owns mentee and mentor wallets, escrow transactions, and commission
settings. It is the source of truth for payment records. Mentoring Workspace
owns connect-request state; Payments accesses the minimum payment context and
state changes it needs through Workspace's internal API.

## Responsibilities

- Provision role-scoped wallets for new users.
- Read the signed-in mentee's wallet.
- Charge escrow for connect requests and additional sessions.
- Release escrow after session completion, refund escrow, and read payment
  status.
- Apply the configured platform commission.
- Support trusted internal wallet provisioning, refund processing, and
  commission settings for other services and Admin & Moderation.
- Persist transactions and idempotency records to protect payment operations
  against duplicate requests.

The cross-service financial lifecycle is not yet backed by a durable outbox
and reconciliation process; review that boundary before production use.

## API

Browser-facing routes use `/api/v1/escrow` and require authentication:

| Route | Operation |
| --- | --- |
| `GET /wallet` | Read the authenticated mentee wallet |
| `POST /pay` | Pay into escrow for a request |
| `POST /pay-additional` | Pay for an additional session |
| `POST /release/:requestId` | Release escrow |
| `POST /refund/:requestId` | Refund escrow |
| `GET /status/:requestId` | Read payment status |

Trusted internal routes use `/internal/v1` and require service authentication:

| Route prefix | Operations |
| --- | --- |
| `/wallets` | Provision wallets |
| `/settings` | Read or update commission |
| `/refunds` | Process an internal refund request |

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP server and database lifecycle
clients/               Mentoring Workspace internal client
config/                Environment and database configuration
container/             Dependency wiring
controllers/            HTTP request handlers
middleware/             Authentication, internal auth, validation, readiness, and errors
models/                 Wallet, Transaction, IdempotencyKey, and PlatformSetting
repositories/           Payment data access
routes/                 Public and internal API route definitions
services/               Wallet, escrow, and platform-settings logic
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set MongoDB, JWT, Workspace URL/token, and commission configuration in .env.
npm ci
npm run dev
```

The local default port is `5004`. Use the same access-token signing secret as
Identity & Access and configure the Workspace internal URL and token. See
[`.env.example`](./.env.example) for all settings. Do not commit `.env` or real
credentials.

Run the tests with:

```bash
npm test
```

## Health and container

- `GET /health/live` reports whether the process is running.
- `GET /health/ready` reports whether the service is ready to handle requests.

Build this service's standalone image from the repository's `services` folder:

```bash
docker build -f payments/Dockerfile -t leapmentor/payments:local payments
```
