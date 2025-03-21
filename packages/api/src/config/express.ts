import * as os from "os";

import { log } from "../utils/logger";
import * as express from "express";
import { Express, NextFunction } from "express";
import * as bodyParser from "body-parser";
import * as multer from "multer";
import { rateLimit } from "express-rate-limit";
import { Server } from "http";
import {
  NO_AUTH_ASSET,
  ALL_SCENES_PATH,
  STATE_ASSET,
  SCENE_PATH,
  SCENE_CONTENT_PATH,
  SCENE_VIEWPORT_PATH,
  ALL_ASSETS_PATH,
  ASSET_DATA_PATH,
  ASSET_PATH,
  ALL_TOKEN_PATH,
  TOKEN_PATH,
  SCENE_TOKEN_PATH,
  TOKEN_INSTANCE_PATH,
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
import { metrics } from "@opentelemetry/api";
import { hrtime } from "process";
import {
  setAssetData,
  listAssets,
  createOrUpdateAsset,
  deleteAsset,
} from "../routes/asset";
import { assetDataValidator, assetValidator } from "../utils/asset";
import { validationResult } from "express-validator";
import {
  deleteSceneValidator,
  getSceneValidator,
  sceneViewportValidator,
} from "../utils/scene";
import { stateValidator } from "../utils/state";
import { tokenDeleteValidator, tokenValidator } from "../utils/token";
import { createOrUpdateToken, deleteToken, listTokens } from "../routes/token";
import {
  createOrUpdateTokenInstance,
  deleteTokenInstance,
  getSceneTokenInstance,
} from "../routes/tokeninstance";
import {
  deleteTokenInstanceValidator,
  sceneTokenInstanceValidator,
  tokenInstanceValidator,
} from "../utils/tokeninstance";

/**
 * Since we can't authorize img HTML tags, allow the token to be passed as a
 * query parameter.
 */
function copyAuthParam(
  req: express.Request,
  _rs: express.Response,
  next: NextFunction,
) {
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

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

function schemaErrorCheck(
  req: express.Request,
  res: express.Response,
  next: NextFunction,
) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.sendStatus(400);
  }
  next();
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

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    limit: 15 * 60 * 1000, // TODO LOWER THIS OVER TIME
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  const jwtCheck = getJWTCheck(noauth);
  const meter = metrics.getMeter("ntt-api");
  const requestCounter = meter.createCounter("request-count");
  const latencyHistogram = meter.createHistogram("request-latency", {
    unit: "ns",
  });

  // add request logging
  app.use((req, res, next) => {
    const start = hrtime.bigint();
    res.on("finish", () => {
      const latency = Number(hrtime.bigint() - start);
      const attribs = {
        method: req.method,
        path: req.route ? req.route.path : req.baseUrl,
        status: res.statusCode,
      };
      latencyHistogram.record(latency, attribs);
      requestCounter.add(1, attribs);
    });
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
    res.header(
      "Access-Control-Expose-Headers",
      "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
    );
    next();
  });

  app.use(limiter);

  // authenticate everything BUT the OPTIONS call
  app.use(
    "/public",
    (req, res, next) => {
      if (req.method === "OPTIONS") res.sendStatus(200);
      else next();
    },
    copyAuthParam,
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
  app.put(
    STATE_ASSET,
    jwtCheck,
    stateValidator(),
    schemaErrorCheck,
    updateState,
  );
  app.put(
    SCENE_VIEWPORT_PATH,
    jwtCheck,
    sceneViewportValidator(),
    schemaErrorCheck,
    updateSceneViewport,
  );
  app.get(
    SCENE_PATH,
    jwtCheck,
    getSceneValidator(),
    schemaErrorCheck,
    getScene,
  );
  app.delete(
    SCENE_PATH,
    jwtCheck,
    deleteSceneValidator(),
    schemaErrorCheck,
    deleteScene,
  );
  app.get(ALL_SCENES_PATH, jwtCheck, getScenes);
  app.put(ALL_SCENES_PATH, jwtCheck, createScene);
  app.put(
    SCENE_CONTENT_PATH,
    jwtCheck,
    upload.single("image"),
    updateSceneContent,
  );
  // fetched by user (jwt) -- no input validation
  app.get(ALL_ASSETS_PATH, jwtCheck, listAssets);
  app.put(
    ALL_ASSETS_PATH,
    jwtCheck,
    assetValidator(),
    schemaErrorCheck,
    createOrUpdateAsset,
  );
  app.delete(
    ASSET_PATH,
    jwtCheck,
    assetDataValidator(),
    schemaErrorCheck,
    deleteAsset,
  );
  app.put(
    ASSET_DATA_PATH,
    jwtCheck,
    upload.single("asset"),
    assetDataValidator(),
    schemaErrorCheck,
    setAssetData,
  );
  app.get(ALL_TOKEN_PATH, jwtCheck, listTokens);
  app.put(
    ALL_TOKEN_PATH,
    jwtCheck,
    tokenValidator(),
    schemaErrorCheck,
    createOrUpdateToken,
  );
  app.delete(
    TOKEN_PATH,
    jwtCheck,
    tokenDeleteValidator(),
    schemaErrorCheck,
    deleteToken,
  );
  app.put(
    SCENE_TOKEN_PATH,
    jwtCheck,
    tokenInstanceValidator(),
    schemaErrorCheck,
    createOrUpdateTokenInstance,
  );
  app.get(
    SCENE_TOKEN_PATH,
    jwtCheck,
    sceneTokenInstanceValidator(),
    schemaErrorCheck,
    getSceneTokenInstance,
  );
  app.delete(
    TOKEN_INSTANCE_PATH,
    jwtCheck,
    deleteTokenInstanceValidator(),
    schemaErrorCheck,
    deleteTokenInstance,
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
