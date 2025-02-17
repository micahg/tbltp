import { Middleware } from "redux";
import axios, { AxiosProgressEvent, AxiosResponse } from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { getToken } from "../utils/auth";
import { ContentReducerError } from "../reducers/ContentReducer";
import { Scene, Asset, Rect, Token, TokenInstance } from "@micahg/tbltp-common";
import { AnyAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import { LoadProgress } from "../utils/content";

export interface ViewportBundle {
  backgroundSize?: Rect;
  viewport?: Rect;
  angle?: number;
}

export interface NewSceneBundle {
  description: string;
  player: File;
  detail?: File;
  viewport?: ViewportBundle;
  playerProgress: (evt: LoadProgress) => void;
  detailProgress: (evt: LoadProgress) => void;
}

export interface AssetUpdate {
  asset: File;
  progress?: (evt: AxiosProgressEvent) => void;
}

interface SceneUpdate {
  scene: string;
}

function isAssetUpdate(payload: File | AssetUpdate): payload is AssetUpdate {
  return (payload as AssetUpdate).asset !== undefined;
}

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

type Operation = "get" | "put" | "delete";

type OperationType = Asset | Token | SceneUpdate | TokenInstance;

const FriendlyOperation: { [key in Operation]: string | undefined } = {
  get: undefined,
  put: "Update succesfull",
  delete: "Deletion successful",
};

function inferPath(op: Operation, path: string, t: OperationType): string {
  // no id for get, put expects an id in the body (or its a new entity)
  return op === "delete" && t !== undefined && "_id" in t
    ? `${path}/${t._id}`
    : path;
}
async function request<T extends OperationType>(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  op: Operation,
  t: T,
  basePath: string,
): Promise<AxiosResponse> {
  const path = inferPath(op, basePath, t);
  const url = `${state.environment.api}/${path}`;
  const headers = await getToken(state, store);
  let fn;
  if (op === "put") {
    fn = axios[op](url, t, {
      headers: headers,
    });
  } else fn = axios[op](url, { headers: headers });

  try {
    const resp = await fn;
    return resp;
  } catch (err) {
    throw new Error(`Unable to ${op} ${basePath}`, { cause: err });
  }
}

async function operate<T extends OperationType>(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  next: Dispatch<AnyAction>,
  op: Operation,
  path: string,
  action: unknown & { type: string; payload: T },
) {
  try {
    const result = await request(state, store, op, action.payload, path);
    next({
      type: action.type,
      payload: result.status === 204 ? action.payload : result.data,
    });
    const msg = FriendlyOperation[op];
    if (msg) {
      const err: ContentReducerError = {
        msg: msg,
        success: true,
      };
      next({ type: "content/error", payload: err });
    }
  } catch (error) {
    let msg = `Unable to ${op} ${path}`;
    if (error instanceof Error) {
      if (axios.isAxiosError(error.cause)) {
        console.error(`Operation failure: ${JSON.stringify(error.cause)}`);
        if (error.cause.response) {
          const status = error.cause.response.status;
          if (status === 409) {
            msg = `${path} name already exists`;
          } else if (status >= 500) {
            const b64err = window.btoa(
              error.stack ? error.stack : error.toString(),
            );
            window.location.href = `/unavailable?error=${b64err}`;
          }
        }
      }
    }
    const err: ContentReducerError = {
      msg: msg,
      success: false,
    };
    next({ type: "content/error", payload: err });
  }
}

async function updateAssetData(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  id: string,
  file: File,
  progress?: (evt: LoadProgress) => void,
): Promise<AxiosResponse> {
  const formData = new FormData();
  formData.append("asset", file as Blob);
  const headers = await getToken(state, store);
  headers["Content-Type"] = "multipart/form-data";
  try {
    const resp = await axios.put(
      `${state.environment.api}/asset/${id}/data`,
      formData,
      {
        headers: headers,
        onUploadProgress: (e) =>
          progress?.({ progress: e.progress || 0, img: "" }),
      },
    );
    return resp;
  } catch (err) {
    console.error(`Unable to upload asset: ${JSON.stringify(err)}`);
    throw new Error("Unable to upload asset", { cause: err });
  }
}

function sendFile(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  scene: Scene,
  blob: File | URL,
  layer: string,
  progress?: (evt: LoadProgress) => void,
): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {
    const url = `${state.environment.api}/scene/${scene._id}/content`;
    const formData = new FormData();
    const contentType: string = isBlob(blob)
      ? blob.type
      : "multipart/form-data";
    const content: Blob | string = isBlob(blob)
      ? (blob as Blob)
      : blob.toString();
    formData.append("layer", layer);
    formData.append("image", content);

    getToken(state, store, { "Content-Type": contentType })
      .then((headers) =>
        axios.put(url, formData, {
          headers: headers,
          onUploadProgress: (e) =>
            progress?.({ progress: e.progress || 0, img: layer }),
        }),
      )
      .then((value) => resolve(value))
      .catch((err) => {
        // tack on the scene
        err.scene = scene;
        reject(err);
      });
  });
}

function setViewport(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  scene: Scene,
  viewport: ViewportBundle,
) {
  const url = `${state.environment.api}/scene/${scene._id}/viewport`;
  return getToken(state, store).then((headers) =>
    axios.put(url, viewport, { headers: headers }),
  );
}

