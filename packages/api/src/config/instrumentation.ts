/*instrumentation.ts*/
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

// https://opentelemetry.io/docs/languages/js/instrumentation/#initialize-the-sdk
const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: "ntt-api",
    [SEMRESATTRS_SERVICE_VERSION]: process.env.RELEASE_VERSION || "0.0.1",
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      process.env.DEPLOYMENT_ENVIRONMENT || "local",
  }),
  // traceExporter: new ConsoleSpanExporter(),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    // exporter: new ConsoleMetricExporter(),
    exporter: new OTLPMetricExporter(),
    // exportIntervalMillis: 10000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export function startInstrumentation() {
  sdk.start();
}

export function stopInstrumentation() {
  return sdk.shutdown();
}
