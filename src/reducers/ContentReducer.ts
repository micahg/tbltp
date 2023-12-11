import { PayloadAction } from "@reduxjs/toolkit";
import { Rect } from "../utils/geometry";

// copied from api
export interface Scene {
  _id?: string,
  user: string;
  description: string;
  overlayContent?: string;
  overlayContentRev?: number;
  detailContent?: string;
  detailContentRev?: number;
  playerContent?: string;
  playerContentRev?: number;
  viewport?: Rect;
  backgroundSize?: Rect;
  angle?: number;
}

// copied from the api
interface TableTop {
  _id: string;
  user: string;
  scene?: string;
}

export type ContentReducerState = {
  readonly pushTime: number | undefined;
  readonly currentScene?: Scene;
  readonly scenes: Scene[];
};

const initialState: ContentReducerState = {
  pushTime: undefined,
  currentScene: undefined,
  scenes: [],
}

export const ContentReducer = (state = initialState, action: PayloadAction) => {
  switch(action.type) {
    case 'content/push':
      return { ...state, pushTime: action.payload };
    case 'content/pull': {
      const table: TableTop = (action.payload as unknown) as TableTop;
      const tableSceneIdx = state.scenes.findIndex(s => s._id === table.scene);
      if (tableSceneIdx < 0) {
        console.error(`Unable to find scene ${table.scene} in ${JSON.stringify(state.scenes)}`);
        return state;
      }
      return  {...state, currentScene: state.scenes[tableSceneIdx]}
    }
    case 'content/zoom':
      return {...state, scene: ((action.payload as unknown) as Scene) };
    case 'content/scenes': {
      const scenes: Scene[] = (action.payload as unknown) as Scene[];
      if (!state.currentScene) return {...state, scenes: scenes, currentScene: scenes[0]};
      return {...state, scenes: scenes};
    }
    case 'content/scene': {// load an updated or new scene
      const scene: Scene = (action.payload as unknown) as Scene;
      const idx = state.scenes.findIndex(s => s._id === scene._id);
      if (idx < 0) return {...state, scenes: [...state.scenes, scene]};
      state.scenes.splice(idx, 1, scene); // remember this changes inline, hence absense from return
      // historically there was some notion that we don't want to rerender if
      // we are just swappign in new contents. But we an image or viewport of
      // the current scene is updated we do need to rerender.
      if (scene._id !== state.currentScene?._id) return {...state, scenes: state.scenes};
      return {...state, currentScene: scene, scenes: state.scenes};
    }
    case 'content/deletescene': {
      const scene: Scene = (action.payload as unknown) as Scene;
      const scenes = state.scenes.filter(s => s._id !== scene._id);
      return {...state, scenes: scenes, currentScene: scene};
    }
    case 'content/currentscene':{
      const scene: Scene = (action.payload as unknown) as Scene;
      return { ...state, currentScene: scene};
    }
    default:
      return state;
    }
}
