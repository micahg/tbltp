import { xhrRequest } from "../utils/xhr";

export interface UploadError extends Error {
  status?: number;
  data?: unknown;
}

export interface UploadFileArgs {
  /** Presigned object storage URL. */
  url: string;
  file: Blob;
  /** Must match the content type the URL was signed with. */
  contentType: string;
  onProgress?: (event: ProgressEvent<EventTarget>) => void;
}

function parseResponseBody(xhr: XMLHttpRequest): unknown {
  const text = xhr.responseText;
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return text;
  }
}

/**
 * Upload a file directly to object storage via a presigned URL. The content
 * type is part of the URL signature, so it must be sent unchanged.
 */
export async function uploadFile(args: UploadFileArgs): Promise<void> {
  const xhr = await xhrRequest({
    method: "PUT",
    url: args.url,
    headers: { "Content-Type": args.contentType },
    body: args.file,
    onProgress: args.onProgress,
    progressTarget: "upload",
    networkErrorMessage: "Upload request failed",
  });

  if (xhr.status < 200 || xhr.status >= 300) {
    const err = new Error(
      `Upload failed with status ${xhr.status}`,
    ) as UploadError;
    err.status = xhr.status;
    err.data = parseResponseBody(xhr);
    throw err;
  }
}
