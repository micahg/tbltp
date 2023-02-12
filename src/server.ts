import { Server } from 'http';
import { WebSocketServer } from 'ws';

import { log } from "./utils/logger";

import * as expressConfig from "./config/express";

const STARTUP_CHECK_SIG = "startup_check";
const STARTUP_DONE_SIG = "startup_done";

log.info(`System starting in ${process.env.NODE_ENV}`);

let app = expressConfig.create();

// defer listening for requests until we receive an event to check for startup conditions
// events are emitted when a precondition is satisfied (eg: connecton to the db)
const serverPromise = new Promise<Server>((resolve, reject) => {
  app.on(STARTUP_CHECK_SIG, () => {
    let srvr: Server = expressConfig.listen(app);
    // log.info('starting websocket server');
    // let wss = new WebSocketServer({server: srvr});
    // wss.on('connection', (sock, req) => {
    //   log.info(`Websocket connection established ${req.socket.remoteAddress}`);

    //   sock.on('message', (buf) => {
    //     let data = buf.toString();
    //     log.info(`Received "${data}"`);
    //     sock.send('hey yourself');
    //   });
    // });
    resolve(srvr);
  });
});

// normally this goes when some async task is done (db connection for example)
app.emit(STARTUP_CHECK_SIG);

// TODO for unit testing probably export a promise that returns server instead.
export default serverPromise;