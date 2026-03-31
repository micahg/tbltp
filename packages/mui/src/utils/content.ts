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
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.setRequestHeader("Authorization", `Bearer ${bearer}`);

    xhr.onprogress = (event: ProgressEvent<EventTarget>) => {
      if (!progress) return;

      if (event.lengthComputable && event.total > 0) {
        progress({ progress: event.loaded / event.total, img: url });
        return;
      }

      // Length may be unknown depending on transfer mode/headers.
      progress({ progress: 0, img: url });
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Image load failed (${xhr.status})`));
        return;
      }

      if (progress) {
        progress({ progress: 1, img: url });
      }

      createImageBitmap(xhr.response).then(resolve).catch(reject);
    };

    xhr.onerror = () => {
      reject(new Error("Image request failed"));
    };

    xhr.send();
  });
}
