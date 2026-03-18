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
import { TableState } from "../models/tablestate";
import { getFakeUser } from "./auth";
import { IScene } from "../models/scene";
import { getUserByID } from "./user";
import { getOrCreateTableTop } from "./tabletop";
import { getUserScene } from "./scene";
import { getSceneTokenInstances } from "./tokeninstance";
import { HydratedTokenInstance } from "@micahg/tbltp-common";
import { hydrateStateToken } from "../routes/state";
import { getUserAsset } from "./asset";
import { IUser } from "../models/user";

interface WSStateMessage {
  method?: string;
  info?: string;
  state?: TableState;
}

type SceneLayer = "overlay" | "player";

function getSceneLayerFields(layer: SceneLayer) {
  if (layer === "overlay") {
    return {
      idField: "overlayId" as const,
      contentField: "overlayContent" as const,
      revField: "overlayContentRev" as const,
    };
  }
  return {
    idField: "playerId" as const,
    contentField: "playerContent" as const,
    revField: "playerContentRev" as const,
  };
}

async function resolveSceneLayerState(
  user: IUser,
  scene: IScene,
  layer: SceneLayer,
) {
  const { idField, contentField, revField } = getSceneLayerFields(layer);
  const assetId = scene[idField]?.toString();

  if (assetId) {
    const asset = await getUserAsset(user, assetId);
    if (asset?.location) {
      return {
        content: asset.location,
        revision: asset.revision,
      };
    }
  }

  return {
    content: scene[contentField],
    revision: scene[revField],
  };
}

async function buildTableState(
  user: IUser,
  scene: IScene,
  tokens: HydratedTokenInstance[],
): Promise<TableState> {
  const [overlay, player] = await Promise.all([
    resolveSceneLayerState(user, scene, "overlay"),
    resolveSceneLayerState(user, scene, "player"),
  ]);

  return {
    overlay: overlay.content,
    overlayRev: overlay.revision,
    background: player.content,
    backgroundRev: player.revision,
    viewport: scene.viewport,
    backgroundSize: scene.backgroundSize,
    angle: scene.angle || 0,
    tokens: tokens,
  };
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

async function verifyConnection(sock: WebSocket, req: IncomingMessage) {
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

  try {
    // get and validate the user
    const user = await getUserByID(jwt.sub);
    if (!user) throw new Error("invalid user", { cause: WS_INVALID_USER });

    // cleanup old sockets for the user
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

    // get and validate the table
    const table = await getOrCreateTableTop(user);
    if (!table.scene)
      throw new Error("User has no scene set", { cause: WS_NO_SCENE });

    const sceneId = table.scene.toString();
    const tokenPromise = getSceneTokenInstances(user, sceneId, true);
    const scenePromise = getUserScene(user, sceneId);
    const [scene, tokens] = await Promise.all([scenePromise, tokenPromise]);

    const hydrated = await hydrateStateToken(user, scene, tokens, true);

    const state: TableState = await buildTableState(user, scene, hydrated);
    const msg: WSStateMessage = {
      method: "connection",
      state: state,
    };

    // make sure we don't get shut down on the next interval
    sock["live"] = true;
    sock.on("pong", () => (sock["live"] = true));
    sock.send(JSON.stringify(msg));
  } catch (err) {
    const msg = Object.prototype.hasOwnProperty.call(err, "message")
      ? err.message
      : JSON.stringify(err);
    const reason = Object.prototype.hasOwnProperty.call(err, "cause")
      ? err.cause
      : null;
    closeSocketWithError(sock, msg, reason);
  }

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

  emitter.on(
    ASSETS_UPDATED_SIG,
    async (scene: IScene, tokens: HydratedTokenInstance[]) => {
      try {
        const userID = scene.user.toString();
        if (!SOCKET_SESSIONS.has(userID)) return;
        const user = await getUserByID(userID);
        if (!user) {
          log.warn(`Unable to resolve websocket state: missing user ${userID}`);
          return;
        }

        const tableState: TableState = await buildTableState(
          user,
          scene,
          tokens,
        );
        const sock: WebSocket = SOCKET_SESSIONS.get(userID);
        const msg: WSStateMessage = {
          method: ASSETS_UPDATED_SIG,
          state: tableState,
        };
        sock.send(JSON.stringify(msg));
      } catch (err) {
        log.error("Unable to broadcast websocket update", err);
      }
    },
  );

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
