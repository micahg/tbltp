import { Logger, add, createLogger, format, transports } from "winston";
import * as TransportStream from "winston-transport";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import LokiTransport = require("winston-loki");

function lokiTransport(): TransportStream | null {
  const host = process.env.LOKI_URL;
  const userId = process.env.LOKI_USER_ID;
  const token = process.env.LOKI_TOKEN;
  if (!host || !userId || !token) return null;
  return new LokiTransport({
    host,
    basicAuth: `${userId}:${token}`,
    json: true,
    labels: {
      app: "ntt-api",
      env: process.env.DEPLOYMENT_ENVIRONMENT || "local",
    },
    replaceTimestamp: true,
    gracefulShutdown: true,
    onConnectionError: (err) => console.error(`Loki error: ${err}`),
  }) as unknown as TransportStream;
}

function instance(): Logger {
  const _transports: TransportStream[] = [
    //new transports.File({filename: "error.log", level: "error"}),
    //new transports.File({filename: "combined.log", level: "info"}),
    new transports.Console(),
  ];
  const loki = lokiTransport();
  if (loki) _transports.push(loki);

  const logger = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      format.json(),
    ),
    transports: _transports,
  });
  add(logger);

  return logger;
}

export const log: Logger = instance();
