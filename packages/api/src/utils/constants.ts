export const STARTUP_CHECK_SIG = "startup_check";
export const STARTUP_DONE_SIG = "startup_done";
export const ASSETS_UPDATED_SIG = "event_updated";

export const NO_AUTH_ASSET = "/noauth";
export const ALL_ASSETS_PATH = "/asset";
export const ASSET_PATH = `${ALL_ASSETS_PATH}/:id`;
export const ASSET_DATA_PATH = `${ASSET_PATH}/data`;
export const ASSET_USAGE_PATH = `${ASSET_PATH}/usage`;
export const ASSET_URLS_PATH = `${ALL_ASSETS_PATH}/urls`;
export const ALL_TOKEN_PATH = "/token";
export const TOKEN_PATH = `${ALL_TOKEN_PATH}/:id`;
export const STATE_ASSET = "/state";
export const ALL_SCENES_PATH = "/scene";
export const SCENE_PATH = "/scene/:id";
export const SCENE_CONTENT_PATH = "/scene/:id/:layer";
export const SCENE_OVERLAY_DATA_PATH = "/scene/:id/overlay/data";
export const SCENE_VIEWPORT_PATH = "/scene/:id/viewport";
export const SCENE_TOKEN_PATH = "/scene/:id/token";
export const TOKEN_INSTANCE_PATH = "/tokeninstance/:id";

export const VALID_LAYERS = ["overlay", "detail", "player"];
export const VALID_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const CONTENT_TYPE_EXTS = ["png", "jpg", "webp"];
export const DEST_FOLDER = "public";
// presigned uploads target single-use staging keys under this folder --
// never the final asset keys (which live under DEST_FOLDER)
export const STAGING_FOLDER = "uploads";

/**
 * Cache-Control for objects that are never rewritten (assets, backgrounds,
 * tokens). The bytes are immutable, so browsers may cache them for a long
 * time; requests still go through presigned urls, so this only helps the
 * browser that fetched them.
 */
export const IMMUTABLE_CACHE_CONTROL = "private, max-age=2592000, immutable";
/**
 * Cache-Control for the scene overlay, which is replaced at the same key on
 * every annotation. Each broadcast carries a freshly signed url anyway, but
 * no-store makes sure a stale copy can never be served.
 */
export const NO_STORE_CACHE_CONTROL = "private, no-store";

/**
 * Upper bound on how many locations a single POST /asset/urls may request,
 * keeping presign work per request bounded.
 */
export const MAX_DOWNLOAD_URL_LOCATIONS = 100;

export const OBJECT_ID_LEN = 24;

// websocket errors
export const WS_NO_SCENE = "NO_SCENE";
export const WS_INVALID_TOKEN = "INVALID_TOKEN";
export const WS_INVALID_USER = "INVALID_USER";
