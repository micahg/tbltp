import { Logger, add, createLogger, format, transports } from "winston";
import * as TransportStream from "winston-transport";

function instance(): Logger {
  const _transports: TransportStream[] = [
    //new transports.File({filename: "error.log", level: "error"}),
    //new transports.File({filename: "combined.log", level: "info"}),
    new transports.Console(),
  ];

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
