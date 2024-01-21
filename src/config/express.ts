import * as os from "os";

import { log } from "../utils/logger";

import * as express from "express";
import { Express, NextFunction } from "express";
import * as bodyParser from "body-parser";
import * as multer from "multer";
import { Server } from "http";
import {
  NO_AUTH_ASSET,
  ALL_SCENES_PATH,
  STATE_ASSET,
  SCENE_PATH,
  SCENE_CONTENT_PATH,
  SCENE_VIEWPORT_PATH,
} from "../utils/constants";
import { getState, updateState } from "../routes/state";

import { auth } from "express-oauth2-jwt-bearer";
import {
  createScene,
  deleteScene,
  getScene,
  getScenes,
  updateSceneContent,
  updateSceneViewport,
} from "../routes/scene";
import { getFakeUser } from "../utils/auth";

function getJWTCheck(noauth: boolean) {
  const aud: string = process.env.AUDIENCE_URL || "http://localhost:3000/";
  const iss: string = process.env.ISSUER_URL || "https://nttdev.us.auth0.com/";

  if (noauth) {
    log.warn("Authenticaiton disabled");
  }

  // without auth stub out the normally needed fields so we don't have to
  // handle unauthenticated requests specially. Otherwise, let auth0 populate
  // the JWT authentication token claims.
  return noauth
    ? (req: express.Request, _rs: express.Response, next: NextFunction) => {
        req.auth = {
          payload: {
            sub: getFakeUser(),
          },
          header: null,
          token: null,
        };
        return next();
      }
    : auth({
        audience: aud,
        issuerBaseURL: iss,
        tokenSigningAlg: "RS256",
      });
}

/**
 * Create the express middleware.
 * @returns an express app.
 */
export function create(): Express {
  const noauth: boolean = process.env.DISABLE_AUTH?.toLowerCase() === "true";
  const app = express();

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  const jwtCheck = getJWTCheck(noauth);

  // add request logging
  app.use((req, res, next) => {
    res.on("finish", () =>
      log.info("processed", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
      }),
    );
    next();
  });

  // TODO FIX environment specific cors headers
  app.use((_req, res, next) => {
    // TODO FIX THIS (DEV ONLY)
    res.header("Access-Control-Allow-Origin", "*");
    // TODO FIX THIS (DEV ONLY)
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Content-Length, Accept, Authorization, Spoof-UID",
    );
    // TODO FIX THIS (DEV ONLY)!
    res.header(
      "Access-Control-Allow-Methods",
      "POST, PUT, PATCH, GET, OPTIONS, DELETE",
    );
    next();
  });

  // authenticate everything BUT the OPTIONS call
  app.use(
    "/public",
    (req, res, next) => {
      if (req.method === "OPTIONS") res.sendStatus(200);
      else next();
    },
    jwtCheck,
    express.static("public"),
  );

  const destdir: string = os.tmpdir();
  const upload: multer.Multer = multer({ dest: destdir });
  // this is just for local testing -- ingress-nginx should handle IRL
  // const upload: multer.Multer = multer({
  //   dest: destdir,
  //   limits: { fileSize: 8388608 },
  // });

  app.get(NO_AUTH_ASSET, (_req, res) =>
    res.status(200).send({ noauth: noauth }),
  );
  app.get(STATE_ASSET, jwtCheck, getState);
  app.put(STATE_ASSET, jwtCheck, updateState);
  app.put(SCENE_VIEWPORT_PATH, jwtCheck, updateSceneViewport);
  app.get(SCENE_PATH, jwtCheck, getScene);
  app.delete(SCENE_PATH, jwtCheck, deleteScene);
  app.get(ALL_SCENES_PATH, jwtCheck, getScenes);
  app.put(ALL_SCENES_PATH, jwtCheck, createScene);
  app.put(
    SCENE_CONTENT_PATH,
    jwtCheck,
    upload.single("image"),
    updateSceneContent,
  );

  // handle errors
  app.use((err, req, res, next) => {
    if (!err) next();
    if (err.status) return res.sendStatus(err.status);
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.sendStatus(413);
      }
    }

    // generic in-app exception handling
    if (err.cause) {
      log.error(`${req.method} ${req.path} failed`, {
        status: err.cause,
        err: err.message,
      });
      return res.sendStatus(err.cause);
    }
    log.error(`Unexpected Error: ${err.message}`);
    res.sendStatus(500);
    next();
  });

  return app;
}

export function listen(app: express.Express): Server {
  return app.listen(3000, () => {
    log.info(`Listening on port 3000`);
  });
}
