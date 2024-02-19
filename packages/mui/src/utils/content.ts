import axios, { AxiosRequestConfig } from "axios";

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
  const config: AxiosRequestConfig<unknown> = {
    responseType: "blob",
    headers: { Authorization: `Bearer ${bearer}` },
  };

  if (progress)
    config.onDownloadProgress = (e) =>
      progress({ progress: e.progress || 1, img: url });

  return axios.get(url, config).then((resp) => createImageBitmap(resp.data));
}
