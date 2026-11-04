# LeapMentor Services

This directory contains six independently runnable backend services and their
Kubernetes manifests. The existing monolith remains in
[`../Leapmentor-backend`](../Leapmentor-backend), and the frontend remains in
[`../Leapmentor-frontend`](../Leapmentor-frontend); this services workspace does
not replace those projects.

## Service boundaries

| Service | Local port | Owns |
| --- | ---: | --- |
| [Identity & Access](./identity-access/README.md) | 5001 | Accounts, authentication, tokens, verification, and identity summaries |
| [Profile & Discovery](./profile-discovery/README.md) | 5002 | Mentor/mentee profiles, availability, discovery, uploads, and Calendar integration |
| [Mentoring Workspace](./mentoring-workspace/README.md) | 5003 | Connect requests, slot locks, sessions, messages, notes, and realtime transport |
| [Payments](./payments/README.md) | 5004 | Wallets, escrow, invoices, earnings, and Leap Request payments |
| [Notifications & Support](./notifications-support/README.md) | 5005 | Notifications, support, email events, and AI chat |
| [Admin & Moderation](./admin-moderation/README.md) | 5006 | Admin authentication, dashboards, user moderation, verification, and reports |

Services own their data and communicate through HTTP APIs protected by service
authentication. Redis Streams carries asynchronous notification work;
Mentoring Workspace owns browser-facing Socket.IO. Service integrations and
route ownership are described in [COMMUNICATION.md](./COMMUNICATION.md).

## Run the application with Docker Compose

The workspace-root Compose file starts MongoDB, Redis, the six backend
services, the frontend, and a local NGINX gateway. From the repository root:

```bash
./services/setup-local-env.sh
# Review each services/*/.env and replace local placeholders as needed.
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The gateway routes the
frontend and API traffic to the owning service, including Socket.IO traffic to
Mentoring Workspace. Keep the Compose process running while using the app.

See [CONTAINER_BUILD.md](./CONTAINER_BUILD.md) for image builds, health checks,
and environment details.

## Run backend processes directly

For direct local development, each service has its own `.env.example`,
`package.json`, and lockfile. Start MongoDB as a replica set and Redis first,
then create each service's ignored `.env` file and configure its dependencies.
From a service directory, install and run:

```bash
npm ci
npm run dev
```

The `start-local.sh` script starts all six backend processes using their
separate environment files; it does not start MongoDB or Redis:

```bash
cd services
./setup-local-env.sh
# Review and configure each services/*/.env, then:
./start-local.sh
```

## Kubernetes

Kubernetes manifests live in [`k8s/`](./k8s/). The public path is Ingress to
the gateway Service; backend Services remain internal. For local browser access,
Ingress can be reached through the Minikube IP or by port-forwarding the
gateway:

```bash
kubectl port-forward -n leapmentor service/gateway 8080:8080
```

Then open [http://localhost:8080](http://localhost:8080). See the
[Kubernetes guide](./k8s/README.md) for local Ingress and public-host/TLS
configuration.

## Health and tests

All six services expose `GET /health/live` and `GET /health/ready`. Liveness
indicates that the process is responding; readiness indicates that the service
can accept its stateful requests.

Run a service's tests from its directory with:

```bash
npm test
```

Do not commit `.env` files, provider credentials, or TLS private keys.
