import { Server } from 'http';
import { Express } from 'express';
import { EventEmitter, WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { ASSETS_UPDATED_SIG } from './constants';

import { log } from "./logger";
import { getTableState, TableState } from './tablestate';

interface WSStateMessage {
  method?: string,
  state?: TableState,
}

export function startWSServer(nodeServer: Server, app: Express) {
  log.info('starting websocket server');
  let wss = new WebSocketServer({server: nodeServer});
  let emitter = app as EventEmitter;

  emitter.on(ASSETS_UPDATED_SIG, (update: TableState) => {
    wss.clients.forEach((sock:WebSocket) => {
      let msg: WSStateMessage = {
        'method': ASSETS_UPDATED_SIG,
        'state': update,
      }
      console.log(`Sending ${JSON.stringify(msg)}`)
      sock.send(JSON.stringify(msg));
    });
  });

  wss.on('connection', (sock: WebSocket, req) => {
    log.info(`Websocket connection established ${req.socket.remoteAddress}`);
    let state: TableState = getTableState();
    // don't send a partial display without overlay by accident
    if (state.overlay === null) {
      state = null;
    }
    let msg: WSStateMessage = {
      'method': 'connection',
      'state': state,
    }
    sock.send(JSON.stringify(msg));
    sock.on('message', (buf) => {
      let data = buf.toString();
      log.info(`Received "${data}"`);
    });
  });
  return wss;
}