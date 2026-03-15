import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppReducerState } from "../reducers/AppReducer";

export type EditorUiError = {
  msg: string;
  success: boolean;
};

export type EditorUiState = {
  readonly editingSceneId?: string;
  readonly pushTime: number | undefined;
  readonly err?: EditorUiError;
};

const initialState: EditorUiState = {
  editingSceneId: undefined,
  pushTime: undefined,
  err: undefined,
};

const editorUiSlice = createSlice({
  name: "editorUi",
  initialState,
  reducers: {
    setEditingSceneId: (state, action: PayloadAction<string | undefined>) => {
      state.editingSceneId = action.payload;
    },
    clearEditingSceneId: (state) => {
      state.editingSceneId = undefined;
    },
    setPushTime: (state, action: PayloadAction<number>) => {
      state.pushTime = action.payload;
    },
    setError: (state, action: PayloadAction<EditorUiError | undefined>) => {
      state.err = action.payload;
    },
  },
});

export const EditorUiReducer = editorUiSlice.reducer;
export const { setEditingSceneId, clearEditingSceneId, setPushTime, setError } =
  editorUiSlice.actions;

export const selectEditingSceneId = (state: AppReducerState) =>
  state.editorUi.editingSceneId;

export const selectEditorUiPushTime = (state: AppReducerState) =>
  state.editorUi.pushTime;

export const selectEditorUiError = (state: AppReducerState) =>
  state.editorUi.err;
