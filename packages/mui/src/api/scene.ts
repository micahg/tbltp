import { Rect, Scene } from "@micahg/tbltp-common";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { ratelimit } from "../slices/rateLimitSlice";

type SceneTag = { type: "Scene"; id: string };

export type SceneLayer = "overlay" | "detail" | "player";

export interface AssignSceneLayerAssetArgs {
  sceneId: string;
  layer: SceneLayer;
  assetId: string;
}

export interface SceneViewportUpdate {
  sceneId: string;
  viewport: {
    backgroundSize?: Rect;
    viewport?: Rect;
    angle?: number;
  };
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
    assignSceneLayerAsset: build.mutation<Scene, AssignSceneLayerAssetArgs>({
      query: ({ sceneId, layer, assetId }) => ({
        url: `/scene/${sceneId}/${layer}`,
        method: "PUT",
        body: { assetId },
      }),
      invalidatesTags: (_result, _error, args) => [
        { type: "Scene", id: args.sceneId },
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
  useAssignSceneLayerAssetMutation,
  useUpdateSceneViewportMutation,
} = sceneApi;
