import {
  STREAM_FPS,
  STREAM_HEIGHT,
  STREAM_WIDTH,
  StreamRecorder,
  pickMimeType,
  streamRecordingSupported,
} from "../src/utils/streaming";

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = jest.fn((type: string) =>
    type.includes("vp9") ? true : false,
  );

  mimeType: string;
  state: "inactive" | "recording" = "inactive";
  stream: MediaStream;
  options: MediaRecorderOptions;
  ondataavailable: ((evt: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  start = jest.fn((_timeslice?: number) => {
    this.state = "recording";
  });
  stop = jest.fn(() => {
    this.state = "inactive";
    this.onstop?.();
  });

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options ?? {};
    this.mimeType = (this.options.mimeType as string) ?? "";
    FakeMediaRecorder.instances.push(this);
  }
}

function makeCanvas() {
  const ctx = { drawImage: jest.fn() };
  const stream = {} as MediaStream;
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
    captureStream: jest.fn(() => stream),
  };
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    ctx,
    stream,
  };
}

const originalMediaRecorder = (globalThis as { MediaRecorder?: unknown })
  .MediaRecorder;
const urlStatic = URL as unknown as {
  createObjectURL?: (obj: Blob | MediaSource) => string;
  revokeObjectURL?: (url: string) => void;
};
const originalCreateObjectURL = urlStatic.createObjectURL;
const originalRevokeObjectURL = urlStatic.revokeObjectURL;
const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;

let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;

beforeAll(() => {
  jest.useFakeTimers();
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
    FakeMediaRecorder;
  HTMLCanvasElement.prototype.captureStream = jest.fn();
  createObjectURL = jest.fn(() => "blob:stream-recording");
  revokeObjectURL = jest.fn();
  urlStatic.createObjectURL = createObjectURL;
  urlStatic.revokeObjectURL = revokeObjectURL;
});

afterAll(() => {
  jest.useRealTimers();
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
    originalMediaRecorder;
  if (originalCreateObjectURL) {
    urlStatic.createObjectURL = originalCreateObjectURL;
  } else {
    delete urlStatic.createObjectURL;
  }
  if (originalRevokeObjectURL) {
    urlStatic.revokeObjectURL = originalRevokeObjectURL;
  } else {
    delete urlStatic.revokeObjectURL;
  }
  if (originalCaptureStream) {
    HTMLCanvasElement.prototype.captureStream = originalCaptureStream;
  } else {
    delete HTMLCanvasElement.prototype.captureStream;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.isTypeSupported.mockImplementation((type: string) =>
    type.includes("vp9") ? true : false,
  );
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
    FakeMediaRecorder;
});

describe("stream recording", () => {
  describe("pickMimeType", () => {
    it("prefers the first supported type", () => {
      expect(pickMimeType(() => true)).toBe("video/webm;codecs=vp9");
    });

    it("skips unsupported types", () => {
      expect(
        pickMimeType((type) => type === "video/mp4"),
      ).toBe("video/mp4");
    });

    it("returns undefined when nothing is supported", () => {
      expect(pickMimeType(() => false)).toBeUndefined();
    });
  });

  describe("streamRecordingSupported", () => {
    it("requires MediaRecorder and canvas capture", () => {
      expect(streamRecordingSupported()).toBe(true);

      (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
      expect(streamRecordingSupported()).toBe(false);
      (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
        FakeMediaRecorder;

      const captured = HTMLCanvasElement.prototype
        .captureStream as jest.Mock;
      const saved = HTMLCanvasElement.prototype.captureStream;
      delete HTMLCanvasElement.prototype.captureStream;
      expect(streamRecordingSupported()).toBe(false);
      HTMLCanvasElement.prototype.captureStream = saved;
      expect(captured).not.toHaveBeenCalled();
    });
  });

  describe("StreamRecorder", () => {
    it("sizes the canvas to the stream resolution", () => {
      const { canvas } = makeCanvas();

      new StreamRecorder(canvas);

      expect(canvas.width).toBe(STREAM_WIDTH);
      expect(canvas.height).toBe(STREAM_HEIGHT);
    });

    it("refuses to start on an unsupported browser", () => {
      (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);

      expect(recorder.start()).toBe(false);
      expect(console.error).toHaveBeenCalled();
      expect(FakeMediaRecorder.instances).toHaveLength(0);
    });

    it("starts recording with the preferred mime type and bitrate", () => {
      const { canvas, stream } = makeCanvas();
      const recorder = new StreamRecorder(canvas);

      expect(recorder.start()).toBe(true);
      expect(canvas.captureStream).toHaveBeenCalledWith(STREAM_FPS);

      const instance = FakeMediaRecorder.instances[0];
      expect(instance.stream).toBe(stream);
      expect(instance.options.mimeType).toBe("video/webm;codecs=vp9");
      expect(instance.options.videoBitsPerSecond).toBe(6_000_000);
      expect(instance.start).toHaveBeenCalledWith(1000);
      expect(instance.state).toBe("recording");
    });

    it("starts without options when no mime type is supported", () => {
      FakeMediaRecorder.isTypeSupported.mockReturnValue(false);
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);

      expect(recorder.start()).toBe(true);
      expect(FakeMediaRecorder.instances[0].options).toEqual({});
    });

    it("only starts once", () => {
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);

      expect(recorder.start()).toBe(true);
      expect(recorder.start()).toBe(true);
      expect(FakeMediaRecorder.instances).toHaveLength(1);
    });

    it("draws and releases worker frames", () => {
      const { canvas, ctx } = makeCanvas();
      const recorder = new StreamRecorder(canvas);
      recorder.start();
      const bitmap = { close: jest.fn() } as unknown as ImageBitmap;

      recorder.drawFrame(bitmap);

      expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
      expect(bitmap.close).toHaveBeenCalled();
    });

    it("closes frames it cannot draw", () => {
      const recorder = new StreamRecorder();
      const bitmap = { close: jest.fn() } as unknown as ImageBitmap;

      recorder.drawFrame(bitmap);

      expect(bitmap.close).toHaveBeenCalled();
    });

    it("stops, downloads the recording and revokes the url", async () => {
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);
      recorder.start();
      const instance = FakeMediaRecorder.instances[0];
      instance.ondataavailable?.({ data: new Blob(["chunks"]) } as BlobEvent);
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      await recorder.stop();

      expect(instance.stop).toHaveBeenCalled();
      expect(click).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(console.error).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30000);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:stream-recording");
    });

    it("resolves without downloading when nothing was recorded", async () => {
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);

      await expect(recorder.stop()).resolves.toBeUndefined();

      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("logs when stopping produced no data", async () => {
      const { canvas } = makeCanvas();
      const recorder = new StreamRecorder(canvas);
      recorder.start();

      await recorder.stop();

      expect(console.error).toHaveBeenCalledWith("No stream data was recorded");
    });
  });
});
