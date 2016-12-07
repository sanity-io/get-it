const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const follow = require('follow-redirects')
const timedOut = require('@rexxars/timed-out')
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

module.exports = (context, cb) => {
  const options = context.options
  const uri = objectAssign({}, url.parse(options.url))
  const bodyType = typeof options.body

  if (bodyType !== 'undefined' && bodyType !== 'string' && !Buffer.isBuffer(options.body)) {
    throw new Error(`Request body must be a string or buffer, got ${bodyType}`)
  }

  const contentLength = options.body ? {'Content-Length': options.body.length} : {}

  // Make sure callback is not called in the event of a cancellation
  let aborted = false
  const callback = (err, res) => !aborted && cb(err, res)
  context.channels.abort.subscribe(() => {
    aborted = true
  })

  // Let middleware know we're about to do a request
  context.applyMiddleware('onRequest', options)

  // Create a reduced subset of options meant for the http.request() method
  const reqOpts = objectAssign(uri, {
    method: options.method,
    headers: objectAssign({}, options.headers, contentLength)
  })

  let protocol = uri.protocol === 'https:' ? https : http

  // We're using the follow-redirects module to transparently follow redirects
  if (options.maxRedirects !== 0) {
    protocol = uri.protocol === 'https:' ? follow.https : follow.http
    reqOpts.maxRedirects = options.maxRedirects || 5
  }

  const request = protocol.request(reqOpts, res => {
    // See if we should try to unzip the response
    const tryUnzip = reqOpts.method !== 'HEAD'
    const bodyStream = tryUnzip ? unzipResponse(res) : res

    // Concatenate the response body, then parse the response with middlewares
    concat(bodyStream, (err, data) => {
      if (err) {
        return callback(err)
      }

      const body = options.rawBody ? data : data.toString()
      const reduced = reduceResponse(res, options.url, reqOpts.method, body)
      return callback(null, reduced)
    })
  })

  if (options.timeout) {
    timedOut(request, options.timeout)
  }

  request.once('error', callback)
  request.end(options.body)

  return {abort: () => request.abort()}
}
