/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
import { Token } from "./token";
import { Scene } from "./scene";

export interface Asset {
    _id?: string;
    user?: string;
    name: string;
    tags?: string[];
    location?: string;
    revision?: number;
    /**
     * Presigned download url for the stored asset data. Freshly signed for
     * every serialization, so it expires (see DOWNLOAD_URL_EXPIRY_SECONDS on
     * the API) and must never be persisted or shared. Clients that fail to
     * fetch through it (403) should request a new one from /asset/urls.
     */
    url?: string;
}

export interface AssetUsage {
    tokens: Token[];
    scenes: Scene[];
}

/**
 * The wire contract between the API and the frontend: the asset fields
 * that may appear in API responses. Database-only fields (such as the
 * upload staging bookkeeping on the mongoose model) must never be listed
 * here. The `_id` field always rides along with database projections, so
 * it is deliberately excluded (and rejected) from these lists.
 */
export const ASSET_FIELDS = [
    "user",
    "name",
    "tags",
    "location",
    "revision",
] as const satisfies readonly Exclude<keyof Asset, "_id">[];

/**
 * The subset of asset fields returned when listing many assets at once.
 */
export const ASSET_SUMMARY_FIELDS = [
    "name",
    "location",
    "revision",
] as const satisfies readonly Exclude<keyof Asset, "_id">[];
