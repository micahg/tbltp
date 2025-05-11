import axios from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { Dispatch } from "@reduxjs/toolkit";
import { getToken } from "../utils/auth";
import { NewSceneBundle } from "../middleware/ContentMiddleware";
import { LoadProgress } from "../utils/content";
import { ContentReducerError } from "../reducers/ContentReducer";

export const createSceneThunk =
  (bundle: NewSceneBundle) =>
  async (dispatch: Dispatch, getState: () => AppReducerState) => {
    const state = getState();
    const url = `${state.environment.api}/scene`;

    try {
      const headers = await getToken(state, { dispatch, getState });
      const sceneResponse = await axios.put(url, bundle, { headers });
      dispatch({ type: "content/scene", payload: sceneResponse.data });

      const sendFile = async (
        asset: File,
        layer: string,
        progress?: (evt: LoadProgress) => void,
      ) => {
        const formData = new FormData();
        formData.append("layer", layer);
        formData.append("image", asset);

        const fileHeaders = await getToken(
          state,
          { dispatch, getState },
          {
            "Content-Type": "multipart/form-data",
          },
        );

        return axios.put(
          `${state.environment.api}/scene/${sceneResponse.data._id}/content`,
          formData,
          {
            headers: fileHeaders,
            onUploadProgress: (e) =>
              progress?.({ progress: e.progress || 0, img: layer }),
          },
        );
      };

      await sendFile(bundle.player, "player", bundle.playerProgress);

      if (bundle.detail) {
        await sendFile(bundle.detail, "detail", bundle.detailProgress);
      }

      if (bundle.viewport) {
        const viewportUrl = `${state.environment.api}/scene/${sceneResponse.data._id}/viewport`;
        const viewportHeaders = await getToken(state, { dispatch, getState });
        await axios.put(viewportUrl, bundle.viewport, {
          headers: viewportHeaders,
        });
      }

      dispatch({ type: "content/scene", payload: sceneResponse.data });
      dispatch({
        type: "content/error",
        payload: { msg: "Update successful", success: true },
      });
    } catch (err) {
      const error: ContentReducerError = {
        msg: "Unknown error happened",
        success: false,
      };

      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 413) {
          error.msg = "Asset too big";
        } else if (err.response.status === 406) {
          error.msg = "Invalid asset format";
        }
      }

      dispatch({ type: "content/error", payload: error });

      // TOOD MICAH delete using scene response
      if (err.scene) {
        dispatch({ type: "content/deletescene", payload: err.scene });
        dispatch({ type: "content/currentscene" });
      }
    }
  };
