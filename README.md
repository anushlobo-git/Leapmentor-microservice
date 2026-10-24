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

Only the service-owned folders will be added as implementation begins. The
service directories are currently placeholders so the repository layout is
ready without copying the monolith into every service.
