import { xhrRequest } from "./xhr";

export type LoadProgress = {
  img: string;
  progress: number;
};

export type progressFunction = (p: LoadProgress) => void;

export function loadImage(
  url: string,
  bearer: string,
  progress?: progressFunction,
): Promise<ImageBitmap> {
  return xhrRequest({
    method: "GET",
    url,
    responseType: "blob",
    headers: { Authorization: `Bearer ${bearer}` },
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
      throw new Error(`Image load failed (${xhr.status})`);
    }

    if (progress) {
      progress({ progress: 1, img: url });
    }

    return createImageBitmap(xhr.response);
  });
}
