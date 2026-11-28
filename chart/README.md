# tbltp Helm Chart

This chart deploys the API only. The UI (`packages/mui`) is served by a Cloudflare
Worker (see `packages/mui/wrangler.jsonc`). To serve it some other way, use the
`ghcr.io/micahg/tbltp-mui` image, which still gets built. `uiDomain` is still
needed here: the API allows that origin (CORS).

## Deploying

Argo CD deploys this chart to the Talos clusters. The Argo apps and the version
pins (`apiImageVers`, `releaseVersion`) live in `micahg/talos-cluster`. Dev
follows `main`; prod is pinned to a release tag.

The cluster is expected to already have Cilium (the chart creates a
`CiliumNetworkPolicy`) and Cloudflare Tunnel in the `cloudflared` namespace.
The chart creates no Ingress, namespace or Secrets.

To check a change renders:

```bash
helm template ntt-infra chart -f chart/values.yaml -f chart/values-dev.yaml \
  --set apiImageVers=0.1.0 --set releaseVersion=0.1.0
```

## Secrets

These must exist in the namespace before the API can start. On the Talos
clusters they are SealedSecrets (`apps/ntt/secrets/<env>/` in
`micahg/talos-cluster`).

| Secret | Keys |
| --- | --- |
| `mongo-connection-string` | `mongo.url` |
| `ntt-api-s3-storage` | `storage.s3.endpoint`, `storage.s3.bucket`, `storage.s3.accessKeyId`, `storage.s3.secretAccessKey` |
| `ntt-api-otel` | `otel.headers` (`Authorization=Basic <base64 of instanceId:token>`) |
| `ntt-api-loki` | `loki.userId`, `loki.token` |

## Telemetry

Metrics export directly to Grafana Cloud's OTLP gateway and logs to its Loki
push API (no collector).
