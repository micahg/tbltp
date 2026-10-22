import { TextDecoder, TextEncoder } from "node:util";
import "@testing-library/jest-dom";

Object.assign(globalThis, { TextDecoder, TextEncoder });

if (!globalThis.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverMock,
    writable: true,
  });
}
