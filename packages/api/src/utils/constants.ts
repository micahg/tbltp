export const STARTUP_CHECK_SIG = "startup_check";
export const STARTUP_DONE_SIG = "startup_done";
export const ASSETS_UPDATED_SIG = "event_updated";

export const NO_AUTH_ASSET = "/noauth";
export const ALL_ASSETS_PATH = "/asset";
export const ASSET_PATH = `${ALL_ASSETS_PATH}/:id`;
export const ASSET_DATA_PATH = `${ASSET_PATH}/data`;
export const ALL_TOKEN_PATH = "/token";
export const TOKEN_PATH = `${ALL_TOKEN_PATH}/:id`;
export const STATE_ASSET = "/state";
export const ALL_SCENES_PATH = "/scene";
export const SCENE_PATH = "/scene/:id";
export const SCENE_CONTENT_PATH = "/scene/:id/content";
export const SCENE_VIEWPORT_PATH = "/scene/:id/viewport";
export const SCENE_TOKEN_PATH = "/scene/:id/token";
export const TOKEN_INSTANCE_PATH = "/tokeninstance/:id";

export const VALID_LAYERS = ["overlay", "detail", "player"];
export const VALID_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const CONTENT_TYPE_EXTS = ["png", "jpg", "webp"];
export const DEST_FOLDER = "public";

export const OBJECT_ID_LEN = 24;

// websocket errors
export const WS_NO_SCENE = "NO_SCENE";
export const WS_INVALID_TOKEN = "INVALID_TOKEN";
export const WS_INVALID_USER = "INVALID_USER";
