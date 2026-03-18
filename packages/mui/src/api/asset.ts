import { Asset } from "@micahg/tbltp-common";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { LoadProgress } from "../utils/content";
import { ratelimit } from "../slices/rateLimitSlice";
import { uploadFormData, type UploadError } from "./upload";

type AssetTag = { type: "Asset"; id: string };

export interface UpdateAssetDataRequest {
  id: string;
  file: File;
  progress?: (evt: LoadProgress) => void;
}

function assetTagsForList(assets: Asset[] | undefined): AssetTag[] {
  if (!assets) {
    return [{ type: "Asset", id: "LIST" }];
  }

  return [
    ...assets
      .filter((asset) => !!asset._id)
      .map((asset) => ({ type: "Asset" as const, id: asset._id! })),
    { type: "Asset", id: "LIST" },
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

const assetBaseQuery: BaseQueryFn<
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

export const assetApi = createApi({
  reducerPath: "assetApi",
  baseQuery: assetBaseQuery,
  tagTypes: ["Asset"],
  endpoints: (build) => ({
    getAssets: build.query<Asset[], void>({
      query: () => ({ url: "/asset" }),
      providesTags: (result) => assetTagsForList(result),
    }),
    getAssetById: build.query<Asset, string>({
      query: (id) => ({ url: `/asset/${id}` }),
      providesTags: (_result, _error, id) => [{ type: "Asset", id }],
    }),
    updateAsset: build.mutation<Asset, Asset>({
      query: (asset) => ({
        url: "/asset",
        method: "PUT",
        body: asset,
      }),
      invalidatesTags: (_result, _error, asset) => [
        { type: "Asset", id: "LIST" },
        { type: "Asset", id: asset._id ?? "LIST" },
      ],
    }),
    updateAssetData: build.mutation<Asset, UpdateAssetDataRequest>({
      async queryFn(args, api) {
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
          const formData = new FormData();
          formData.append("asset", args.file as Blob);

          // Let the browser set multipart/form-data with boundary.
          const headers = await getAuthHeaders();

          const response = await uploadFormData<Asset>({
            url: `${env.api}/asset/${args.id}/data`,
            formData,
            headers,
            onProgress: (evt) => {
              if (!evt.lengthComputable) {
                return;
              }
              args.progress?.({ progress: evt.loaded / evt.total, img: "" });
            },
          });

          dispatchRateLimitFromHeaders(
            api.dispatch,
            response.headers["ratelimit-limit"] ?? null,
            response.headers["ratelimit-remaining"] ?? null,
          );

          return { data: response.data };
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "status" in error
          ) {
            const uploadErr = error as UploadError;
            if (typeof uploadErr.status === "number") {
              return {
                error: {
                  status: uploadErr.status,
                  data: uploadErr.data,
                },
              };
            }

            return {
              error: {
                status: "CUSTOM_ERROR",
                data: uploadErr.data,
                error: uploadErr.message,
              },
            };
          }

          return {
            error: {
              status: "CUSTOM_ERROR",
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: (_result, _error, args) => [
        { type: "Asset", id: "LIST" },
        { type: "Asset", id: args.id },
      ],
    }),
    deleteAsset: build.mutation<Asset, Asset>({
      async queryFn(asset, _api, _extraOptions, baseQuery) {
        if (!asset._id) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Asset id is required",
            },
          };
        }

        const result = await baseQuery({
          url: `/asset/${asset._id}`,
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
              error: "Unable to delete asset",
            },
          };
        }

        return { data: asset };
      },
      invalidatesTags: (_result, _error, asset) => [
        { type: "Asset", id: "LIST" },
        { type: "Asset", id: asset._id ?? "LIST" },
      ],
    }),
  }),
});

export const {
  useGetAssetsQuery,
  useGetAssetByIdQuery,
  useUpdateAssetMutation,
  useUpdateAssetDataMutation,
  useDeleteAssetMutation,
} = assetApi;
