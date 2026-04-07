# tbltp Helm Chart

## Physical Infra

Expecting to coexist with other infra. *For example* - you wont find the
certificate issuers here because they live in the another chart.


## Helm

Testing:

```helm upgrade --dry-run --debug --install -f chart/values.yaml -f chart/values-dev.yaml --set releaseVersion=0.20.0 --set deployEnv=development ntt-infra chart```

S3 values can be injected from CI with `--set-string` flags:

```bash
--set-string storageS3Endpoint="$STORAGE_S3_ENDPOINT" \
--set-string storageS3Bucket="$STORAGE_S3_BUCKET" \
--set-string storageS3AccessKeyId="$STORAGE_S3_ACCESS_KEY_ID" \
--set-string storageS3SecretAccessKey="$STORAGE_S3_SECRET_ACCESS_KEY"
```

Rollback:

```helm list```

```helm rollback ntt-infra```

Uninstall:

*BE REALLY CAREFUL THIS WILL BLOW AWAY PROD CERTS* and then letsencrypt wont issue you any more for another week.

```helm uninstall ntt-infra```

## Microk8s

Config generated using `microk8s config  | sed "s/NATTED_IP:16443/PUBLIC_HOSTNAME:47826/g" | base64 -w0`.