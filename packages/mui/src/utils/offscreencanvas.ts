let worker: Worker;
// import contentworkerurl from "src/utils/contentworker?worker&url";

export function setupOffscreenCanvas(
  backgroundCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  thingsOnTop = false,
): Worker {
  // only create a web worker if we don't have one already
  if (!worker) {
    // worker = new Worker(contentworkerurl, { type: "module" });
    worker = new Worker(new URL("./contentworker.ts", import.meta.url), {
      type: "module",
    });
  }
  // if we try to transfer something twice, its an error so the caller must keep track of it
  try {
    const background = backgroundCanvas.transferControlToOffscreen();
    const overlay = overlayCanvas.transferControlToOffscreen();
    worker.postMessage(
      {
        cmd: "init",
        thingsOnTop: thingsOnTop,
        background: background,
        overlay: overlay,
      },
      [background, overlay],
    );
  } catch (err) {
    /**
     * We see this when useEffect is called multiple times, invoking this method.
     * To avoid it use can useState() with an object that tracks if the transfer
     * has already taken place, and if it has, then return before calling.
     */
    console.error(`ERROR: init failed with ${JSON.stringify(err)}`);
  }

  return worker;
}
