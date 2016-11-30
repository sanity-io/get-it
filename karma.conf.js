const webpackConfig = require('./webpack.config')
const server = require('./test/helpers/server')

module.exports = config => {
  config.set({
    browsers: ['Chrome', 'PhantomJS', 'Firefox'],
    frameworks: ['mocha'],
    singleRun: true,

    middleware: ['test-server'],
    plugins: config.plugins.concat([
      {'middleware:test-server': ['factory', server.responseHandlerFactory]}
    ]),

    files: [
      {pattern: 'test/*.test.js', watched: false}
    ],

    preprocessors: {
      'test/*.test.js': ['webpack', 'sourcemap']
    },

    webpack: Object.assign({}, webpackConfig, {devtool: 'inline-source-map'}),
    webpackServer: {noInfo: true}
  })
}
