import pubsub from 'nano-pubsub'
import middlewareReducer from './util/middlewareReducer'
import {processOptions} from './middleware/defaultOptionsProcessor'
import httpRequest from './request' // node-request in node, browser-request in browsers

const channelNames = ['response', 'error', 'abort']

module.exports = function createRequester(initMiddleware = []) {
  const middleware = {
    processOptions: [processOptions],
    onRequest: [],
    onResponse: [],
    onError: [],
    onReturn: []
  }

  function request(opts) {
    const channels = channelNames.reduce((target, name) => {
      target[name] = pubsub()
      return target
    }, {})

    // Prepare a middleware reducer that can be reused throughout the lifecycle
    const applyMiddleware = middlewareReducer(middleware)

    // Parse the passed options
    const options = applyMiddleware('processOptions', opts)

    // Build a context object we can pass to child handlers
    let context = {
      options,
      channels,
      applyMiddleware,
      request: ctx => {
        // Redeclare context in case a middleware has altered it
        context = ctx
        httpRequest(ctx, onResponse)
      }
    }

    // Let request adapters (node/browser) perform the actual request
    httpRequest(context, onResponse)

    return applyMiddleware('onReturn', channels)

    function onResponse(reqErr, res) {
      let error = reqErr
      let response = res

      // We're processing non-errors first, in case a middleware converts the
      // response into an error (for instance, status >= 400 == HttpError)
      if (!error) {
        response = applyMiddleware.untilError('onResponse', res, context)
        if (response instanceof Error) {
          error = response
          response = null
        }
      }

      // Apply error middleware - if middleware return the same (or a different) error,
      // publish as an error event. If we *don't* return an error, assume it has been handled
      error = error && applyMiddleware('onError', error, context)

      // Figure out if we should publish on error/response channels
      if (error) {
        channels.error.publish(error)
      } else if (response) {
        channels.response.publish(response)
      }
    }
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
