# tbltp Helm Chart

## Physical Infra

Expecting to coexist with other infra. *For example* - you wont find the
certificate issuers here because they live in the another chart.


## Helm

Testing:

```helm upgrade --dry-run --debug --install -f chart/values.yaml -f chart/values-dev.yaml --set releaseVersion=0.20.0 --set deployEnv=development ntt-infra chart```

Rollback:

```helm list```

```helm rollback ntt-infra```

Uninstall:

*BE REALLY CAREFUL THIS WILL BLOW AWAY PROD CERTS* and then letsencrypt wont issue you any more for another week.

```helm uninstall ntt-infra```

## Microk8s

Config generated using `microk8s config  | sed "s/NATTED_IP:16443/PUBLIC_HOSTNAME:47826/g" | base64 -w0`.