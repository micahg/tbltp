import { PayloadAction } from "@reduxjs/toolkit";
import {
  Asset,
  HydratedTokenInstance,
  Scene,
  Token,
  TokenInstance,
} from "@micahg/tbltp-common";

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
  readonly mediaPrefix?: string;
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

function hydrateToken(
  state: ContentReducerState,
  instance: TokenInstance,
): HydratedTokenInstance | undefined {
  const token = state.tokens?.find((t) => t._id === instance.token);
  if (!token) {
    console.error(`Unable to find token for instance ${instance._id}`);
    return;
  }
  const asset = state.assets?.find((a) => a._id === token.asset);
  if (!asset || !asset.location) {
    console.error(
      `Unable to find asset for token instance ${instance._id}, asset ${token.asset}`,
    );
    return;
  }

  return {
    ...instance,
    asset: `${state.mediaPrefix}/${asset.location}`,
  };
}

export const ContentReducer = (state = initialState, action: PayloadAction) => {
  switch (action.type) {
    case "content/mediaprefix":
      return { ...state, mediaPrefix: action.payload as unknown as string };
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
      const instance = action.payload as unknown as TokenInstance;

      // ensure we have a current scene
      const idx = state.scenes.findIndex((s) => s._id === instance.scene);
      if (idx < 0) return state;
      if (!state.currentScene) return state;

      const hydrated = hydrateToken(state, instance);
      if (!hydrated) return state;

      // updates scenes
      const scenes = [...state.scenes];
      const tokens = scenes[idx].tokens || [];
      tokens.push(hydrated);
      scenes[idx] = { ...scenes[idx], tokens: tokens };

      // ensure that components watching the current scene realize there are new tokens
      const currentScene = { ...state.currentScene };

      return { ...state, scenes, currentScene };
    }
    case "content/scenetokenmoved":
    case "content/scenetokendeleted": {
      const instance = action.payload as unknown as TokenInstance;
      const tokens = [...(state.currentScene?.tokens || [])];

      let idx = tokens.findIndex((t) => t._id === instance._id);
      if (idx < 0) return state;

      if (action.type === "content/scenetokenmoved") {
        const hydrated = hydrateToken(state, instance);
        if (!hydrated) return state;
        tokens.splice(idx, 1, hydrated);
      } else {
        tokens.splice(idx, 1);
      }

      const currentScene = { ...state.currentScene, tokens: tokens };

      idx = state.scenes.findIndex((s) => s._id === instance.scene);
      const scenes = [...state.scenes];
      scenes[idx].tokens = tokens;
      return { ...state, currentScene, scenes };
    }
    case "content/scenetokens": {
      const tokens = action.payload as unknown as TokenInstance[];
      const hydrated: HydratedTokenInstance[] = [];

      const scenes = state.scenes;
      const idx = scenes.findIndex((s) => s._id === tokens[0].scene);
      if (idx < 0) return state;

      for (const instance of tokens) {
        const token = state.tokens?.find((t) => t._id === instance.token);
        if (!token) {
          console.error(`Unable to find token for instance ${instance._id}`);
          continue;
        }
        const asset = state.assets?.find((a) => a._id === token.asset);
        if (!asset || !asset.location) {
          console.error(
            `Unable to find asset for token instance ${instance._id}, asset ${token.asset}`,
          );
          continue;
        }
        hydrated.push({
          ...instance,
          asset: `${state.mediaPrefix}/${asset.location}`,
        });
      }

      // update the specified scene
      scenes[idx] = { ...scenes[idx], tokens: hydrated };

      // update the current scene if it's the same ... initially the scene at the index
      // and the current scene may not be the same...
      if (scenes[idx]._id == state.currentScene?._id) {
        const currentScene = { ...state.currentScene, tokens: hydrated };
        return { ...state, scenes: [...scenes], currentScene };
      }

      return { ...state, scenes: [...scenes] };
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
