import pubsub from 'nano-pubsub'
import middlewareReducer from './util/middlewareReducer'
import {parseOptions} from './middleware/parseOptions'
import httpRequest from './request' // node-request in node, browser-request in browsers

const channelNames = ['response', 'error', 'abort']

module.exports = function createRequester(initMiddleware = []) {
  const middleware = {
    processOptions: [parseOptions],
    parseResponse: [],
    preRequest: [],
    onResponse: []
  }

  function request(opts) {
    const channels = channelNames.reduce((target, name) => {
      target[name] = pubsub()
      return target
    }, {})

    // Prepare a middleware reducer that can be reused throughout the lifecycle
    const applyMiddleware = middlewareReducer(middleware, channels)

    // Parse the passed options
    const options = applyMiddleware('processOptions', opts)

    // Build a context option we can pass to child handlers
    const context = {channels, applyMiddleware}

    // Let middleware know we're about to do a request
    applyMiddleware('preRequest', options)

    // Let request adapters (node/browser) perform the actual request
    httpRequest(options, context, (err, res) => {
      if (err) {
        // @todo hook in retry here?
        channels.error.publish(err)
        return
      }

      // Notify middleware about the response
      applyMiddleware('onResponse', res)

      // Allow middleware to parse the response, possibly returning an error,
      // otherwise return the parsed response
      const response = applyMiddleware('parseResponse', res)
      const channel = response instanceof Error ? 'error' : 'response'
      channels[channel].publish(response)
    })

    // @todo middleware that modifies return value
    return channels
  }

  request.use = function use(newMiddleware) {
    // @todo validate middlewares when not in production
    for (const key in newMiddleware) {
      if (middleware.hasOwnProperty(key)) {
        middleware[key].push(newMiddleware[key])
      }
    }
  }

  initMiddleware.forEach(request.use)

  return request
}
