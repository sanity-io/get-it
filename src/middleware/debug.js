const debugIt = require('debug')

module.exports = (opts = {}) => {
  const verbose = opts.verbose
  const namespace = 'get-it'
  const defaultLogger = debugIt(namespace)
  const log = opts.log || defaultLogger
  const shortCircuit = log === defaultLogger && !debugIt.enabled(namespace)
  let requestId = 0

  return {
    processOptions: options => {
      options.requestId = options.requestId || ++requestId
      return options
    },

    onRequest: options => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (shortCircuit) {
        return
      }

      log('[%s] HTTP %s %s', options.requestId, options.method, options.url)

      if (verbose && options.body && typeof options.body === 'string') {
        log('[%s] Request body: %s', options.requestId, options.body)
      }

      if (verbose && options.headers) {
        log('[%s] Request headers: %s', options.requestId, JSON.stringify(options.headers, null, 2))
      }
    },

    onResponse: (res, context) => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (shortCircuit) {
        return res
      }

      const reqId = context.options.requestId

      log('[%s] Response code: %s %s', reqId, res.statusCode, res.statusMessage)

      if (verbose && res.body) {
        log('[%s] Response body: %s', reqId, stringifyBody(res))
      }

      return res
    },

    onError: (err, context) => {
      log('[%s] ERROR: %s', context.options.requestId, err.message)
      return err
    }
  }
}

function stringifyBody(res) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? tryFormat(res.body) : res.body
}

// Attempt pretty-formatting JSON
function tryFormat(body) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body
    return JSON.stringify(parsed, null, 2)
  } catch (err) {
    return body
  }
}
