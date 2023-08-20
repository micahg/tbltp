import * as os from "os";

import { log } from "../utils/logger";

import * as express from "express";
import * as bodyParser from "body-parser";
import * as multer from "multer";
import { Server } from 'http';
import { updateAsset } from "../routes/asset";
import { NO_AUTH_ASSET, PATH_ASSET, STATE_ASSET, VIEWPORT_ASSET } from "../utils/constants";
import { getState, updateState } from "../routes/state";
import { setViewPort } from "../routes/viewport";

import { auth } from "express-oauth2-jwt-bearer";


/**
 * Create the express middleware.
 * @returns an express app.
 */
export function create(): express.Express {
  let app = express();

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));

  const noauth: boolean = process.env.DISABLE_AUTH === "true";
  const jwtCheck = noauth ? (_rq: any, _rs: any, next: express.NextFunction) => {
    log.warn("authentication diabled");
    next();
  } : auth({
    audience: 'http://localhost:3000/',
    issuerBaseURL: 'https://nttdev.us.auth0.com/',
    tokenSigningAlg: 'RS256'
  });

  // TODO FIX environment specific cors headers
  app.use((_req, res, next) => {
    // TODO FIX THIS (DEV ONLY)
    res.header("Access-Control-Allow-Origin", "*");
    // TODO FIX THIS (DEV ONLY)
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Content-Length, Accept, Authorization, Spoof-UID");
    // TODO FIX THIS (DEV ONLY)!
    res.header("Access-Control-Allow-Methods", "POST, PUT, PATCH, GET, OPTIONS, DELETE");
    next();
  });

  app.use(express.static('public'));

  let destdir: string = os.tmpdir();
  let upload:multer.Multer = multer({dest: destdir});

  app.get(NO_AUTH_ASSET,            (_req, res) => res.status(200).send({noauth: noauth}));
  app.put(PATH_ASSET,     jwtCheck, upload.single('image'), updateAsset);
  app.get(STATE_ASSET,    jwtCheck, getState);
  app.put(STATE_ASSET,    jwtCheck, updateState);
  app.put(VIEWPORT_ASSET, jwtCheck, setViewPort);

  return app;
}

export function listen(app: express.Express): Server {
  return app.listen(3000, () => {
    log.info(`Listening on port 3000`);
  });
}