export const ContentMiddleware: Middleware =
  (store) => (next) => async (action) => {
    const state = store.getState();
    if (!state.environment.api) {
      console.error("No API URL in environment state.");
      return next(action);
    }

    if (!state.content.mediaPrefix) {
      // I suppose when we use R2 or S3, this will be different (and likely from the environment config)
      next({ type: "content/mediaprefix", payload: state.environment.api });
    }

    switch (action.type) {
      case "content/updatetoken": {
        operate(state, store, next, "put", "token", action);
        break;
      }
      case "content/deletetoken": {
        operate(state, store, next, "delete", "token", action);
        break;
      }
      case "content/scenetokens": {
        const path = `scene/${action.payload.scene}/token`;
        operate(state, store, next, "get", path, action);
        break;
      }
      case "content/scenetokenplaced": {
        const path = `scene/${action.payload.scene}/token`;
        operate(state, store, next, "put", path, action);
        break;
      }
      case "content/scenetokendeleted": {
        operate(state, store, next, "delete", `tokeninstance`, action);
        break;
      }
      case "content/updateasset":
        operate(state, store, next, "put", "asset", action);
        break;
      case "content/updateassetdata":
        {
          const { id, file, progress } = action.payload;
          try {
            const result = await updateAssetData(
              state,
              store,
              id,
              file,
              progress,
            );
            next({ type: action.type, payload: result.data });
          } catch (error) {
            console.error(
              `Error updating asset data: ${JSON.stringify(error)}`,
            );
            let msg = "Unable to update asset data";
            if (error instanceof Error && axios.isAxiosError(error.cause)) {
              if (error.cause.response?.status === 413) {
                msg = "Asset too big";
              }
              if (error.cause.response?.status === 406) {
                msg = "Invalid asset format";
              }
            }
            const err: ContentReducerError = { msg, success: false };
            next({ type: "content/error", payload: err });
          }
        }
        break;
      case "content/deleteasset": {
        operate(state, store, next, "delete", "asset", action);
        break;
      }
      case "content/tokens": {
        operate(state, store, next, "get", "token", action);
        break;
      }
      case "content/assets": {
        operate(state, store, next, "get", "asset", action);
        break;
      }
      case "content/push":
        {
          /**
           * The ContentEditor doesn't actually tell us anything
           * about the scene, just which scene we're pushing. The overlay or
           * background updates independently, and this call just refreshes the
           * tabletop with the current scene so the remote display is updated.
           */
          const scene: Scene = state.content.currentScene;
          if (!scene) return next(action);
          if (!scene._id) return next(action);
          const upd: SceneUpdate = { scene: scene._id };
          operate(state, store, next, "put", "state", {
            ...action,
            payload: upd,
          });
        }
        break;
      case "content/pull":
        {
          operate(state, store, next, "get", "state", action);
        }
        break;
      case "content/player":
      case "content/detail":
      case "content/overlay": {
        // undefined means we're wiping the canvas... probably a new background
        if (action.payload === undefined) return next(action);
        let asset = action.payload;
        let progress;
        if (isAssetUpdate(action.payload)) {
          asset = action.payload.asset;
          progress = action.payload.progress;
        } else {
          asset = action.payload;
        }

        const scene: Scene = state.content.currentScene;
        // if we have an overlay payload then send it
        sendFile(
          state,
          store,
          scene,
          asset,
          action.type.split("/")[1],
          progress,
        )
          .then((value) => {
            // MICAH this is being triggered by "content/overlay" and triggering a rerender
            next({ type: "content/scene", payload: value.data });
            const err: ContentReducerError = {
              msg: "Update successful",
              success: true,
            };
            next({ type: "content/error", payload: err });
          })
          .catch((err) => {
            const error: ContentReducerError = {
              msg: "Unkown error happened",
              success: false,
            };
            if (err.response.status === 413) {
              error.msg = "Asset too big";
              next({ type: "content/error", payload: error });
            }
          });
        break;
      }
      case "content/zoom": {
        if (action.payload === undefined) return;
        const scene = state.content.currentScene;
        if (!scene) return next(action);
        setViewport(state, store, scene, action.payload)
          .then((value) => next({ type: "content/scene", payload: value.data }))
          .catch((err) =>
            console.error(`Unable to update viewport: ${JSON.stringify(err)}`),
          );
        break;
      }
      case "content/scenes": {
        operate(state, store, next, "get", "scene", action);
        break;
      }
      case "content/createscene": {
        const url = `${state.environment.api}/scene`;
        const bundle: NewSceneBundle = action.payload;
        getToken(state, store)
          .then((headers) => axios.put(url, bundle, { headers: headers }))
          .then((data) => {
            next({ type: "content/scene", payload: data.data });
            const asset = bundle.player;
            const progress = bundle.playerProgress;
            return sendFile(state, store, data.data, asset, "player", progress);
          })
          .then((data) => {
            if (!bundle.detail) return data; // skip if there is no detailed view
            next({ type: "content/scene", payload: data.data });
            const asset = bundle.detail;
            const progress = bundle.detailProgress;
            return sendFile(state, store, data.data, asset, "detail", progress);
          })
          .then((data) =>
            bundle.viewport
              ? setViewport(state, store, data.data, bundle.viewport)
              : data,
          )
          .then((data) => {
            next({ type: "content/scene", payload: data.data });
            const err: ContentReducerError = {
              msg: "Update successful",
              success: true,
            };
            next({ type: "content/error", payload: err });
          })
          .catch((err) => {
            const error: ContentReducerError = {
              msg: "Unkown error happened",
              success: false,
            };
            if (err.response.status === 413) {
              error.msg = "Asset too big";
            }
            if (err.response.status === 406) {
              error.msg = "Invalid asset format";
            }
            next({ type: "content/error", payload: error });
            if (err.scene) {
              // delete the failed scene and set the current scene to nothing
              store.dispatch({
                type: "content/deletescene",
                payload: err.scene,
              });
              store.dispatch({ type: "content/currentscene" });
            }
          });
        break;
      }
      case "content/deletescene": {
        operate(state, store, next, "delete", "scene", action);
        break;
      }
      default:
        next(action);
        break;
    }
  };
