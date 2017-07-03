// Used for karma tests
module.exports = {
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      options: {
        forceEnv: 'browser'
      }
    }]
  }
}
