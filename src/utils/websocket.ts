import { Server } from 'http';
import { Express } from 'express';
import { EventEmitter, WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { ASSET_UPDATED_SIG } from './constants';

import { log } from "./logger";

export interface LayerUpdate {
  layer: string,
  path: string,
}

export function startWSServer(nodeServer: Server, app: Express) {
  log.info('starting websocket server');
  let wss = new WebSocketServer({server: nodeServer});
  let emitter = app as EventEmitter;

  emitter.on(ASSET_UPDATED_SIG, (update: LayerUpdate) => {
    wss.clients.forEach((sock:WebSocket) => {
      let msg = {
        'method': ASSET_UPDATED_SIG,
        'layer': update.layer, 
        'path': update.path,
      }
      console.log(`Sending ${JSON.stringify(msg)}`)
      sock.send(JSON.stringify(msg));
    });
  });

  wss.on('connection', (sock: WebSocket, req) => {
    log.info(`Websocket connection established ${req.socket.remoteAddress}`);
    let msgJS = {
      'method': 'connection',
      'overlay': 'overlay.png',
    }
    sock.send(JSON.stringify(msgJS));
    sock.on('message', (buf) => {
      let data = buf.toString();
      log.info(`Received "${data}"`);
      sock.send('hey yourself');
    });
  });
  return wss;
}