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