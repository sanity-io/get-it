const objectAssign = require('object-assign')
const defaultShouldRetry = require('../util/node-shouldRetry')

const retry = module.exports = (opts = {}) => {
  const maxRetries = opts.maxRetries || 5
  const retryDelay = opts.retryDelay || getRetryDelay
  const shouldRetry = opts.shouldRetry || defaultShouldRetry

  return {
    onError: (err, context) => {
      const options = context.options
      const attemptNumber = options.attemptNumber || 0

      // Give up?
      if (!shouldRetry(err, attemptNumber) || attemptNumber >= maxRetries) {
        return err
      }

      // Create a new context with an increased attempt number, so we can exit if we reach a limit
      const newContext = objectAssign({}, context, {
        options: objectAssign({}, options, {attemptNumber: attemptNumber + 1})
      })

      // Wait a given amount of time before doing the request again
      setTimeout(() => context.channels.request.publish(newContext), retryDelay(attemptNumber))

      // Signal that we've handled the error and that it should not propagate further
      return null
    }
  }
}

retry.shouldRetry = defaultShouldRetry

function getRetryDelay(attemptNum) {
  return (100 * Math.pow(2, attemptNum)) + (Math.random() * 100)
}
