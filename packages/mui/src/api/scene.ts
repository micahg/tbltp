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
import { UploadResponse, uploadFormData, type UploadError } from "./upload";
import { ratelimit } from "../slices/rateLimitSlice";

type SceneTag = { type: "Scene"; id: string };

export type SceneLayer = "overlay" | "detail" | "player";

export interface SendSceneFileArgs {
  scene: Scene;
  blob: File | URL;
  layer: SceneLayer;
  progress?: (evt: LoadProgress) => void;
}

export type SceneUploadResponse<TData = unknown> = UploadResponse<TData>;

export interface SceneViewportUpdate {
  sceneId: string;
  viewport: {
    backgroundSize?: Rect;
    viewport?: Rect;
    angle?: number;
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
  const api =
    environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api;
  if (!api || !scene._id) {
    return Promise.reject(new Error("Unable to resolve scene upload endpoint"));
  }

  const url = `${api}/scene/${scene._id}/content`;
  const formData = new FormData();
  const content: Blob | string = isBlob(blob)
    ? (blob as Blob)
    : blob.toString();
  formData.append("layer", layer);
  formData.append("image", content);

  return getAuthHeaders()
    .then((headers) =>
      uploadFormData({
        url,
        formData,
        headers,
        onProgress: (event) => {
          if (!event.lengthComputable) {
            return;
          }
          progress?.({ progress: event.loaded / event.total, img: layer });
        },
      }),
    )
    .catch((err: unknown) => {
      if (typeof err === "object" && err !== null) {
        (err as UploadError & { scene?: Scene }).scene = scene;
      }
      throw err;
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

function dispatchRateLimitFromHeaders(
  dispatch: (action: unknown) => void,
  limit: string | null,
  remaining: string | null,
) {
  if (!limit || !remaining) {
    return;
  }

  dispatch(ratelimit({ limit, remaining }));
}

function dispatchRateLimitFromMeta(
  dispatch: (action: unknown) => void,
  meta: unknown,
) {
  const response =
    typeof meta === "object" && meta !== null && "response" in meta
      ? (meta as { response?: Response }).response
      : undefined;
  dispatchRateLimitFromHeaders(
    dispatch,
    response?.headers.get("ratelimit-limit") ?? null,
    response?.headers.get("ratelimit-remaining") ?? null,
  );
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

    const result = await rawBaseQuery(request, api, extraOptions);
    dispatchRateLimitFromMeta(api.dispatch, result.meta);
    return result;
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

          dispatchRateLimitFromHeaders(
            api.dispatch,
            response.headers["ratelimit-limit"] ?? null,
            response.headers["ratelimit-remaining"] ?? null,
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
