/* eslint-disable no-process-env */
const webpackConfig = require('./webpack.config')
const server = require('./test/helpers/server')

const virtualOnly = process.env.VIRTUAL_ONLY || false
const virtual = process.env.VIRTUAL || process.env.VIRTUAL_ONLY || false
const keepOpen = process.env.KEEP_OPEN || false

const virtuals = ['VirtualIE9']
const browsers = ['Chrome', 'PhantomJS', 'Firefox'].concat(virtual ? virtuals : [])

const useBrowsers = virtualOnly ? virtuals : browsers

module.exports = config => {
  config.set({
    browsers: useBrowsers,
    frameworks: ['mocha'],
    singleRun: !keepOpen,

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
    webpackServer: {noInfo: true},

    /* eslint-disable camelcase */
    customLaunchers: {
      VirtualIE9: {
        base: 'VirtualBoxAny',
        config: {
          vm_name: 'IE9 - Win7',
          use_gui: keepOpen,
          shutdown: !keepOpen,
          cmd: 'C:\\Program Files\\Internet Explorer\\iexplore.exe'
        }
      }
    }
    /* eslint-enable camelcase */
  })
}
