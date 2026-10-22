import { dispatch } from "./contentworker/messages";
import { createWorkerState } from "./contentworker/state";

/**
 * Worker for offscreen drawing in the content editor.
 */
const state = createWorkerState();
const post = (message: unknown) => postMessage(message);

self.onmessage = async (evt) => {
  await dispatch(state, evt, post);
};

export {};
