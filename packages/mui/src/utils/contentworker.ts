import { dispatch } from "./contentworker/messages";
import { createWorkerState } from "./contentworker/state";

/**
 * Worker for offscreen drawing in the content editor.
 */
const state = createWorkerState();
/**
 * DedicatedWorkerGlobalScope.postMessage takes (message, transfer). The app
 * tsconfig checks this file against the DOM lib, where the global postMessage
 * is Window's, so spell the worker signature out.
 */
const workerPostMessage = postMessage as unknown as (
  message: unknown,
  transfer?: Transferable[],
) => void;
const post = (message: unknown, transfer?: Transferable[]) =>
  workerPostMessage(message, transfer ?? []);

self.onmessage = async (evt) => {
  await dispatch(state, evt, post);
};

export {};
