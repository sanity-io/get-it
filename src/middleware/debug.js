const debugIt = require('debug')

const namespace = 'get-it'
const log = debugIt(namespace)

export const debug = (debugOpts = {}) => {
  const verbose = debugOpts.verbose
  let requestId = 0

  return {
    processOptions: options => {
      options.requestId = options.requestId || ++requestId
      return options
    },

    onRequest: options => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (!debugIt.enabled(namespace)) {
        return
      }

      log('[%s] HTTP %s %s', options.requestId, options.method || 'GET', options.url)

      if (verbose && options.body && typeof options.body === 'string') {
        log('[%s] Request body: %s', options.requestId, options.body)
      }

      if (verbose && options.headers) {
        log('[%s] Request headers: %s', options.requestId, JSON.stringify(options.headers, null, 2))
      }
    },

    onResponse: (res, context) => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (!debugIt.enabled(namespace)) {
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
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch (err) {
    return body
  }
}
