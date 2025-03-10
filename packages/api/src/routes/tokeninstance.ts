import { NextFunction, Request, Response } from "express";
import { knownMongoError } from "../utils/errors";
import { getOrCreateUser } from "../utils/user";
import { log } from "../utils/logger";
import { getUserToken } from "../utils/token";
import { getUserScene } from "../utils/scene";
import {
  createUserTokenInstance,
  deleteUserTokenInstance,
  getSceneTokenInstances,
  getUserTokenInstance,
  updateTokenInstance,
} from "../utils/tokeninstance";
import { ITokenInstance } from "../models/tokeninstance";

export async function createOrUpdateTokenInstance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const tokenPromise = getUserToken(user, req.body.token);
    const scenePromise = getUserScene(user, req.params.id);
    if ("_id" in req.body) {
      const tokenInstancePromise = getUserTokenInstance(user, req.body._id);
      const [tokenInstance, token, scene] = await Promise.all([
        tokenInstancePromise,
        tokenPromise,
        scenePromise,
      ]);
      if (!tokenInstance || !token || !scene) {
        return res.status(404).send();
      }
      const instance = await updateTokenInstance(tokenInstance, req.body);
      return res.status(200).json(instance);
    } else {
      const [token, scene] = await Promise.all([tokenPromise, scenePromise]);
      if (!token || !scene) {
        return res.status(404).send();
      }

      const instance: ITokenInstance = await createUserTokenInstance(user, {
        ...req.body,
        scene: req.params.id,
      });
      return res.status(201).json(instance);
    }
  } catch (err) {
    if (knownMongoError(err, next)) return;
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}

export async function getSceneTokenInstance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const tokenInstances = await getSceneTokenInstances(user, req.params.id);
    return res.json(tokenInstances);
  } catch (err) {
    if (knownMongoError(err, next)) return;
    log.error(`Unable to get asset: ${err.message}`);
    next({ status: err.cause || 500 });
  }
}

export async function deleteTokenInstance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const result = await deleteUserTokenInstance(user, req.params.id);
    if (!result || result.deletedCount === 0) {
      return res.status(404).send();
    }
    return res.status(204).send();
  } catch (err) {
    if (knownMongoError(err, next)) return;
    log.error(`Unable to delete asset: ${err.message}`);
    next({ status: err.cause || 500 });
  }
}
