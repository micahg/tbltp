import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppReducerState } from "../reducers/AppReducer";

export type EditorUiState = {
  readonly editingSceneId?: string;
};

const initialState: EditorUiState = {
  editingSceneId: undefined,
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
  },
});

export const EditorUiReducer = editorUiSlice.reducer;
export const { setEditingSceneId, clearEditingSceneId } = editorUiSlice.actions;

export const selectEditingSceneId = (state: AppReducerState) =>
  state.editorUi.editingSceneId;
