import { Rect, Scene } from "@micahg/tbltp-common";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { AppReducerState } from "../reducers/AppReducer";
import { LoadProgress } from "../utils/content";
import type {
  CreateSceneFlowLifecycleOps,
  CreateSceneFlowOps,
} from "../thunks/createSceneFlow";

type SceneTag = { type: "Scene"; id: string };

export type SceneLayer = "overlay" | "detail" | "player";

export interface SendSceneFileArgs {
  scene: Scene;
  blob: File | URL;
  layer: SceneLayer;
  progress?: (evt: LoadProgress) => void;
}

export interface SceneUploadResponse<TData = unknown> {
  data: TData;
  status: number;
  headers: Record<string, string>;
}

export interface SceneViewportUpdate {
  sceneId: string;
  viewport: {
    backgroundSize?: Rect;
    viewport?: Rect;
    angle?: number;
  };
}

type UnwrappablePromise<T> = {
  unwrap: () => Promise<T>;
};

export interface SceneFlowMutationTriggers {
  createScene: (
    payload: Parameters<CreateSceneFlowOps["createScene"]>[0],
  ) => UnwrappablePromise<Scene>;
  sendSceneFile: (
    payload: Parameters<CreateSceneFlowOps["sendSceneFile"]>[0],
  ) => UnwrappablePromise<Scene>;
  updateSceneViewport: (
    payload: Parameters<CreateSceneFlowOps["updateSceneViewport"]>[0],
  ) => UnwrappablePromise<Scene>;
  deleteScene: (
    sceneId: Parameters<CreateSceneFlowOps["deleteScene"]>[0],
  ) => UnwrappablePromise<void>;
}

export function createSceneFlowOpsFromSceneApi(
  triggers: SceneFlowMutationTriggers,
  lifecycle: CreateSceneFlowLifecycleOps,
): CreateSceneFlowOps {
  return {
    createScene: (payload) => triggers.createScene(payload).unwrap(),
    sendSceneFile: (payload) => triggers.sendSceneFile(payload).unwrap(),
    updateSceneViewport: (payload) =>
      triggers.updateSceneViewport(payload).unwrap(),
    deleteScene: (sceneId) => triggers.deleteScene(sceneId).unwrap(),
    ...lifecycle,
  };
}

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

export function sendFile(
  state: AppReducerState,
  scene: Scene,
  blob: File | URL,
  layer: SceneLayer,
  progress?: (evt: LoadProgress) => void,
): Promise<SceneUploadResponse> {
  return new Promise((resolve, reject) => {
    const api =
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api;
    if (!api || !scene._id) {
      reject(new Error("Unable to resolve scene upload endpoint"));
      return;
    }

    const url = `${api}/scene/${scene._id}/content`;
    const formData = new FormData();
    const content: Blob | string = isBlob(blob)
      ? (blob as Blob)
      : blob.toString();
    formData.append("layer", layer);
    formData.append("image", content);

    getAuthHeaders()
      .then((headers) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);

        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
          if (!event.lengthComputable) {
            return;
          }
          progress?.({ progress: event.loaded / event.total, img: layer });
        };

        xhr.onload = () => {
          const responseHeaders = xhr
            .getAllResponseHeaders()
            .trim()
            .split("\r\n")
            .filter((line) => line.includes(":"))
            .reduce<Record<string, string>>((acc, line) => {
              const idx = line.indexOf(":");
              const key = line.slice(0, idx).trim().toLowerCase();
              const value = line.slice(idx + 1).trim();
              acc[key] = value;
              return acc;
            }, {});

          let data: unknown = xhr.responseText;
          try {
            data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
          } catch {
            data = xhr.responseText;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              data,
              status: xhr.status,
              headers: responseHeaders,
            });
            return;
          }

          const err = new Error(`Upload failed with status ${xhr.status}`) as {
            scene?: Scene;
          };
          err.scene = scene;
          reject(err);
        };

        xhr.onerror = () => {
          const err = new Error("Upload request failed") as {
            scene?: Scene;
          };
          err.scene = scene;
          reject(err);
        };

        xhr.send(formData);
      })
      .catch((err: unknown) => {
        if (typeof err === "object" && err !== null) {
          (err as { scene?: Scene }).scene = scene;
        }
        reject(err);
      });
  });
}

function sceneTagsForList(scenes: Scene[] | undefined): SceneTag[] {
  if (!scenes) {
    return [{ type: "Scene", id: "LIST" }];
  }
  return [
    ...scenes
      .filter((scene) => !!scene._id)
      .map((scene) => ({ type: "Scene" as const, id: scene._id! })),
    { type: "Scene", id: "LIST" },
  ];
}

const rawBaseQuery = fetchBaseQuery({ baseUrl: "/" });

const sceneBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const selectEnvironmentConfig =
    environmentApi.endpoints.getEnvironmentConfig.select();
  const env = selectEnvironmentConfig(
    api.getState() as Parameters<typeof selectEnvironmentConfig>[0],
  ).data;

  if (!env?.api) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: "Environment API config is not loaded",
      },
    };
  }

  try {
    const authHeaders = await getAuthHeaders();
    const request =
      typeof args === "string"
        ? {
            url: `${env.api}${args}`,
            headers: authHeaders,
          }
        : {
            ...args,
            url: `${env.api}${args.url}`,
            headers: {
              ...(args.headers as Record<string, string> | undefined),
              ...authHeaders,
            },
          };

    return rawBaseQuery(request, api, extraOptions);
  } catch (error) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: String(error),
      },
    };
  }
};

export const sceneApi = createApi({
  reducerPath: "sceneApi",
  baseQuery: sceneBaseQuery,
  tagTypes: ["Scene"],
  endpoints: (build) => ({
    getScenes: build.query<Scene[], void>({
      query: () => ({ url: "/scene" }),
      providesTags: (result) => sceneTagsForList(result),
    }),
    getScene: build.query<Scene, string>({
      query: (sceneId) => ({ url: `/scene/${sceneId}` }),
      providesTags: (_result, _error, sceneId) => [
        { type: "Scene", id: sceneId },
      ],
    }),
    createScene: build.mutation<Scene, { description: string }>({
      query: (scene) => ({
        url: "/scene",
        method: "PUT",
        body: scene,
      }),
      invalidatesTags: [{ type: "Scene", id: "LIST" }],
    }),
    deleteScene: build.mutation<void, string>({
      query: (sceneId) => ({
        url: `/scene/${sceneId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, sceneId) => [
        { type: "Scene", id: "LIST" },
        { type: "Scene", id: sceneId },
      ],
    }),
    sendSceneFile: build.mutation<Scene, SendSceneFileArgs>({
      async queryFn(args, api) {
        try {
          const state = api.getState() as AppReducerState;
          const response = await sendFile(
            state,
            args.scene,
            args.blob,
            args.layer,
            args.progress,
          );

          return { data: response.data as Scene };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: (_result, _error, args) => [
        { type: "Scene", id: args.scene._id ?? "LIST" },
        { type: "Scene", id: "LIST" },
      ],
    }),
    updateSceneViewport: build.mutation<Scene, SceneViewportUpdate>({
      query: ({ sceneId, viewport }) => ({
        url: `/scene/${sceneId}/viewport`,
        method: "PUT",
        body: viewport,
      }),
      invalidatesTags: (_result, _error, args) => [
        { type: "Scene", id: args.sceneId },
        { type: "Scene", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetScenesQuery,
  useGetSceneQuery,
  useCreateSceneMutation,
  useDeleteSceneMutation,
  useSendSceneFileMutation,
  useUpdateSceneViewportMutation,
} = sceneApi;
