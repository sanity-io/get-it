// Used for UMD bundle
const path = require('path')

// eslint-disable-next-line no-process-env
const bundleAll = process.env.BUNDLE_ALL

module.exports = {
  mode: 'production',
  entry: path.join(__dirname, 'src', bundleAll ? 'bundle-all.js' : 'index.js'),
  output: {
    path: path.resolve(__dirname, 'umd'),
    filename: bundleAll ? 'get-it-all.min.js' : 'get-it.min.js',
    library: 'getIt',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            envName: 'browser',
          },
        },
      },
    ],
  },
}
