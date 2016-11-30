const log = require('debug')('reqlib') // @todo fix requestlib name

export const debug = (debugOpts = {}) => {
  const verbose = debugOpts.verbose
  return {
    preRequest: options => {
      log('HTTP %s %s', options.method || 'GET', options.url)

      if (verbose && options.body && typeof options.body === 'string') {
        log('Request body: %s', options.body)
      }

      if (verbose && options.headers) {
        log('Request headers: %s', JSON.stringify(options.headers, null, 2))
      }
    },

    onResponse: res => {
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
  return isJson ? JSON.stringify(res.body, null, 2) : res.body
}
