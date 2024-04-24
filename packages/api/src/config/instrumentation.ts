/*instrumentation.ts*/
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";

// opentelemetry-collector-service:4318
const sdk = new NodeSDK({
  // traceExporter: new ConsoleSpanExporter(),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    // exporter: new ConsoleMetricExporter(),
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export function startInstrumentation() {
  sdk.start();
}
