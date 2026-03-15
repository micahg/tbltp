export interface UploadResponse<TData = unknown> {
  data: TData;
  status: number;
  headers: Record<string, string>;
}

export interface UploadError extends Error {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export interface UploadFormDataArgs {
  url: string;
  formData: FormData;
  headers?: Record<string, string>;
  method?: "PUT" | "POST" | "PATCH";
  onProgress?: (event: ProgressEvent<EventTarget>) => void;
}

function parseHeaders(xhr: XMLHttpRequest): Record<string, string> {
  return xhr
    .getAllResponseHeaders()
    .trim()
    .split("\r\n")
    .filter((line) => line.includes(":"))
    .reduce<Record<string, string>>((acc, line) => {
      const idx = line.indexOf(":");
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function parseResponseBody(xhr: XMLHttpRequest): unknown {
  const text = xhr.responseText;
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return text;
  }
}

export function uploadFormData<TData = unknown>(
  args: UploadFormDataArgs,
): Promise<UploadResponse<TData>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(args.method ?? "PUT", args.url);

    Object.entries(args.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
      args.onProgress?.(event);
    };

    xhr.onload = () => {
      const headers = parseHeaders(xhr);
      const data = parseResponseBody(xhr);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          data: data as TData,
          status: xhr.status,
          headers,
        });
        return;
      }

      const err = new Error(
        `Upload failed with status ${xhr.status}`,
      ) as UploadError;
      err.status = xhr.status;
      err.data = data;
      err.headers = headers;
      reject(err);
    };

    xhr.onerror = () => {
      const err = new Error("Upload request failed") as UploadError;
      reject(err);
    };

    xhr.send(args.formData);
  });
}
