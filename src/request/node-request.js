const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const objectAssign = require('object-assign')
const unzipResponse = require('unzip-response')
const follow = require('follow-redirects')

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

module.exports = (options, context, callback) => {
  const contentLength = options.body ? {'Content-Length': options.body.length} : {}
  const uri = objectAssign({}, options, url.parse(options.url))

  const reqOpts = objectAssign(uri, {
    method: options.method,
    headers: objectAssign({}, options.headers, contentLength)
  })

  let protocol = uri.protocol === 'https:' ? https : http
  if (options.maxRedirects !== 0) {
    protocol = uri.protocol === 'https:' ? follow.https : follow.http
    reqOpts.maxRedirects = options.maxRedirects || 5
  }

  const request = protocol.request(reqOpts, res => {
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

  request.on('error', callback)
  request.end(options.body)
}
