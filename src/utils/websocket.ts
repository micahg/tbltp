import { IncomingMessage, Server } from "http";
import { Express } from "express";
import { EventEmitter, WebSocket, WebSocketServer } from "ws";
import { verify } from "jsonwebtoken";

import {
  ASSETS_UPDATED_SIG,
  WS_INVALID_TOKEN,
  WS_INVALID_USER,
  WS_NO_SCENE,
} from "./constants";

import { log } from "./logger";
import { TableState } from "./tablestate";
import { getFakeUser } from "./auth";
import { IScene } from "../models/scene";
import { getUserByID } from "./user";
import { getOrCreateTableTop } from "./tabletop";
import { getSceneById } from "./scene";

interface WSStateMessage {
  method?: string;
  info?: string;
  state?: TableState;
}

const READ_TIMEOUT = parseInt(process.env.WS_READ_TIMEOUT) || 60;
const SEND_TIMEOUT = parseInt(process.env.WS_SEND_TIMEOUT) || 60;
const PING_TIMER = (Math.min(READ_TIMEOUT, SEND_TIMEOUT) - 1) * 1000;

const AUD: string = process.env.AUDIENCE_URL || "http://localhost:3000/";
const ISS: string = process.env.ISSUER_URL || "https://nttdev.us.auth0.com/";
const AUTH_REQURIED: boolean =
  process.env.DISABLE_AUTH?.toLowerCase() !== "true";
const SOCKET_SESSIONS: Map<string, WebSocket> = new Map();
let PEM: string;

function closeSocketWithError(sock: WebSocket, msg: string, err: string) {
  log.error(`Closing websocket due to error: ${msg}`);
  if (err) sock.send(JSON.stringify({ method: "error", info: err }));
  sock.close();
}

function getVerifiedToken(token: string) {
  if (!AUTH_REQURIED) return { sub: getFakeUser() };
  if (!token) throw new Error("Token not present");
  return verify(token, PEM, {
    audience: AUD,
    issuerBaseURL: ISS,
    tokenSigningAlg: "RS256",
  });
}

function verifyConnection(sock: WebSocket, req: IncomingMessage) {
  log.info(`Websocket connection established ${req.socket.remoteAddress}`);
  let jwt;
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const token = parsed.searchParams.get("bearer");
    jwt = getVerifiedToken(token);
  } catch (err) {
    let msg: string;
    if (Object.prototype.hasOwnProperty.call(err, "message")) {
      msg = `WS token fail: ${err.message} (${JSON.stringify(err)})`;
    } else {
      msg = `WS token fail: ${err}`;
    }
    closeSocketWithError(sock, msg, WS_INVALID_TOKEN);
    return;
  }

  getUserByID(jwt.sub)
    .then((user) => {
      // close socket for invalid users
      if (!user) throw new Error("invalid user", { cause: WS_INVALID_USER });
      const userID: string = user._id.toString();
      if (SOCKET_SESSIONS.has(userID)) {
        log.info(`New connection - closing old WS for user ${userID}`);
        SOCKET_SESSIONS.get(userID).close();
        SOCKET_SESSIONS.delete(userID);
      }
      SOCKET_SESSIONS.set(userID, sock);
      sock.on("close", () => {
        SOCKET_SESSIONS.delete(userID);
        log.info(`Total websocket connections ${SOCKET_SESSIONS.size}`);
      });
      return user;
    })
    .then((user) => getOrCreateTableTop(user))
    .then((table) => {
      if (!table.scene)
        throw new Error("User has no scene set", { cause: WS_NO_SCENE });
      return getSceneById(table.scene.toString(), table.user.toString());
    })
    .then((scene) => {
      const state: TableState = {
        overlay: scene.overlayContent,
        background: scene.playerContent,
        viewport: scene.viewport,
        backgroundSize: scene.backgroundSize,
        angle: scene.angle || 0,
      };
      const msg: WSStateMessage = {
        method: "connection",
        state: state,
      };
      // make sure we don't get shut down on the next interval
      sock["live"] = true;
      // sock.on("pong", () => (sock["live"] = true));
      sock.on("pong", () => {
        log.info("pong received DELETE ME");
        sock["live"] = true;
      });
      sock.send(JSON.stringify(msg));
    })
    .catch((err) => {
      const msg = Object.prototype.hasOwnProperty.call(err, "message")
        ? err.message
        : JSON.stringify(err);
      const reason = Object.prototype.hasOwnProperty.call(err, "cause")
        ? err.cause
        : null;
      closeSocketWithError(sock, msg, reason);
    });

  sock.on("message", (buf) => {
    const data = buf.toString();
    log.info(`Received "${data}"`);
  });
}

export function startWSServer(
  nodeServer: Server,
  app: Express,
  pem: string,
): WebSocketServer {
  log.info("Starting websocket server");
  PEM = pem;
  const wss = new WebSocketServer({ server: nodeServer });
  const emitter = app as EventEmitter;

  emitter.on(ASSETS_UPDATED_SIG, (update: IScene) => {
    const userID = update.user.toString();
    if (!SOCKET_SESSIONS.has(userID)) return;
    const tableState: TableState = {
      overlay: update.overlayContent,
      background: update.playerContent,
      viewport: update.viewport,
      backgroundSize: update.backgroundSize,
      angle: update.angle || 0,
    };
    const sock: WebSocket = SOCKET_SESSIONS.get(userID);
    const msg: WSStateMessage = {
      method: ASSETS_UPDATED_SIG,
      state: tableState,
    };
    log.info(`Sending ${JSON.stringify(msg)}`);
    sock.send(JSON.stringify(msg));
  });

  wss.on("connection", verifyConnection);
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ("live" in ws && !ws["live"]) return ws.terminate();
      ws["live"] = false;
      ws.ping();
    });
  }, PING_TIMER);
  wss.on("close", () => {
    clearInterval(interval);
    log.warn("Forcefully terminating remaining websocket connections...");
    wss.clients.forEach((ws) => ws.close());
  });
  log.info("Websocket server started");
  return wss;
}

export function stopWSConnections() {
  for (const sock of SOCKET_SESSIONS.values()) sock.close();
}
