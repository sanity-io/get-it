import {processOptions} from './middleware/defaultOptionsProcessor'
import {validateOptions} from './middleware/defaultOptionsValidator'
import type {
  HttpRequest,
  HttpRequestOngoing,
  Middleware,
  MiddlewareChannels,
  MiddlewareHooks,
  MiddlewareReducer,
  Middlewares,
  Requester,
  RequestOptions,
} from './types'
import {middlewareReducer} from './util/middlewareReducer'
import {createPubSub} from './util/pubsub'

const channelNames = [
  'request',
  'response',
  'progress',
  'error',
  'abort',
] satisfies (keyof MiddlewareChannels)[]
const middlehooks = [
  'processOptions',
  'validateOptions',
  'interceptRequest',
  'finalizeOptions',
  'onRequest',
  'onResponse',
  'onError',
  'onReturn',
  'onHeaders',
] satisfies (keyof MiddlewareHooks)[]

/** @public */
export function createRequester(initMiddleware: Middlewares, httpRequest: HttpRequest): Requester {
  const loadedMiddleware: Middlewares = []
  const middleware: MiddlewareReducer = middlehooks.reduce(
    (ware, name) => {
      ware[name] = ware[name] || []
      return ware
    },
    {
      processOptions: [processOptions],
      validateOptions: [validateOptions],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  )

  function request(opts: RequestOptions | string) {
    const onResponse = (reqErr: any, res: any, ctx: any) => {
      let error = reqErr
      let response = res

      // We're processing non-errors first, in case a middleware converts the
      // response into an error (for instance, status >= 400 == HttpError)
      if (!error) {
        try {
          response = applyMiddleware('onResponse', res, ctx)
        } catch (err) {
          response = null
          error = err
        }
      }

      // Apply error middleware - if middleware return the same (or a different) error,
      // publish as an error event. If we *don't* return an error, assume it has been handled
      error = error && applyMiddleware('onError', error, ctx)

      // Figure out if we should publish on error/response channels
      if (error) {
        channels.error.publish(error)
      } else if (response) {
        channels.response.publish(response)
      }
    }

    const channels: MiddlewareChannels = channelNames.reduce((target, name) => {
      target[name] = createPubSub() as MiddlewareChannels[typeof name]
      return target
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as any)

    // Prepare a middleware reducer that can be reused throughout the lifecycle
    const applyMiddleware = middlewareReducer(middleware)

    // Parse the passed options
    const options = applyMiddleware('processOptions', opts)

    // Validate the options
    applyMiddleware('validateOptions', options)

    // Build a context object we can pass to child handlers
    const context = {options, channels, applyMiddleware}

    // We need to hold a reference to the current, ongoing request,
    // in order to allow cancellation. In the case of the retry middleware,
    // a new request might be triggered
    let ongoingRequest: HttpRequestOngoing | undefined
    const unsubscribe = channels.request.subscribe((ctx) => {
      // Let request adapters (node/browser) perform the actual request
      ongoingRequest = httpRequest(ctx, (err, res) => onResponse(err, res, ctx))
    })

    // If we abort the request, prevent further requests from happening,
    // and be sure to cancel any ongoing request (obviously)
    channels.abort.subscribe(() => {
      unsubscribe()
      if (ongoingRequest) {
        ongoingRequest.abort()
      }
    })

    // See if any middleware wants to modify the return value - for instance
    // the promise or observable middlewares
    const returnValue = applyMiddleware('onReturn', channels, context)

    // If return value has been modified by a middleware, we expect the middleware
    // to publish on the 'request' channel. If it hasn't been modified, we want to
    // trigger it right away
    if (returnValue === channels) {
      channels.request.publish(context)
    }

    return returnValue
  }

  request.use = function use(newMiddleware: Middleware) {
    if (!newMiddleware) {
      throw new Error('Tried to add middleware that resolved to falsey value')
    }

    if (typeof newMiddleware === 'function') {
      throw new Error(
        'Tried to add middleware that was a function. It probably expects you to pass options to it.'
      )
    }

    if (newMiddleware.onReturn && middleware.onReturn.length > 0) {
      throw new Error(
        'Tried to add new middleware with `onReturn` handler, but another handler has already been registered for this event'
      )
    }

    middlehooks.forEach((key) => {
      if (newMiddleware[key]) {
        middleware[key].push(newMiddleware[key] as any)
      }
    })

    loadedMiddleware.push(newMiddleware)
    return request
  }

  request.clone = () => createRequester(loadedMiddleware, httpRequest)

  initMiddleware.forEach(request.use)

  return request
}
