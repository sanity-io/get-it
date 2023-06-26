import type {Middleware, RetryOptions} from '../../types'

const isStream = (stream: any) =>
  stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function'

/** @public */
export default (opts: RetryOptions) => {
  const maxRetries = opts.maxRetries || 5
  const retryDelay = opts.retryDelay || getRetryDelay
  const allowRetry = opts.shouldRetry

  return {
    onError: (err, context) => {
      const options = context.options
      const max = options.maxRetries || maxRetries
      const shouldRetry = options.shouldRetry || allowRetry
      const attemptNumber = options.attemptNumber || 0

      // We can't retry if body is a stream, since it'll be drained
      if (isStream(options.body)) {
        return err
      }

      // Give up?
      if (!shouldRetry(err, attemptNumber, options) || attemptNumber >= max) {
        return err
      }

      // Create a new context with an increased attempt number, so we can exit if we reach a limit
      const newContext = Object.assign({}, context, {
        options: Object.assign({}, options, {attemptNumber: attemptNumber + 1}),
      })

      // Wait a given amount of time before doing the request again
      setTimeout(() => context.channels.request.publish(newContext), retryDelay(attemptNumber))

      // Signal that we've handled the error and that it should not propagate further
      return null
    },
  } satisfies Middleware
}

function getRetryDelay(attemptNum: number) {
  return 100 * Math.pow(2, attemptNum) + Math.random() * 100
}
