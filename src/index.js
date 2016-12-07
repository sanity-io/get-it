import pubsub from 'nano-pubsub'
import middlewareReducer from './util/middlewareReducer'
import {processOptions} from './middleware/defaultOptionsProcessor'
import httpRequest from './request' // node-request in node, browser-request in browsers

const channelNames = ['request', 'response', 'error', 'abort']

module.exports = function createRequester(initMiddleware = []) {
  const middleware = {
    processOptions: [processOptions],
    onRequest: [],
    onResponse: [],
    onError: [],
    onReturn: []
  }

  function request(opts, ...args) {
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

    const unsubscribe = channels.request.subscribe(() => {
      // We only want to perform the request on the first triggered event
      unsubscribe()

      // Let request adapters (node/browser) perform the actual request
      httpRequest(context, onResponse)
    })

    // See if any middleware wants to modify the return value - for instance
    // the promise or observable middlewares
    const returnValue = applyMiddleware('onReturn', channels, ...args)

    // If return value has been modified by a middleware, we expect the middleware
    // to publish on the 'request' channel. If it hasn't been modified, we want to
    // trigger it right away
    if (returnValue === channels) {
      channels.request.publish()
    }

    return returnValue

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
    if (newMiddleware.onReturn && middleware.onReturn.length > 0) {
      throw new Error('Tried to add new middleware with `onReturn` handler, but another handler has already been registered for this event')
    }

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
