# Profile & Discovery

Profile & Discovery owns mentor and mentee profiles, mentor availability, and
public mentor discovery. It also handles profile-related uploads and Google
Calendar integration. Identity & Access remains the owner of user identity;
Mentoring Workspace remains the owner of requests, bookings, and temporary
slot locks.

## Responsibilities

- Create, read, and update mentor and mentee profiles.
- Maintain mentor availability schedules and generate selectable slots.
- Account for Workspace booking and temporary-lock blockers when generating
  available slots.
- Search complete, published mentor profiles and return a safe public
  projection; Identity provides name matching and user summaries.
- Upload profile and verification assets through Cloudinary.
- Connect mentor calendars and read normalized busy intervals and calendar
  events.
- Provide internal profile, verification, and statistics routes for Admin &
  Moderation.

## API

Browser-facing routes use `/api/v1`:

| Route prefix | Operations |
| --- | --- |
| `/mentor-profile` | Read and update the signed-in mentor profile, submit verification information, and retrieve a mentor profile |
| `/mentee-profile` | Read and update the signed-in mentee profile, submit profile information, and retrieve a mentee profile |
| `/availability` | Read and edit the signed-in mentor's schedule, read a mentor schedule, and request available slots |
| `/mentors` | Search for mentors |
| `/upload` | Upload profile and mentor-verification assets |
| `/google-calendar` | Start calendar authorization, process the callback, read busy intervals/events, and disconnect |

The profile, availability, search, and upload operations use Identity-backed
authentication where applicable. Mentor schedule edits require the mentor
role. Internal admin routes use `/internal/v1/admin` and require service
authentication.

## Project structure

```text
app.js                 Express middleware and route mounting
server.js              HTTP server and database lifecycle
clients/               Identity and Workspace internal clients
config/                Environment, database, and provider configuration
container/             Dependency wiring
controllers/            HTTP request handlers
middleware/             Authentication, internal auth, upload, validation, and errors
models/                 MentorProfile, MenteeProfile, and Availability
repositories/           Profile and availability data access
routes/                 Public and internal API route definitions
services/               Profiles, search, availability, uploads, and calendar integration
tests/                  Node.js built-in test suites
```

## Run locally

Use Node.js 18 or newer and npm 9 or newer. From this directory:

```bash
cp .env.example .env
# Set database, Identity/Workspace service, Cloudinary, and Google credentials as needed.
npm ci
npm run dev
```

The local default port is `5002`. Cloudinary credentials are needed for
provider-backed uploads; Google OAuth credentials are needed for Calendar
integration. See [`.env.example`](./.env.example) for the complete configuration
contract. Do not commit `.env` or real credentials.

Run the tests with:

```bash
npm test
```

## Health and container

- `GET /health/live` reports whether the process is running.
- `GET /health/ready` reports whether the service is ready to handle requests.

Build this service's standalone image from the repository's `services` folder:

```bash
docker build -f profile-discovery/Dockerfile -t leapmentor/profile-discovery:local profile-discovery
```
