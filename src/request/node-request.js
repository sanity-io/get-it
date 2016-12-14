const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const follow = require('follow-redirects')
const timedOut = require('timed-out')
const isStream = require('is-stream')
const toStream = require('into-stream')
const objectAssign = require('object-assign')
const unzipResponse = require('unzip-response')
const progressStream = require('progress-stream')

const adapter = 'node'

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
  const bodyType = isStream(options.body) ? 'stream' : typeof options.body

  if (bodyType !== 'undefined' && bodyType !== 'stream' && bodyType !== 'string' && !Buffer.isBuffer(options.body)) {
    throw new Error(`Request body must be a string, buffer or stream, got ${bodyType}`)
  }

  const lengthHeader = {}
  if (options.bodySize) {
    lengthHeader['Content-Length'] = options.bodySize
  } else if (options.body && bodyType !== 'stream') {
    lengthHeader['Content-Length'] = options.body.length
  }

  // Make sure callback is not called in the event of a cancellation
  let aborted = false
  const callback = (err, res) => !aborted && cb(err, res)
  context.channels.abort.subscribe(() => {
    aborted = true
  })

  // Create a reduced subset of options meant for the http.request() method
  const reqOpts = objectAssign(uri, {
    method: options.method,
    headers: objectAssign({}, options.headers, lengthHeader)
  })

  let protocol = uri.protocol === 'https:' ? https : http

  // We're using the follow-redirects module to transparently follow redirects
  if (options.maxRedirects !== 0) {
    protocol = uri.protocol === 'https:' ? follow.https : follow.http
    reqOpts.maxRedirects = options.maxRedirects || 5
  }

  const request = protocol.request(reqOpts, response => {
    // See if we should try to unzip the response
    const tryUnzip = reqOpts.method !== 'HEAD'
    const res = tryUnzip ? unzipResponse(response) : response

    const resStream = context.applyMiddleware('onHeaders', res, {
      headers: response.headers,
      adapter,
      context
    })

    // Concatenate the response body, then parse the response with middlewares
    concat(resStream, (err, data) => {
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

  // Cheating a bit here; since we're not concerned about the "bundle size" in node,
  // and modifying the body stream would be sorta tricky, we're just always going
  // to put a progress stream in the middle here. Note that
  const {bodyStream, progress} = getProgressStream(options)

  // Let middleware know we're about to do a request
  context.applyMiddleware('onRequest', {options, adapter, request, context, progress})

  if (bodyStream) {
    bodyStream.pipe(request)
  } else {
    request.end(options.body)
  }

  return {abort: () => request.abort()}
}

function getProgressStream(options) {
  if (!options.body) {
    return {}
  }

  const bodyIsStream = isStream(options.body)
  const length = options.bodySize || (bodyIsStream ? null : options.body.length)
  if (!length) {
    return bodyIsStream ? {bodyStream: options.body} : {}
  }

  const progress = progressStream({time: 16, length})
  const bodyStream = bodyIsStream ? options.body : toStream(options.body)
  return {bodyStream: bodyStream.pipe(progress), progress}
}
