# Identity & Access

Identity & Access owns LeapMentor accounts, authentication, and role-based
identity. It is the source of truth for user identity and issues access and
refresh tokens used by the other services. Other services obtain user
projections through its internal API rather than importing its models or
repositories.

## Responsibilities

- Email/password account registration and login.
- Access-token and refresh-token lifecycle, logout, and authenticated account
  details.
- Google, LinkedIn, and generic social authentication.
- Email verification and forgot-password/reset flows.
- User roles and profile-facing identity summaries.
- Internal user search and summaries for trusted services, plus admin user,
  blocking, and dashboard-statistics operations.
- Wallet provisioning through Payments during account registration.

## API

Browser-facing routes use `/api/v1`:

| Route prefix | Operations |
| --- | --- |
| `/auth` | Register, login, refresh, logout, and Google/social/LinkedIn authentication |
| `/auth` | Forgot-password OTP, OTP verification, and password reset |
| `/verification` | Send or resend verification, verify an OTP, and verify a link token |
| `/users` | Read the signed-in user's account (`GET /me`) and add a role (`PATCH /me/roles`) |

Trusted service-to-service routes use `/internal/v1` and require internal
service authentication:

| Route prefix | Operations |
| --- | --- |
| `/users` | Search users and retrieve a user summary |
| `/admin/users` | List/read users and block or unblock an account |
| `/admin` | Admin-facing user growth and statistics |

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP server and database lifecycle
clients/               Payments integration
config/                Environment and database configuration
container/             Dependency wiring
controllers/            HTTP request handlers
middleware/             Authentication, internal auth, validation, readiness, and errors
models/                 User, OAuth account, and verification-token models
repositories/           Identity data access
routes/                 Public and internal API route definitions
services/               Authentication, OAuth, sessions, users, and verification
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set database, token, OAuth, mail, and internal-service configuration in .env.
npm ci
npm run dev
```

The local default port is `5001`. Google and LinkedIn credentials are optional
unless those sign-in flows are being tested. Configure SMTP for verification
and password-reset email delivery. See [`.env.example`](./.env.example) for all
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
docker build -f identity-access/Dockerfile -t leapmentor/identity-access:local identity-access
```
