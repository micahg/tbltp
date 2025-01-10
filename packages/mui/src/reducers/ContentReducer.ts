import { PayloadAction } from "@reduxjs/toolkit";
import { Asset, Scene, Token, TokenInstance } from "@micahg/tbltp-common";

// copied from the api
interface TableTop {
  _id: string;
  user: string;
  scene?: string;
}

export type ContentReducerError = {
  msg: string;
  success: boolean;
};

export type ContentReducerState = {
  readonly pushTime: number | undefined;
  readonly currentScene?: Scene;
  readonly scenes: Scene[];
  readonly assets?: Asset[];
  readonly tokens?: Token[];
  readonly err?: ContentReducerError;
};

const initialState: ContentReducerState = {
  pushTime: undefined,
  currentScene: undefined,
  scenes: [],
  assets: undefined,
  tokens: undefined,
  err: undefined,
};

export const ContentReducer = (state = initialState, action: PayloadAction) => {
  switch (action.type) {
    case "content/push":
      return { ...state, pushTime: new Date().getTime() };
    case "content/pull": {
      const table: TableTop = action.payload as unknown as TableTop;
      const tableSceneIdx = state.scenes.findIndex(
        (s) => s._id === table.scene,
      );
      if (tableSceneIdx < 0) {
        console.error(
          `Unable to find scene ${table.scene} in ${JSON.stringify(
            state.scenes,
          )}`,
        );
        return state;
      }
      console.log(`MICAH updating current scene ${action.type}`);
      return { ...state, currentScene: state.scenes[tableSceneIdx] };
    }
    case "content/zoom":
      return { ...state, scene: action.payload as unknown as Scene };
    case "content/assets": {
      const assets: Asset[] = action.payload as unknown as Asset[];
      return { ...state, assets };
    }
    case "content/tokens": {
      const tokens: Token[] = action.payload as unknown as Token[];
      const ret = { ...state, tokens };
      return ret;
    }
    case "content/scenes": {
      const scenes: Scene[] = action.payload as unknown as Scene[];
      if (!state.currentScene) {
        console.log(`MICAH updating current scene ${action.type}`);
        return { ...state, scenes: scenes, currentScene: scenes[0] };
      }
      return { ...state, scenes: scenes };
    }
    case "content/scene": {
      // load an updated or new scene
      const scene: Scene = action.payload as unknown as Scene;
      const idx = state.scenes.findIndex((s) => s._id === scene._id);
      if (idx < 0) return { ...state, scenes: [...state.scenes, scene] };
      state.scenes.splice(idx, 1, scene); // remember this changes inline, hence absence of return
      // historically there was some notion that we don't want to rerender if
      // we are just swapping in new contents. But if an image, angle or viewport of
      // the current scene is updated we do need to rerender.
      if (scene._id !== state.currentScene?._id)
        return { ...state, scenes: state.scenes };
      // console.log(`MICAH updating current scene ${action.type}`);
      // console.log(`MICAH old scene is ${JSON.stringify(state.currentScene)}`);
      // console.log(`MICAH new scene is ${JSON.stringify(scene)}`);
      return { ...state, currentScene: scene, scenes: state.scenes };
    }
    case "content/deletescene": {
      const scene: Scene = action.payload as unknown as Scene;
      const scenes = state.scenes.filter((s) => s._id !== scene._id);
      return { ...state, scenes: scenes };
    }
    case "content/currentscene": {
      const scene: Scene = action.payload as unknown as Scene;
      console.log(`MICAH updating current scene ${action.type}`);
      return { ...state, currentScene: scene };
    }
    case "content/updateassetdata":
    case "content/updateasset": {
      const asset = action.payload as unknown as Asset;
      const assets = state.assets || [];
      const idx = assets.findIndex((a) => a._id === asset._id);
      if (idx < 0) return { ...state, assets: [...assets, asset] };
      const newAssets = [...assets];
      newAssets.splice(idx, 1, asset);
      return { ...state, assets: newAssets };
    }
    case "content/deleteasset": {
      const asset = action.payload as unknown as Asset;
      const assets = state.assets || [];
      const idx = assets.findIndex((a) => a._id === asset._id);
      if (idx < 0) return state;
      const newAssets = [...assets];
      newAssets.splice(idx, 1);
      return { ...state, assets: newAssets };
    }
    case "content/updatetoken": {
      const token = action.payload as unknown as Token;
      const tokens = state.tokens || [];
      const idx = tokens.findIndex((a) => a._id === token._id);
      if (idx < 0) return { ...state, tokens: [...tokens, token] };
      const newTokens = [...tokens];
      newTokens.splice(idx, 1, token);
      return { ...state, tokens: newTokens };
    }
    case "content/deletetoken": {
      const token = action.payload as unknown as Token;
      const idx =
        state.tokens === undefined
          ? -1
          : state.tokens.findIndex((a) => a._id === token._id);
      if (idx < 0) return state;
      const tokens = [...state.tokens!];
      tokens.splice(idx, 1);
      return { ...state, tokens: tokens };
    }
    case "content/scenetokenplaced": {
      break;
    }
    case "content/scenetokens": {
      // ensure we have a current scene
      const scene = state.currentScene;
      if (!scene) return state;

      const tokens = action.payload as unknown as TokenInstance[];

      const scenes = state.scenes;
      const idx = state.scenes.findIndex((s) => s._id === scene._id);

      scenes[idx] = { ...scenes[idx], tokens };
      const newScene = { ...scene, tokens };
      console.log(`MICAH updating current scene ${action.type}`);
      return { ...state, scenes: [...scenes], currentScene: newScene };
      break;
    }
    case "content/error": {
      // important to let undefined through. This will clear the error
      // and allow components to get it off screen when their state updates
      const err = action.payload as unknown as ContentReducerError;
      return { ...state, err: err };
    }
    default:
      return state;
  }
};
