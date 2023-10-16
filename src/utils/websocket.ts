import { IncomingMessage, Server } from 'http';
import { Express } from 'express';
import { EventEmitter, WebSocket, WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';

import { ASSETS_UPDATED_SIG } from './constants';

import { log } from "./logger";
import { TableState } from './tablestate';
import { getFakeUser } from './auth';
import { IScene } from '../models/scene';
import { getUserByID } from './user';
import { getOrCreateTableTop } from './tabletop';
import { getSceneById } from './scene';

interface WSStateMessage {
  method?: string,
  state?: TableState,
}

const AUD: string = process.env.AUDIENCE_URL || 'http://localhost:3000/';
const ISS: string = process.env.ISSUER_URL   || 'https://nttdev.us.auth0.com/';
const AUTH_REQURIED: boolean = process.env.DISABLE_AUTH?.toLowerCase() !== "true";
const SOCKET_SESSIONS: Map<string, WebSocket> = new Map();
let PEM: string;


function getVerifiedToken(token: string) {
  if (!AUTH_REQURIED) return { sub: getFakeUser() };
  return verify(token, PEM, { audience: AUD, issuerBaseURL: ISS, tokenSigningAlg: 'RS256' });
}


function verifyConnection(sock: WebSocket, req: IncomingMessage) {
  log.info(`Websocket connection established ${req.socket.remoteAddress}`);
  let jwt;
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const token = parsed.searchParams.get('bearer');
    if (!token) throw new Error('Token not present');
    jwt = getVerifiedToken(token);
  } catch (err) {
    if (Object.prototype.hasOwnProperty.call(err, 'message')) {
      log.error(`WS token fail: ${err.message} (${JSON.stringify(err)})`);
    } else {
      log.error(`WS token fail: ${err}`);
    }
    sock.close();
    return;
  }

  getUserByID(jwt.sub)
    .then(user => {
      // close socket for invalid users
      if (!user) throw new Error('invalid user');
      const userID: string = user._id.toString();
      if (SOCKET_SESSIONS.has(userID)) {
        log.info(`New connection - closing old WS for user ${userID}`);
        SOCKET_SESSIONS.get(userID).close();
        SOCKET_SESSIONS.delete(userID);
      }
      SOCKET_SESSIONS.set(userID, sock);
      sock.on('close', () => SOCKET_SESSIONS.delete(userID));
      return user;
    })
    .then(user => getOrCreateTableTop(user))
    .then(table => {
      if (!table.scene) throw new Error('User has no scene set');
      return getSceneById(table.scene.toString(), table.user.toString())
    })
    .then(scene => {
      const state: TableState = {
        overlay: scene.overlayContent,
        background: scene.tableContent,
        viewport: scene.viewport,
        backgroundSize: scene.backgroundSize,
      };
      const msg: WSStateMessage = {
        'method': 'connection',
        'state': state,
      }
      sock.send(JSON.stringify(msg));
    })
    .catch(err => {
      // TODO MICAH MAYBE SEND THE CLIENT A REASON FOR THE FORCEFUL SHUTDOWN SO THE CLIENT CAN DISPLAY IT?
      // IF YOU DO, MAYBE USE THE CAUSE PROPERTY OF Error AND YOU CAN SEND THAT
      const msg = (Object.prototype.hasOwnProperty.call(err, 'message')) ? err.message : JSON.stringify(err);
      log.error(`Closing websocket due to error: ${msg}`);
      sock.close();
    })
  
  sock.on('message', (buf) => {
    const data = buf.toString();
    log.info(`Received "${data}"`);
  });
}

export function startWSServer(nodeServer: Server, app: Express, pem: string): WebSocketServer {
  log.info('starting websocket server');
  PEM = pem;
  const wss = new WebSocketServer({server: nodeServer});
  const emitter = app as EventEmitter;

  emitter.on(ASSETS_UPDATED_SIG, (update: IScene) => {
    const userID = update.user.toString();
    if (!SOCKET_SESSIONS.has(userID)) return;
    const tableState: TableState = {
      overlay: update.overlayContent,
      background: update.tableContent,
      viewport: update.viewport,
      backgroundSize: update.backgroundSize,
    }
    const sock: WebSocket = SOCKET_SESSIONS.get(userID);
    const msg: WSStateMessage = {
      method: ASSETS_UPDATED_SIG,
      state: tableState,
    }
    log.info(`Sending ${JSON.stringify(msg)}`);
    sock.send(JSON.stringify(msg));
  });

  wss.on('connection', verifyConnection);
  return wss;
}

export function stopWSConnections() {
  for (const sock of SOCKET_SESSIONS.values()) sock.close();
}