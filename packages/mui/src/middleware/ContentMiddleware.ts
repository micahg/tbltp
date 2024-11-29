import { Middleware } from "redux";
import axios, { AxiosProgressEvent, AxiosResponse } from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { getToken } from "../utils/auth";
import { ContentReducerError, Scene } from "../reducers/ContentReducer";
import { Rect } from "@micahg/tbltp-common";
import { Asset } from "../reducers/ContentReducer";
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

function isAssetUpdate(payload: File | AssetUpdate): payload is AssetUpdate {
  return (payload as AssetUpdate).asset !== undefined;
}

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

async function updateAsset(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  asset?: Asset,
): Promise<AxiosResponse> {
  const headers = await getToken(state, store);

  try {
    const resp = await axios.put(`${state.environment.api}/asset`, asset, {
      headers: headers,
    });
    return resp;
  } catch (err) {
    throw new Error("Unable to create asset", { cause: err });
  }
}

async function deleteAsset(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  asset: Asset,
): Promise<AxiosResponse> {
  try {
    const url = `${state.environment.api}/asset/${asset._id}`;
    const headers = await getToken(state, store);
    const resp = await axios.delete(url, { headers: headers });
    return resp;
  } catch (err) {
    throw new Error("Unable to delete asset", { cause: err });
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

    switch (action.type) {
      case "content/updateasset":
        {
          const { asset } = action.payload;
          try {
            const result = await updateAsset(state, store, asset);
            next({ type: action.type, payload: result.data });
          } catch (error) {
            let msg = "Unable to create asset";
            if (error instanceof Error) {
              if (axios.isAxiosError(error.cause)) {
                console.log("Asset name already exists");
                if (error.cause.response?.status === 409) {
                  msg = "Asset name already exists";
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
            const msg = "Unable to update asset data";
            const err: ContentReducerError = { msg, success: false };
            next({ type: "content/error", payload: err });
          }
        }
        break;
      case "content/deleteasset": {
        try {
          const { asset } = action.payload as { asset: Asset };
          await deleteAsset(state, store, asset);
          next(action);
        } catch (error) {
          console.error(`Error deleting asset: ${JSON.stringify(error)}`);
          const msg = "Unable to delete asset";
          const err: ContentReducerError = { msg, success: false };
          next({ type: "content/error", payload: err });
        }
        break;
      }
      case "content/assets": {
        const url = `${state.environment.api}/asset`;
        getToken(state, store)
          .then((headers) => axios.get(url, { headers: headers }))
          .then((value) => next({ type: action.type, payload: value.data }))
          .catch((err) =>
            // TODO MICAH display error
            console.error(`Unable to fetch assets: ${JSON.stringify(err)}`),
          );
        break;
      }
      case "content/push":
        {
          const scene: Scene = state.content.currentScene;
          if (!scene) return next(action);
          const url = `${state.environment.api}/state`;
          getToken(state, store)
            .then((headers) =>
              axios.put(url, { scene: scene._id }, { headers: headers }),
            )
            .then(() => {
              action.payload = new Date().getTime();
              next(action);
            })
            .catch((err) => {
              // TODO MICAH DISPLAY ERROR
              console.error(`Unable to update state: ${JSON.stringify(err)}`);
              next(action);
            });
        }
        break;
      case "content/pull":
        {
          const url = `${state.environment.api}/state`;
          getToken(state, store)
            .then((headers) => axios.get(url, { headers: headers }))
            .then((value) => next({ ...action, payload: value.data }))
            .catch((err) => {
              // TODO MICAH display error
              console.error(`Unable to get state: ${JSON.stringify(err)}`);
            });
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
        const url = `${state.environment.api}/scene`;
        getToken(state, store)
          .then((headers) => axios.get(url, { headers: headers }))
          .then((value) => next({ type: action.type, payload: value.data }))
          .catch((err) =>
            console.error(`Unable to fetch scenes: ${JSON.stringify(err)}`),
          );
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
        const url = `${state.environment.api}/scene/${action.payload._id}`;
        getToken(state, store)
          .then((headers) => axios.delete(url, { headers: headers }))
          .then(() => next(action))
          .catch((err) =>
            console.error(`Unable to delet scene: ${JSON.stringify(err)}`),
          );
        break;
      }
      default:
        next(action);
        break;
    }
  };
