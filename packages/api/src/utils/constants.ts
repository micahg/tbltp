export const STARTUP_CHECK_SIG = "startup_check";
export const STARTUP_DONE_SIG = "startup_done";
export const ASSETS_UPDATED_SIG = "event_updated";

export const NO_AUTH_ASSET = "/noauth";
export const STATE_ASSET = "/state";
export const ALL_SCENES_PATH = "/scene";
export const SCENE_PATH = "/scene/:id";
export const SCENE_CONTENT_PATH = "/scene/:id/content";
export const SCENE_VIEWPORT_PATH = "/scene/:id/viewport";

export const VALID_LAYERS = ["overlay", "detail", "player"];

export const VALID_CONTENT_TYPES = ["image/png", "image/jpeg"];
export const CONTENT_TYPE_EXTS = ["png", "jpg"];
export const DEST_FOLDER = "public";

export const OBJECT_ID_LEN = 24;

// websocket errors
export const WS_NO_SCENE = "NO_SCENE";
export const WS_INVALID_TOKEN = "INVALID_TOKEN";
export const WS_INVALID_USER = "INVALID_USER";
