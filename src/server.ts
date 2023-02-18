import { fstat, mkdir } from 'node:fs';
import { Server } from 'http';
import { WebSocketServer } from 'ws';

import { log } from "./utils/logger";

import * as expressConfig from "./config/express";
import { startWSServer } from './utils/websocket';
import { STARTUP_CHECK_SIG, STARTUP_DONE_SIG } from './utils/constants';



log.info(`System starting in ${process.env.NODE_ENV}`);

let app = expressConfig.create();

// defer listening for requests until we receive an event to check for startup conditions
// events are emitted when a precondition is satisfied (eg: connecton to the db)
const serverPromise = new Promise<Server>((resolve, reject) => {
  app.on(STARTUP_CHECK_SIG, () => {

    // presumably the dir was created and we don't need to check for it.
    let srvr: Server = expressConfig.listen(app);
    let wss = startWSServer(srvr, app);
    app.emit(STARTUP_DONE_SIG);
    resolve(srvr);
  });
});

log.info(`Create public resources folder...`);
mkdir('public', {recursive: true}, (err, path) => {
  if (err) {
    log.error(`Unable to create public folder: ${JSON.stringify(err)}`);
    process.exit(1);
  }
  log.info(`Created public asset path`);
  app.emit(STARTUP_CHECK_SIG);
});


// TODO for unit testing probably export a promise that returns server instead.
export default serverPromise;