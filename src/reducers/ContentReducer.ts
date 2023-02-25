import { PayloadAction } from "@reduxjs/toolkit";

export type ContentReducerState = {
  readonly overlay: Blob | undefined;
  readonly background: string | undefined;
};

const initialState: ContentReducerState = {
  overlay: undefined,
  background: undefined,
}

export const ContentReducer = (state = initialState, action: PayloadAction) => {
  switch(action.type) {
    case 'content/overlay':
      return {...state, overlay: action.payload };
    case 'content/background':
      return {...state, background: action.payload};
    default:
      return state;
    }
}