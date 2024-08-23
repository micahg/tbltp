// trigger rebuild.
import { mkdir } from "node:fs";
import { Server } from "http";

import { log } from "./utils/logger";

import * as expressConfig from "./config/express";
import {
  startInstrumentation,
  stopInstrumentation,
} from "./config/instrumentation";

import { startWSServer, stopWSConnections } from "./utils/websocket";
import { STARTUP_CHECK_SIG, STARTUP_DONE_SIG } from "./utils/constants";
import { getOAuthPublicKey } from "./utils/auth";

import { connect } from "./config/mongoose";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { ValueType, metrics } from "@opentelemetry/api";

// mongoose.set('debug', true);

log.info(`System starting in ${process.env.NODE_ENV}`);

// startup flags
let srvr: Server;
let wss: WebSocketServer;
let mongo: typeof mongoose;
let mongoConnectedFlag = false;
let storageConnectedFlag = false;

startInstrumentation();
log.info("Instrumnentation started");

// ts-prune-ignore-next used in unit tests
export const app = expressConfig.create();

// ts-prune-ignore-next used in unit tests
export const shutDown = async (reason: string) => {
  log.warn(`Shutting down (${reason})`);
  if (mongo) {
    log.warn(`Closing mongo connection...`);
    mongo.connection
      .close()
      .then(() => log.warn("Mongo connection closed"))
      .catch((err) =>
        log.error(`Unable to close mongo connection: ${JSON.stringify(err)}`),
      );
  }
  if (wss) {
    log.warn(`Closing down websocket server...`);
    stopWSConnections();
    wss.close((err) => {
      if (err)
        log.error(`Unable to close websocket server: ${JSON.stringify(err)}`);
      else log.warn("Websocket server shut down");
    });
  }

  log.warn(`Closing instrumentation...`);
  try {
    await stopInstrumentation();
    log.warn(`Instrumentation stopped.`);
  } catch (err) {
    log.error(`Unable to stop instrumentation: ${JSON.stringify(err)}`);
  }

  if (srvr) {
    log.warn(`Closing down server...`);
    srvr.close((err) => {
      if (err) log.error(`Unable to shutdown server: ${JSON.stringify(err)}`);
      else log.warn("Server shut down");
    });
  }
};

// defer listening for requests until we receive an event to check for startup conditions
// events are emitted when a precondition is satisfied (eg: connection to the db)
// ts-prune-ignore-next used in unit test
export const serverPromise = new Promise<Server>((resolve) => {
  app.on(STARTUP_CHECK_SIG, () => {
    if (!mongoConnectedFlag) return;
    if (!storageConnectedFlag) return;

    log.info("All startup flags set");

    // presumably the dir was created and we don't need to check for it.
    srvr = expressConfig.listen(app);
    getOAuthPublicKey()
      .then((pem) => {
        log.info("Retrieved OAuth PEM");
        wss = startWSServer(srvr, app, pem);
        app.emit(STARTUP_DONE_SIG);
        resolve(srvr);
      })
      .catch((err) => {
        log.error(`Unable to getOAuthPublicKey: ${JSON.stringify(err)}`);
        process.exit(1);
      });
  });
});

// ts-prune-ignore-next used in unit test
export async function startUp() {
  // gracefully shut down
  process.on("SIGTERM", () => shutDown("SIGINT"));
  process.on("SIGINT", () => shutDown("SIGINT"));

  const meter = metrics.getMeter("ntt-api");
  const mongoUpDown = meter.createUpDownCounter("ntt-api.mongo.connected", {
    description: "Count of mongoose connections",
    valueType: ValueType.INT,
  });

  // TODO IS THIS NECESSARY!?!?!?
  mongoUpDown.add(0);

  // TODO move this to the storage driver
  log.info(`Create public resources folder...`);
  mkdir("public", { recursive: true }, (err, path) => {
    if (err) {
      log.error(`Unable to create public folder: ${JSON.stringify(err)}`);
      process.exit(1);
    }
    log.info(`Created public asset path: ${path}`);
    storageConnectedFlag = true;
    app.emit(STARTUP_CHECK_SIG);
  });

  let goose;
  while (!goose) {
    try {
      goose = await connect();
    } catch (err) {
      log.error(`Unable to connect to mongo: ${err}`);
    }
  }

  mongoUpDown.add(1);
  mongoConnectedFlag = true;
  mongo = goose;
  const conn = goose.connection;
  conn.on("error", (err) => log.error("Mongoose error", err));
  conn.on("disconnected", (err) => {
    mongoUpDown.add(-1);
    log.error("Mongoose disconnected", err);
  });
  conn.on("reconnected", () => {
    mongoUpDown.add(1);
    log.info("Mongoose reconnected");
  });
  log.info(`Mongo connected to ${conn.name} on ${conn.host}`);
  app.emit(STARTUP_CHECK_SIG);
}

// if we're not main module then we're running in jest and it needs to call
// startup
if (require.main === module) {
  startUp();
}
