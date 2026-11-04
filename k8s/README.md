# Kubernetes deployment

The public request path is NGINX Ingress -> the `gateway` ClusterIP Service ->
the frontend or the owning backend service. Backend Services are internal and
are not exposed directly by Ingress. The manifests are in this directory; the
gateway configuration and Ingress are in `gateway/`.

## Open the application locally

The local Minikube Ingress controller can be enabled with:

```bash
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

From the machine running Minikube, either open
`http://$(minikube ip)/` in a browser, or port-forward the gateway:

```bash
kubectl port-forward -n leapmentor service/gateway 8080:8080
```

Keep the port-forward command running and open
[http://localhost:8080](http://localhost:8080). Use the gateway rather than
the frontend Service directly when testing the complete site, since the
gateway also routes `/api/v1` and Socket.IO requests.

The Ingress manifest currently has a wildcard host rule for local use. Its TLS
entry references `leapmentor-tls`; without that Secret and a hostname, HTTPS
uses the controller's fallback certificate and is not ready for trusted
public use. Local HTTP does not require the TLS Secret.

## Configure a public hostname and HTTPS

Before using public OAuth callbacks, redirects, cookies, notification links, or
HTTPS, choose a real hostname and point its DNS record at the cluster's public
entry point. Add the hostname to both `tls.hosts` and `rules.host` in
`gateway/gateway-ingress.yaml`:

```yaml
tls:
  - hosts:
      - app.example.com
    secretName: leapmentor-tls
rules:
  - host: app.example.com
```

Set the browser-facing URLs in the service ConfigMaps to the same public URL:

- `identity-access-config`: `CLIENT_URL`, `APP_BASE_URL`, and
  `LINKEDIN_CALLBACK_URL`
- `profile-discovery-config`: `GOOGLE_REDIRECT_URI`
- `mentoring-workspace-config`: `CLIENT_URL`
- `notifications-support-config`: `APP_BASE_URL`

For `https://app.example.com`, the OAuth callback URLs are:

```text
https://app.example.com/api/v1/auth/linkedin/callback
https://app.example.com/api/v1/google-calendar/callback
```

Do not use `localhost` or a Minikube IP for a public deployment.

Create the TLS Secret from a certificate that covers the chosen hostname, or
use cert-manager:

```bash
kubectl create secret tls leapmentor-tls \
  --cert=fullchain.pem \
  --key=privkey.pem \
  -n leapmentor
```

Keep the private key out of Git.

## Apply and verify gateway resources

Run these commands from the repository root:

```bash
kubectl apply -f services/k8s/gateway/gateway-config.yaml
kubectl apply -f services/k8s/gateway/gateway-service.yaml
kubectl apply -f services/k8s/gateway/gateway-ingress.yaml
kubectl rollout restart deployment/gateway -n leapmentor
kubectl rollout status deployment/gateway -n leapmentor
kubectl get ingress,services,endpoints -n leapmentor
```

The gateway ConfigMap is mounted with `subPath`; restart the gateway after
changing the ConfigMap. Container image build/import steps are covered in
[`../CONTAINER_BUILD.md`](../CONTAINER_BUILD.md).

The internal debugging paths are intentionally blocked by the gateway:

```bash
curl -i http://<host>/services/identity-access/health/live
```

This should return `404`. Public application routes use `/api/v1`.
