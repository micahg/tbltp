const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [
    new webpack.DefinePlugin({
      PRODUCTION: JSON.stringify(false),
      DB_URL: JSON.stringify("mongodb://localhost:27017/yardduty")
    })
  ],
});
