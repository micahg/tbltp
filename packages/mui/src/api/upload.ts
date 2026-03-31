import { xhrRequest } from "../utils/xhr";

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
  return xhrRequest({
    method: args.method ?? "PUT",
    url: args.url,
    headers: args.headers,
    body: args.formData,
    onProgress: args.onProgress,
    progressTarget: "upload",
    networkErrorMessage: "Upload request failed",
  }).then((xhr) => {
    const headers = parseHeaders(xhr);
    const data = parseResponseBody(xhr);

    if (xhr.status >= 200 && xhr.status < 300) {
      return {
        data: data as TData,
        status: xhr.status,
        headers,
      };
    }

    const err = new Error(
      `Upload failed with status ${xhr.status}`,
    ) as UploadError;
    err.status = xhr.status;
    err.data = data;
    err.headers = headers;
    throw err;
  });
}
