import { PayloadAction } from "@reduxjs/toolkit";

// TODO THIS IS COPIED ..> FIND A BETTER WAY
interface TableState {
  overlay?: string;
  background?: string;
}

export type ContentReducerState = {
  readonly overlay: string | Blob | undefined;
  readonly background: string | undefined;
  readonly pushTime: number | undefined;
};

const initialState: ContentReducerState = {
  overlay: undefined,
  background: undefined,
  pushTime: undefined,
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
    default:
      return state;
    }
}