import { Middleware } from "redux";
import axios, { AxiosProgressEvent, AxiosResponse } from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { getAuthHeaders } from "../utils/authBridge";
import { Asset, Rect, Token, TokenInstance } from "@micahg/tbltp-common";
import { AnyAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import { environmentApi } from "../api/environment";
import { ratelimit } from "../slices/rateLimitSlice";
import { EditorUiError, setError } from "../slices/editorUiSlice";

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

type Operation = "get" | "put" | "delete";

type OperationType = Asset | Token | SceneUpdate | TokenInstance;

const FriendlyOperation: { [key in Operation]: string | undefined } = {
  get: undefined,
  put: "Update succesfull",
  delete: "Deletion successful",
};

async function resolveHeaders(
  state: AppReducerState,
  headers: { [key: string]: string } = {},
): Promise<{ [key: string]: string }> {
  const noauth =
    environmentApi.endpoints.getNoAuthConfig.select()(state).data?.noauth ??
    false;
  if (noauth) {
    return {
      ...headers,
      Authorization: "Bearer NOAUTH",
    };
  }
  return getAuthHeaders(headers);
}

function inferPath(op: Operation, path: string, t: OperationType): string {
  // no id for get, put expects an id in the body (or its a new entity)
  return op === "delete" && t !== undefined && "_id" in t
    ? `${path}/${t._id}`
    : path;
}
async function request<T extends OperationType>(
  state: AppReducerState,
  _store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  op: Operation,
  t: T,
  basePath: string,
): Promise<AxiosResponse> {
  const path = inferPath(op, basePath, t);
  const url = `${environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api}/${path}`;

  const headers = await resolveHeaders(state);
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

function trackRateLimit(next: Dispatch<AnyAction>, resp: AxiosResponse) {
  const limit = resp.headers["ratelimit-limit"];
  const remaining = resp.headers["ratelimit-remaining"];
  if (limit === undefined || remaining === undefined) return;
  next(ratelimit({ limit, remaining }));
}

function handleError(
  next: Dispatch<AnyAction>,
  op: Operation,
  path: string,
  error: unknown,
) {
  let msg = `Unable to ${op} ${path}`;
  if (error instanceof Error) {
    if (axios.isAxiosError(error.cause)) {
      console.error(`Operation failure: ${JSON.stringify(error.cause)}`);
      if (error.cause.response) {
        const status = error.cause.response.status;
        if (status === 406) {
          msg = "Invalid asset format";
        } else if (status === 413) {
          msg = "Asset too big";
        } else if (status === 409) {
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
  const err: EditorUiError = {
    msg: msg,
    success: false,
  };
  next(setError(err));
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
    trackRateLimit(next, result);
    next({
      type: action.type,
      payload: result.status === 204 ? action.payload : result.data,
    });
    const msg = FriendlyOperation[op];
    if (msg) {
      const err: EditorUiError = {
        msg: msg,
        success: true,
      };
      next(setError(err));
    }
    return result;
  } catch (error) {
    handleError(next, op, path, error);
  }
}

export const ContentMiddleware: Middleware =
  (store) => (next) => async (action) => {
    const state = store.getState();
    const apiUrl =
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api;
    if (!apiUrl) {
      console.error("No API URL in environment state.");
      return next(action);
    }

    if (!state.content.mediaPrefix) {
      // I suppose when we use R2 or S3, this will be different (and likely from the environment config)
      next({ type: "content/mediaprefix", payload: apiUrl });
    }

    switch (action.type) {
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
      case "content/scenetokenmoved": {
        const path = `scene/${action.payload.scene}/token`;
        operate(state, store, next, "put", path, action);
        break;
      }
      default:
        next(action);
        break;
    }
  };
