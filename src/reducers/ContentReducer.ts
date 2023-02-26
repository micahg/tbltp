import { PayloadAction } from "@reduxjs/toolkit";

export type ContentReducerState = {
  readonly overlay: Blob | undefined;
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
    case 'content/overlay':
      return {...state, overlay: action.payload };
    case 'content/background':
      return {...state, background: action.payload};
    default:
      return state;
    }
}