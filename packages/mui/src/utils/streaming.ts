/**
 * Main-thread helpers for recording the outbound stream to a file.
 *
 * MediaRecorder and canvas capture are main-thread-only APIs, so the content
 * worker renders the player view onto a fixed-resolution stream canvas and
 * ships each frame back as a transferred ImageBitmap. Drawing those frames
 * onto a hidden HTMLCanvasElement here is what feeds the recorder.
 */

export const STREAM_WIDTH = 1920;
export const STREAM_HEIGHT = 1080;
export const STREAM_FPS = 30;
export const STREAM_BITRATE = 6_000_000;

/**
 * Recording mime types in preference order. WebM (VP9/VP8) is preferred; MP4
 * keeps Safari (and friends) working.
 */
const MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

export function pickMimeType(
  isSupported: (type: string) => boolean,
): string | undefined {
  return MIME_TYPES.find((type) => isSupported(type));
}

export function streamRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function extension(mimeType?: string): string {
  if (mimeType?.includes("webm")) return "webm";
  if (mimeType?.includes("mp4")) return "mp4";
  return "bin";
}

function filename(mimeType?: string): string {
  return `tbltp-stream-${timestamp()}.${extension(mimeType)}`;
}

export class StreamRecorder {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private mimeType?: string;
  private filename?: string;

  /**
   * @param canvas an optional canvas to record onto -- normally the recorder
   * creates its own (detached) canvas; tests can inject a stub
   */
  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement("canvas");
    this.canvas.width = STREAM_WIDTH;
    this.canvas.height = STREAM_HEIGHT;
    this.ctx = this.canvas.getContext("2d");
  }

  /**
   * Start recording. Returns false (after logging) when the browser cannot
   * record from a canvas.
   */
  start(): boolean {
    if (this.recorder) return true;
    if (!this.ctx || !streamRecordingSupported()) {
      console.error(`Stream recording is not supported by this browser`);
      return false;
    }
    const stream = this.canvas.captureStream(STREAM_FPS);
    const mimeType = pickMimeType((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    try {
      this.recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: STREAM_BITRATE,
          })
        : new MediaRecorder(stream);
    } catch (err) {
      console.error(`Unable to create stream recorder: ${JSON.stringify(err)}`);
      return false;
    }
    this.mimeType = this.recorder.mimeType || mimeType;
    // The recorder never writes to disk itself: it buffers chunks that are
    // handed to the browser as a download on stop(). The browser saves it
    // under the user's Downloads directory using this name.
    this.filename = filename(this.mimeType);
    this.chunks = [];
    console.log(
      `Streaming canvas to ${this.filename} (${this.mimeType}, ` +
        `${STREAM_WIDTH}x${STREAM_HEIGHT} @ ${STREAM_FPS}fps, ` +
        `${STREAM_BITRATE / 1_000_000}Mbps)`,
    );
    this.recorder.ondataavailable = (evt: BlobEvent) => {
      if (evt.data && evt.data.size > 0) this.chunks.push(evt.data);
    };
    // a timeslice bounds the memory held by any single chunk
    this.recorder.start(1000);
    return true;
  }

  /**
   * Draw one frame shipped from the worker. Takes ownership of the bitmap.
   */
  drawFrame(bitmap: ImageBitmap): void {
    if (!this.ctx) {
      bitmap.close();
      return;
    }
    this.ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
  }

  /**
   * Stop recording and download the result. Resolves once the recorder has
   * flushed (and the download has been triggered).
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = this.recorder;
      if (!recorder) return resolve();
      this.recorder = undefined;
      if (recorder.state === "inactive") {
        this.download();
        return resolve();
      }
      recorder.onstop = () => {
        this.download();
        resolve();
      };
      recorder.stop();
    });
  }

  private download(): void {
    if (this.chunks.length === 0) {
      console.error(`No stream data was recorded`);
      return;
    }
    const blob = new Blob(this.chunks, { type: this.mimeType });
    this.chunks = [];
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = this.filename ?? filename(this.mimeType);
    console.log(`Streamed recording saved to ${link.download}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    // give the browser a moment to start the download before revoking
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
