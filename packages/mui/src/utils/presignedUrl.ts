import { useCallback } from "react";
import { usePresignAssetUrlsMutation } from "../api/asset";

/**
 * Returns a callback that mints a fresh presigned download url for an asset
 * location through the API.
 *
 * Presigned urls expire; when an image fetch fails with 403 the fix is to
 * ask for a new url for exactly the location that failed (never to retry
 * the rejected url, and never to append cache busting parameters -- both
 * break the signature).
 */
export function usePresignedUrlRefresher() {
  const [presignAssetUrls] = usePresignAssetUrlsMutation();

  return useCallback(
    async (location: string) => {
      const { urls } = await presignAssetUrls([location]).unwrap();
      const url = urls[location];
      if (!url) {
        throw new Error(`Unable to refresh download url for ${location}`);
      }
      return url;
    },
    [presignAssetUrls],
  );
}
