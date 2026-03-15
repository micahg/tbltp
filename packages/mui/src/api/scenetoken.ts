import { TokenInstance } from "@micahg/tbltp-common";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { ratelimit } from "../slices/rateLimitSlice";

type SceneTokenTag = { type: "SceneToken"; id: string };

function sceneTokenTagsForScene(sceneId: string): SceneTokenTag[] {
  return [
    { type: "SceneToken", id: sceneId },
    { type: "SceneToken", id: "LIST" },
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

const sceneTokenBaseQuery: BaseQueryFn<
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

export const sceneTokenApi = createApi({
  reducerPath: "sceneTokenApi",
  baseQuery: sceneTokenBaseQuery,
  tagTypes: ["SceneToken"],
  endpoints: (build) => ({
    getSceneTokenInstances: build.query<TokenInstance[], string>({
      query: (sceneId) => ({ url: `/scene/${sceneId}/token` }),
      providesTags: (_result, _error, sceneId) =>
        sceneTokenTagsForScene(sceneId),
    }),
    upsertSceneTokenInstance: build.mutation<TokenInstance, TokenInstance>({
      query: (instance) => ({
        url: `/scene/${instance.scene}/token`,
        method: "PUT",
        body: instance,
      }),
      invalidatesTags: (_result, _error, instance) =>
        sceneTokenTagsForScene(instance.scene),
    }),
    deleteSceneTokenInstance: build.mutation<void, TokenInstance>({
      async queryFn(instance, _api, _extraOptions, baseQuery) {
        if (!instance._id) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Token instance id is required",
            },
          };
        }

        const result = await baseQuery({
          url: `/tokeninstance/${instance._id}`,
          method: "DELETE",
          responseHandler: "text",
        });

        if ("error" in result && result.error) {
          return { error: result.error };
        }

        if ("error" in result) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Unable to delete scene token instance",
            },
          };
        }

        return { data: undefined };
      },
      invalidatesTags: (_result, _error, instance) =>
        sceneTokenTagsForScene(instance.scene),
    }),
  }),
});

export const {
  useGetSceneTokenInstancesQuery,
  useLazyGetSceneTokenInstancesQuery,
  useUpsertSceneTokenInstanceMutation,
  useDeleteSceneTokenInstanceMutation,
} = sceneTokenApi;
