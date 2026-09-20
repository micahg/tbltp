import { Asset, AssetUsage } from "@micahg/tbltp-common";
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
import { uploadFile, type UploadError } from "./upload";

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
    getAssetUsage: build.query<AssetUsage, string>({
      query: (id) => ({ url: `/asset/${id}/usage` }),
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
      async queryFn(args, api, _extraOptions, baseQuery) {
        if (!args.file.type) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Unable to determine the asset file type",
            },
          };
        }

        const contentType = args.file.type;

        // 1. request a presigned upload URL from the API
        const presigned = await baseQuery({
          url: `/asset/${args.id}/data`,
          method: "POST",
          body: { contentType },
        });
        if (presigned.error) {
          return { error: presigned.error };
        }

        const { url } = presigned.data as { url: string; location: string };

        // 2. upload the file directly to object storage
        try {
          await uploadFile({
            url,
            file: args.file,
            contentType,
            onProgress: (evt) => {
              if (!evt.lengthComputable) {
                return;
              }
              args.progress?.({ progress: evt.loaded / evt.total, img: "" });
            },
          });
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

        // 3. commit the upload (the API verifies the object landed in storage)
        const commit = await baseQuery({
          url: `/asset/${args.id}/data`,
          method: "PUT",
          body: { contentType },
        });
        if (commit.error) {
          return { error: commit.error };
        }

        return { data: commit.data as Asset };
      },
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(
            assetApi.util.updateQueryData("getAssetById", args.id, (draft) => {
              Object.assign(draft, data);
            }),
          );

          dispatch(
            assetApi.util.updateQueryData("getAssets", undefined, (draft) => {
              const index = draft.findIndex((asset) => asset._id === args.id);
              if (index !== -1) {
                Object.assign(draft[index], data);
              }
            }),
          );
        } catch {
          // no-op; error is already surfaced through queryFn
        }
      },
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
  useGetAssetUsageQuery,
  useLazyGetAssetUsageQuery,
  useUpdateAssetMutation,
  useUpdateAssetDataMutation,
  useDeleteAssetMutation,
} = assetApi;
