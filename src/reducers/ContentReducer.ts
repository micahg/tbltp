import { PayloadAction } from "@reduxjs/toolkit";
import { Rect } from "../utils/geometry";

// TODO THIS IS COPIED ..> FIND A BETTER WAY
interface TableState {
  overlay?: string;
  background?: string;
  viewport?: Rect;
}

export type ContentReducerState = {
  readonly overlay: string | Blob | undefined;
  readonly background: string | undefined;
  readonly viewport: Rect | undefined;
  readonly pushTime: number | undefined;
};

const initialState: ContentReducerState = {
  overlay: undefined,
  background: undefined,
  pushTime: undefined,
  viewport: undefined,
}

export const ContentReducer = (state = initialState, action: PayloadAction) => {
  switch(action.type) {
    case 'content/push':
      return { ...state, pushTime: action.payload };
    case 'content/pull':
      let tableState: TableState = (action.payload as unknown) as TableState;
      return {...state, background: tableState.background, overlay: tableState.overlay}
    case 'content/overlay':
      return {...state, overlay: action.payload };
    case 'content/background':
      return {...state, background: action.payload};
    case 'content/zoom':
      return {...state, viewport: action.payload };
    default:
      return state;
    }
}