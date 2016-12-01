const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const objectAssign = require('object-assign')
const unzipResponse = require('unzip-response')

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (res, reqUrl, method, body) => ({
  body,
  url: reqUrl,
  method: method,
  headers: res.headers,
  statusCode: res.statusCode,
  statusMessage: res.statusMessage,
})

module.exports = (options, channels, applyMiddleware) => {
  const uri = objectAssign({}, options, url.parse(options.url))
  const protocol = uri.protocol === 'https:' ? https : http
  const contentLength = options.body ? {'Content-Length': options.body.length} : {}

  const reqOpts = objectAssign(uri, {
    method: options.method,
    headers: objectAssign({}, options.headers, contentLength)
  })

  // Let middleware know we're about to do a request
  applyMiddleware('preRequest', options)

  const request = protocol.request(reqOpts, res => {
    // @todo Follow 3xx redirects
    // if (res.statusCode >= 300 && res.statusCode < 400 && 'location' in res.headers)

    const tryUnzip = reqOpts.method !== 'HEAD'
    const bodyStream = tryUnzip ? unzipResponse(res) : res

    // Concatenate the response body, then parse the response with middlewares
    concat(bodyStream, (err, data) => {
      if (err) {
        channels.error.publish(err)
        return
      }

      const body = options.rawBody ? data : data.toString()
      const reduced = reduceResponse(res, options.url, reqOpts.method, body)
      applyMiddleware('onResponse', reduced)

      const response = applyMiddleware('parseResponse', reduced)
      const channel = response instanceof Error ? 'error' : 'response'
      channels[channel].publish(response)
    })
  })

  request.on('error', err => channels.error.publish(err))
  request.end(options.body)
}
