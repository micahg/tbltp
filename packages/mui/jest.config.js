/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    url: "http://localhost/",
  },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  testMatch: [
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/src/**/*.test.tsx",
    "<rootDir>/test/**/*.test.ts",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^.*/utils/offscreencanvas$": "<rootDir>/test/offscreencanvasMock.js",
    "\\.(css|less|scss|sass)$": "<rootDir>/test/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg|webp|avif)$": "<rootDir>/test/fileMock.js",
  },
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
};
