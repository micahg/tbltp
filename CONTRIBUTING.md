# General Contribution Guidelines

TBD, but here are some things we should read:


* [Data Model](packages/api/README.md#data-model)

Automated agents (and anyone wanting a second, isolated dev stack) should
see [AGENTS.md](AGENTS.md).

# Local Development

Prerequisites: Docker, Node.js, and VS Code (the launch configurations in
`.vscode/launch.json` drive the dev servers).

1. Create the root env file used by `compose.dev.yaml` and paste in your
   [LocalStack auth token](https://app.localstack.cloud) (account -> Auth Token):

   ```
   cp .env.example .env
   ```

1. Start mongo and localstack:

   ```
   docker compose -f compose.dev.yaml up -d
   ```

1. Create the assets bucket. `awslocal` is bundled with the localstack image;
   the bucket name must match `STORAGE_S3_BUCKET` in `packages/api/.env`:

   ```
   docker compose -f compose.dev.yaml exec localstack awslocal s3 mb s3://tbltp-local
   ```

1. Create the API env file (already configured for localstack):

   ```
   cp packages/api/.env.example packages/api/.env
   ```

1. Run the VS Code **Backend All** launch compound. The UI is served on
   http://localhost:4200 and talks to the API on http://localhost:3000
   (see `packages/mui/public/env.json`).

## Migrating assets into localstack (optional)

LocalStack's state is in-memory on the free plan, so the bucket and its
objects are lost whenever the container is recreated (e.g. after changing
`compose.dev.yaml`). To copy objects from an S3-compatible bucket (e.g. R2),
run the sync through the localstack container, which ships the AWS CLI:

```
docker compose -f compose.dev.yaml exec \
  -e AWS_ACCESS_KEY_ID=<source-access-key> \
  -e AWS_SECRET_ACCESS_KEY=<source-secret-key> \
  localstack aws s3 sync s3://<source-bucket>/ /tmp/migrate \
  --endpoint-url https://<source-endpoint> --region <source-region>

docker compose -f compose.dev.yaml exec localstack \
  awslocal s3 sync /tmp/migrate/ s3://tbltp-local/

docker compose -f compose.dev.yaml exec localstack rm -rf /tmp/migrate
```

# Unit Testing

* [API](packages/api/README.md#testing)

# Upgrading OpenTelemetry

Dependencies seem to be problematic -- I once got into a situation where `@opentelemetry/api` version `@1.9.0` was in my package.json but `1.8.0` was getting installed as the dependency of the other otel dependencies, causing conflicts.  Cleaning up the packages seemed to help:

```
npm i --package-lock-only
npm dedup
```

# Running with OpenTelemetry

## Collector Setup

I use Grafana... at least, I'm trying! Follow the [setup instructions](https://grafana.com/docs/grafana-cloud/monitor-applications/application-observability/setup/collector/opentelemetry-collector/).

If you're going to do a lot of telemetry work, it might be useful to keep a collector around:

```
docker run --name opentelemetry-collector-contrib -p 4318 -d -v LOCAL_CONFIG_PATH:/etc/otelcol-contrib/config.yaml otel/opentelemetry-collector-contrib:0.98.0
```

LOCAL_CONFIG_PATH is just where you downloaded your config.

Once the collector is up, [configure exporters](https://opentelemetry.io/docs/languages/js/exporters/#otlp-dependencies).