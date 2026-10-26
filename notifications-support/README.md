# Notifications & Support

Notifications & Support owns in-app notifications, support messages, and the
authenticated AI chat endpoint. It also consumes notification events from
Redis Streams so other services can request notifications without waiting for
delivery to finish.

## Responsibilities

- Create notifications from trusted internal service requests.
- Consume configured notification stream events and persist notifications.
- List, mark as read, and delete or clear the signed-in user's notifications.
- Accept support messages and expose the support queue and resolution
  operations to administrators.
- Provide an authenticated AI chat endpoint backed by the configured Groq
  chat-completions API.

## API

Browser-facing routes use `/api/v1`:

| Route prefix | Operations |
| --- | --- |
| `/notifications` | List notifications; mark one or all as read; delete one or clear all |
| `/support` | Create a support message; administrators can list messages and resolve a ticket |
| `/ai` | Authenticated chat (`POST /chat`) |

Trusted notification creation uses `POST /internal/v1/notifications` and
requires internal service authentication. Stream delivery is asynchronous and
uses the configured stream and consumer-group settings.

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP server, database, and consumer lifecycle
config/                Environment and database configuration
container/             Dependency wiring
controllers/            HTTP request handlers
gateways/               External AI provider integration
middleware/             User/admin/internal auth, validation, readiness, and errors
models/                 Notification and SupportMessage
repositories/           Notifications and support data access
routes/                 Browser and internal API route definitions
services/               Notifications, support messages, and AI behavior
streams/                Redis Streams notification consumer
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set MongoDB, Redis, shared token, and AI provider configuration as needed.
npm ci
npm run dev
```

The local default port is `5005`. MongoDB stores notification and support
records. Set `REDIS_ENABLED` and the stream configuration for event consumption.
Set `GROQ_API_KEY` to use AI chat. See [`.env.example`](./.env.example) for all
settings; do not commit `.env` or real credentials.

Run the tests with:

```bash
npm test
```

## Health and container

- `GET /health/live` reports whether the process is running.
- `GET /health/ready` reports whether the service is ready to handle requests.

Build this service's standalone image from the repository's `services` folder:

```bash
docker build -f notifications-support/Dockerfile -t leapmentor/notifications-support:local notifications-support
```
