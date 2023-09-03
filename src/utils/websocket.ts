import { IncomingMessage, Server } from 'http';
import { Express } from 'express';
import { EventEmitter, WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';

import { ASSETS_UPDATED_SIG } from './constants';

import { log } from "./logger";
import { getTableState, TableState } from './tablestate';

interface WSStateMessage {
  method?: string,
  state?: TableState,
}

const AUTH_REQURIED: boolean = process.env.DISABLE_AUTH?.toLowerCase() !== "true";

export function startWSServer(nodeServer: Server, app: Express, pem: string) {
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

  const aud: string = process.env.AUDIENCE_URL || 'http://localhost:3000/';
  const iss: string = process.env.ISSUER_URL   || 'https://nttdev.us.auth0.com/';

  wss.on('connection', (sock: WebSocket, req: IncomingMessage) => {
    log.info(`Websocket connection established ${req.socket.remoteAddress}`);
    if (AUTH_REQURIED) {
      try {
        const parsed = new URL(req.url, `http://${req.headers.host}`);
        const token = parsed.searchParams.get('bearer');
        if (!token) throw new Error('Token not present');
        // returns decoded token BUT more importantly raises exception on failure
        verify(token, pem, { audience: aud, issuerBaseURL: iss, tokenSigningAlg: 'RS256' })
      } catch (err) {
        if (err.hasOwnProperty('message')) {
          log.error(`WS token fail: ${err.message} (${JSON.stringify(err)})`);
        } else {
          log.error(`WS token fail: ${err}`);
        }
        sock.close();
        return;
      }
    }
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