const debugIt = require('debug')

const namespace = 'reqlib' // @todo fix requestlib name
const log = debugIt(namespace)

export const debug = (debugOpts = {}) => {
  const verbose = debugOpts.verbose
  return {
    preRequest: options => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (!debugIt.enabled(namespace)) {
        return
      }

      log('HTTP %s %s', options.method || 'GET', options.url)

      if (verbose && options.body && typeof options.body === 'string') {
        log('Request body: %s', options.body)
      }

      if (verbose && options.headers) {
        log('Request headers: %s', JSON.stringify(options.headers, null, 2))
      }
    },

    onResponse: res => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (!debugIt.enabled(namespace)) {
        return
      }

      log('Response code: %s %s', res.statusCode, res.statusMessage)

      if (verbose && res.body) {
        log('Response body: %s', stringifyBody(res))
      }
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
