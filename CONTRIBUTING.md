# Running with OpenTelemetry

## Collector Setup

I use Grafana... at least, I'm trying! Follow the [setup instructions](https://grafana.com/docs/grafana-cloud/monitor-applications/application-observability/setup/collector/opentelemetry-collector/).

If you're going to do a lot of telemetry work, it might be useful to keep a collector around:

```
docker run --name opentelemetry-collector-contrib -p 4318 -d -v LOCAL_CONFIG_PATH:/etc/otelcol-contrib/config.yaml otel/opentelemetry-collector-contrib:0.98.0
```

LOCAL_CONFIG_PATH is just where you downloaded your config.

Once the collector is up, [configure exporters](https://opentelemetry.io/docs/languages/js/exporters/#otlp-dependencies).