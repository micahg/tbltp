import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppReducerState } from "../reducers/AppReducer";

export type EditorUiState = {
  readonly editingSceneId?: string;
  readonly pushTime: number | undefined;
};

const initialState: EditorUiState = {
  editingSceneId: undefined,
  pushTime: undefined,
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
  },
});

export const EditorUiReducer = editorUiSlice.reducer;
export const { setEditingSceneId, clearEditingSceneId, setPushTime } =
  editorUiSlice.actions;

export const selectEditingSceneId = (state: AppReducerState) =>
  state.editorUi.editingSceneId;

export const selectEditorUiPushTime = (state: AppReducerState) =>
  state.editorUi.pushTime;
