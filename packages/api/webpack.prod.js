const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [
    new webpack.DefinePlugin({
      PRODUCTION: JSON.stringify(true),
    }),
  ],
});

// build the prod js with tree shaking node modules
// to avoid installing in the docker image
delete module.exports.externals;
