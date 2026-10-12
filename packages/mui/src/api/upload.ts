import type { FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { LoadProgress } from "../utils/content";
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

export interface PresignedUploadArgs {
  /** Presign endpoint request; its body gets the contentType attached. */
  presign: FetchArgs;
  /** Commit endpoint request; its body gets the contentType attached. */
  commit: FetchArgs;
  file: File;
  progress?: (evt: LoadProgress) => void;
}

// the exact shape of the queryFn baseQuery param -- loose on purpose so
// both asset and scene mutations can hand theirs over unchanged
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PresignBaseQuery = (args: FetchArgs) => any;

/**
 * Run the full presigned upload flow against the API: request a presigned
 * url, upload the file directly to object storage, then commit the upload.
 * Shared by the asset data mutation and the scene overlay mutation.
 */
export async function presignedUpload<T>(
  args: PresignedUploadArgs,
  baseQuery: PresignBaseQuery,
): Promise<{ data: T; error?: undefined } | { error: FetchBaseQueryError }> {
  if (!args.file.type) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: "Unable to determine the asset file type",
      },
    };
  }

  const contentType = args.file.type;

  // 1. request a presigned upload url from the API
  const presigned = await baseQuery({
    ...args.presign,
    body: { contentType },
  });
  if (presigned.error) {
    return { error: presigned.error };
  }

  const { url } = presigned.data as { url: string; location: string };

  // 2. upload the file directly to object storage
  try {
    await uploadFile({
      url,
      file: args.file,
      contentType,
      onProgress: (evt) => {
        if (!evt.lengthComputable) {
          return;
        }
        args.progress?.({ progress: evt.loaded / evt.total, img: "" });
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) {
      const uploadErr = error as UploadError;
      if (typeof uploadErr.status === "number") {
        return {
          error: {
            status: uploadErr.status,
            data: uploadErr.data,
          },
        };
      }

      return {
        error: {
          status: "CUSTOM_ERROR",
          data: uploadErr.data,
          error: uploadErr.message,
        },
      };
    }

    return {
      error: {
        status: "CUSTOM_ERROR",
        error: String(error),
      },
    };
  }

  // 3. commit the upload (the API verifies the object landed in storage)
  const commit = await baseQuery({
    ...args.commit,
    body: { contentType },
  });
  if (commit.error) {
    return { error: commit.error };
  }

  return { data: commit.data as T };
}
