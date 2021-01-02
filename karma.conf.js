/* eslint-disable no-process-env */
const webpackConfig = require('./webpack.config')
const server = require('./test/helpers/server')

const allBrowsers = ['Chrome', 'PhantomJS', 'Firefox']

const envBrowsers = process.env.BROWSERS || allBrowsers.join(',')
const keepOpen = process.env.KEEP_OPEN || false

const useBrowsers = envBrowsers.split(',')

module.exports = config => {
  config.set({
    browsers: useBrowsers,
    frameworks: ['mocha'],
    singleRun: !keepOpen,

    middleware: ['test-server'],
    plugins: config.plugins.concat([
      {'middleware:test-server': ['factory', server.responseHandlerFactory]}
    ]),

    files: [{pattern: 'test/*.test.js', watched: false}],

    preprocessors: {
      'test/*.test.js': ['webpack', 'sourcemap']
    },

    webpack: Object.assign({}, webpackConfig, {devtool: 'inline-source-map'}),
    webpackServer: {noInfo: true},
  })
}
