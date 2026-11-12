# cloudflared (Cloudflare Tunnel)

One remotely-managed tunnel per cluster. The tunnel token is the only secret; seal it:

    read -rs TOKEN
    kubectl -n cloudflared create secret generic tunnel-token \
      --from-literal=token="$TOKEN" --dry-run=client -o yaml \
    | kubeseal --controller-namespace kube-system --controller-name sealed-secrets-controller \
        --format yaml > dev/tunnel-token.yaml
    unset TOKEN

Public hostnames (set in the Cloudflare Zero Trust dashboard, not in Git):

| Hostname | Service |
| --- | --- |
| dev.tbltp.dev | `http://ntt-ui-service.ntt.svc.cluster.local:80` |
| dev-api.tbltp.dev | `http://ntt-api-service.ntt.svc.cluster.local:80` |
