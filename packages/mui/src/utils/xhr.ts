export type XhrProgressTarget = "download" | "upload";

export interface XhrRequestArgs {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: Document | XMLHttpRequestBodyInit | null;
  responseType?: XMLHttpRequestResponseType;
  onProgress?: (event: ProgressEvent<EventTarget>) => void;
  progressTarget?: XhrProgressTarget;
  networkErrorMessage?: string;
}

export function xhrRequest(args: XhrRequestArgs): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(args.method, args.url);

    if (args.responseType) {
      xhr.responseType = args.responseType;
    }

    Object.entries(args.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (args.onProgress) {
      if (args.progressTarget === "upload") {
        xhr.upload.onprogress = args.onProgress;
      } else {
        xhr.onprogress = args.onProgress;
      }
    }

    xhr.onload = () => resolve(xhr);

    xhr.onerror = () => {
      reject(new Error(args.networkErrorMessage || "XHR request failed"));
    };

    xhr.send(args.body);
  });
}
