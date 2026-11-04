# Kubernetes deployment

The public entry point is the NGINX Ingress. The `gateway` Service is
`ClusterIP`, so it cannot bypass Ingress routing or TLS policies. Backend
services remain internal `ClusterIP` Services.

## Enable the local Minikube Ingress controller

```bash
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

## Configure the public hostname

Before using OAuth, redirects, cookies, notification links, or HTTPS, choose a
real hostname and point its DNS record at the machine running the cluster. Add
that hostname to `gateway/gateway-ingress.yaml` in both places:

```yaml
tls:
  - hosts:
      - app.example.com
    secretName: leapmentor-tls
rules:
  - host: app.example.com
```

The service ConfigMaps also contain browser-facing URL values. Replace their
local values with the same public URL:

- `identity-access-config`: `CLIENT_URL`, `APP_BASE_URL`, and
  `LINKEDIN_CALLBACK_URL`
- `profile-discovery-config`: `GOOGLE_REDIRECT_URI`
- `mentoring-workspace-config`: `CLIENT_URL`
- `notifications-support-config`: `APP_BASE_URL`

For example, with `https://app.example.com`, the callback values become:

```text
https://app.example.com/api/v1/auth/linkedin/callback
https://app.example.com/api/v1/google-calendar/callback
```

Do not use `localhost` or the Minikube IP for a public deployment.

## Create the TLS Secret

Use cert-manager for a trusted certificate, or create the Secret from an
existing certificate:

```bash
kubectl create secret tls leapmentor-tls \
  --cert=fullchain.pem \
  --key=privkey.pem \
  -n leapmentor
```

The certificate must cover the hostname used by clients. Keep the private key
out of Git.

## Apply and verify

```bash
kubectl apply -f services/k8s/gateway/gateway-config.yaml
kubectl apply -f services/k8s/gateway/gateway-service.yaml
kubectl apply -f services/k8s/gateway/gateway-ingress.yaml
kubectl rollout restart deployment/gateway -n leapmentor
kubectl rollout status deployment/gateway -n leapmentor
kubectl get ingress -n leapmentor
```

The gateway ConfigMap is mounted with `subPath`, so changing it requires the
gateway rollout restart shown above.

The old debugging paths are intentionally blocked:

```bash
curl -i http://<host>/services/identity-access/health/live
```

This should return `404`. Public application routes continue to use `/api/v1`.
