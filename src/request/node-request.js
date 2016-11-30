const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const objectAssign = require('object-assign')
const unzipResponse = require('unzip-response')

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (res, body) => ({
  body,
  headers: res.headers,
  statusCode: res.statusCode,
  statusMessage: res.statusMessage,
})

module.exports = (options, channels, applyMiddleware) => {
  // @todo move url parsing to shared step
  const opts = Object.assign({}, options, url.parse(options.url))
  const protocol = opts.protocol === 'https:' ? https : http

  const request = protocol.request(opts, res => {
    // @todo Follow 3xx redirects
    // if (res.statusCode >= 300 && res.statusCode < 400 && 'location' in res.headers)

    const tryUnzip = opts.method !== 'HEAD'
    const bodyStream = tryUnzip ? unzipResponse(res) : res

    // Concatenate the response body, then parse the response with middlewares
    concat(bodyStream, (err, data) => {
      if (err) {
        channels.error.publish(err)
        return
      }

      const response = reduceResponse(res, options.rawBody ? data : data.toString())
      const body = applyMiddleware('parseResponseBody', response.body, response)
      const finalRes = objectAssign({}, response, {body})

      applyMiddleware('onResponse', finalRes)
      channels.response.publish(finalRes)
    })
  })

  request.on('error', err => channels.error.publish(err))
  request.end(options.body)
}
