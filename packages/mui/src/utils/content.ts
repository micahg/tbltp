import { xhrRequest } from "./xhr";

export type LoadProgress = {
  img: string;
  progress: number;
};

export type progressFunction = (p: LoadProgress) => void;

/**
 * Ask the caller for a freshly minted download url for an image whose
 * current url was rejected. See loadImage.
 */
export type RefreshUrl = () => Promise<string>;

/**
 * Raised when an image request came back with a non-success status. The
 * status is kept so callers can distinguish a rejected signature (403,
 * i.e. an expired presigned url) from real failures.
 */
export class ImageLoadError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ImageLoadError";
    this.status = status;
  }
}

function requestImage(url: string, progress?: progressFunction) {
  // NOTE: no Authorization header -- these urls are presigned and carrying
  // an Authorization header (or extra query parameters) breaks the signature
  return xhrRequest({
    method: "GET",
    url,
    responseType: "blob",
    progressTarget: "download",
    networkErrorMessage: "Image request failed",
    onProgress: (event: ProgressEvent<EventTarget>) => {
      if (!progress) return;

      if (event.lengthComputable && event.total > 0) {
        progress({ progress: event.loaded / event.total, img: url });
        return;
      }

      // Length may be unknown depending on transfer mode/headers.
      progress({ progress: 0, img: url });
    },
  }).then((xhr) => {
    if (xhr.status < 200 || xhr.status >= 300) {
      throw new ImageLoadError(`Image load failed (${xhr.status})`, xhr.status);
    }

    if (progress) {
      progress({ progress: 1, img: url });
    }

    return createImageBitmap(xhr.response);
  });
}

/**
 * Load an image through a presigned download url.
 *
 * Presigned urls expire, and an expired url only fails once the browser
 * actually makes the request (a cached response hides it, but a cache miss
 * gets a 403). When that happens and a refresh callback was provided, ask
 * for a fresh url and retry exactly once -- there is no point retrying the
 * rejected url itself.
 *
 * @param url The presigned url to fetch.
 * @param progress Optional download progress callback.
 * @param refresh Optional callback that mints a fresh presigned url.
 */
export async function loadImage(
  url: string,
  progress?: progressFunction,
  refresh?: RefreshUrl,
): Promise<ImageBitmap> {
  try {
    return await requestImage(url, progress);
  } catch (err) {
    if (refresh && err instanceof ImageLoadError && err.status === 403) {
      const fresh = await refresh();
      return requestImage(fresh, progress);
    }
    throw err;
  }
}
