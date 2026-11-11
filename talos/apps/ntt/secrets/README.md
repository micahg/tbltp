# Sealed secrets for the ntt app (dev)

Put the encrypted `SealedSecret` manifests here. Argo CD applies them (app `ntt-secrets`)
and the Sealed Secrets controller decrypts them into plain Secrets in the `ntt` namespace.

The chart expects exactly these Secrets (see `chart/values-talos-dev.yaml`):

| Secret | Keys |
| --- | --- |
| `mongo-connection-string` | `mongo.url` |
| `ntt-api-s3-storage` | `storage.s3.endpoint`, `storage.s3.bucket`, `storage.s3.accessKeyId`, `storage.s3.secretAccessKey` |

Create one (the plaintext never touches Git or disk):

    kubectl -n ntt create secret generic mongo-connection-string \
      --from-literal=mongo.url='mongodb+srv://...' --dry-run=client -o yaml \
    | kubeseal --controller-namespace kube-system --controller-name sealed-secrets-controller \
        --format yaml > mongo-connection-string.yaml

Sealed secrets are encrypted to one cluster's key: rebuilding the cluster means resealing,
unless you back up the controller's key (kube-system secret labelled
`sealedsecrets.bitnami.com/sealed-secrets-key`).
