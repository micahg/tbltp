const createWorker = () => ({
  postMessage: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  terminate: () => {},
});

module.exports = {
  setupOffscreenCanvas: () => createWorker(),
};
