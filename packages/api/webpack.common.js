const fs = require("fs");

// forces all node modules to be treated as externals
// borrowed from http://jlongster.com/Backend-Apps-with-Webpack--Part-I
var nodeModules = {};

fs.readdirSync("node_modules")
  .filter(function (x) {
    return [".bin"].indexOf(x) === -1;
  })
  .forEach(function (mod) {
    nodeModules[mod] = "commonjs " + mod;
  });

module.exports = {
  entry: {
    server: "./src/server.ts",
  },
  target: "node",
  output: {
    path: __dirname + "/.",
    filename: "[name].js",
    chunkFilename: "[id].chunk.js",
  },
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".js"],
  },
  devtool: "eval-source-map",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{ loader: "ts-loader" }],
      },
    ],
  },
  externals: nodeModules,
  ignoreWarnings: [
    {
      module: /opentelemetry/,
      message:
        /Critical dependency: the request of a dependency is an expression/,
    },
    {
      module: /express/,
      message:
        /Critical dependency: the request of a dependency is an expression/,
    },
    {
      // don't error out over peer dependencies we're not using
      module: /mongodb|ws/,
      message: /Module not found: Error: Can't resolve/,
    },
  ],
};
