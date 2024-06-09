import { Rect } from "./geometry";

let worker: Worker;

export function setupOffscreenCanvas(
  bearer: string,
  backgroundCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  alreadyTransferred: boolean,
  angle: number,
  background?: string,
  overlay?: string,
  viewport?: Rect,
): Worker {
  const values = {
    bearer: bearer,
    overlay: overlay,
    background: background,
    angle: angle,
    viewport: viewport,
  };
  // only create a web worker if we don't have one already
  if (!worker) {
    worker = new Worker(new URL("./contentworker.ts", import.meta.url));
  }
  // if we try to transfer something twice, its an error so the caller must keep track of it
  if (!alreadyTransferred) {
    try {
      const background = backgroundCanvas.transferControlToOffscreen();
      const overlay = overlayCanvas.transferControlToOffscreen();
      worker.postMessage(
        {
          cmd: "init",
          background: background,
          overlay: overlay,
          values: values,
        },
        [background, overlay],
      );
    } catch (err) {
      /**
       * normally you wouldn't get yourself into a situation where you're
       * transferring twice. However, in react strict mode, you do. Just
       * ignore the exception since its already transferred.
       */
      console.warn(
        "Ignore the following error if you're doing development in react strict mode...",
      );
      console.error(err);
    }
  } else {
    worker.postMessage({ cmd: "init", values: values });
  }

  return worker;
}
