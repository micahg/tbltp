/*instrumentation.ts*/
import opentelemetry, {
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
} from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: "ntt-api",
  [SEMRESATTRS_SERVICE_VERSION]: process.env.RELEASE_VERSION || "0.0.1",
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
    process.env.DEPLOYMENT_ENVIRONMENT || "local",
});

const reader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter(),
});

const myServiceMeterProvider = new MeterProvider({
  resource: resource,
  readers: [reader],
});
opentelemetry.metrics.setGlobalMeterProvider(myServiceMeterProvider);

export function stopInstrumentation() {
  return myServiceMeterProvider.shutdown();
}
