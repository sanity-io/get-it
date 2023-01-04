/* eslint-disable complexity, no-sync */
import fs from 'fs'
import http from 'http'
import https from 'https'
import path from 'path'
import qs from 'querystring'
import url from 'url'
import {afterAll, beforeAll} from 'vitest'
import zlib from 'zlib'

import {concat} from '../../src/request/node/simpleConcat'
import debugRequest from './debugRequest'

const httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'certificate.pem')),
}

const createError = (code: any, msg?: string) => {
  const err: any = new Error(msg || code)
  err.code = code
  return err
}

const httpPort = 9980
const httpsPort = 9443
const isNode = typeof document === 'undefined'
const state = {failures: {}}

function getResponseHandler(proto = 'http'): any {
  const isSecure = proto === 'https'
  return (req, res, next) => {
    const parts = url.parse(req.url, true)
    const num = Number(parts.query.n)
    const atMax = num >= 10
    const uuid: any = parts.query.uuid
    const acceptedEncodings = (req.headers['accept-encoding'] || '').split(/\s*,\s*/)
    const noCache = () => res.setHeader('Cache-Control', 'private,max-age=0,no-cache,no-store')
    const incrementFailureCount = () => {
      if (!state.failures[uuid]) {
        state.failures[uuid] = 0
      }

      return ++state.failures[uuid]
    }

    if (parts.pathname === '/req-test/stall') {
      return
    }

    const tempFail = parts.pathname === '/req-test/fail'
    const permaFail = parts.pathname === '/req-test/permafail'
    if (tempFail || permaFail) {
      if (tempFail && incrementFailureCount() >= (num || 4)) {
        noCache()
        res.end('Success after failure')
        return
      }

      res.destroy(createError(parts.query.error || 'ECONNREFUSED'))
      return
    }

    // For all other requests, set no-cache
    noCache()

    switch (parts.pathname) {
      case '/req-test/query-string':
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(parts.query))
        break
      case '/req-test/plain-text':
        res.setHeader('Content-Type', 'text/plain')
        res.end(
          isSecure
            ? 'Just some secure, plain text for you to consume'
            : 'Just some plain text for you to consume'
        )
        break
      case '/req-test/custom-json':
        res.setHeader('Content-Type', 'application/vnd.npm.install-v1+json')
        res.end(JSON.stringify({foo: 'bar'}))
        break
      case '/req-test/json':
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({foo: 'bar'}))
        break
      case '/req-test/json-echo':
        res.setHeader('Content-Type', 'application/json')
        req.pipe(res)
        break
      case '/req-test/urlencoded':
        concat(req, (unused, body) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(qs.parse(body.toString())))
        })
        break
      case '/req-test/echo':
        req.pipe(res)
        break
      case '/req-test/debug':
        res.setHeader('Content-Type', 'application/json')
        concat(req, (unused, body) => {
          res.end(JSON.stringify(debugRequest(req, body)))
        })
        break
      case '/req-test/maybeCompress':
        res.setHeader('Content-Type', 'application/json')
        if (acceptedEncodings.includes('br')) {
          res.setHeader('Content-Encoding', 'br')
          zlib.brotliCompress(
            JSON.stringify(['smaller', 'better', 'faster', 'stronger']),
            (_err, result) => res.end(result)
          )
        } else {
          res.end(JSON.stringify(['larger', 'worse', 'slower', 'weaker']))
        }
        break
      case '/req-test/gzip':
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Encoding', 'gzip')
        zlib.gzip(JSON.stringify(['harder', 'better', 'faster', 'stronger']), (unused, result) =>
          res.end(result)
        )
        break
      case '/req-test/invalid-json':
        res.setHeader('Content-Type', 'application/json')
        res.end('{"foo":"bar')
        break
      case '/req-test/headers':
        res.setHeader('X-Custom-Header', 'supercustom')
        res.setHeader('Content-Type', 'text/markdown')
        res.end("# Memorable tweets\n\n> they're good dogs Brent")
        break
      case '/req-test/redirect':
        res.statusCode = atMax ? 200 : 302
        res.setHeader(
          atMax ? 'Content-Type' : 'Location',
          atMax ? 'text/plain' : `/req-test/redirect?n=${num + 1}`
        )
        res.end(atMax ? 'Done redirecting' : '')
        break
      case '/req-test/status':
        res.statusCode = Number(parts.query.code || 200)
        res.end('---')
        break
      case '/req-test/stall-after-initial':
        // Need a bit of data before browsers will usually accept it as "open"
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write(new Array(2048).join('.'))
        setTimeout(() => res.end(new Array(1024).join('.')), 6000)
        break
      case '/req-test/delay':
        setTimeout(() => res.end('Hello future'), Number(parts.query.delay || 1000))
        break
      case '/req-test/drip':
        drip(res)
        break
      default:
        if (next) {
          next()
          return
        }

        res.statusCode = 404
        res.end('File not found')
    }
  }
}

function drip(res) {
  let iterations = 0
  let interval: any = null

  setTimeout(() => {
    res.writeHead(200, {'Content-Type': 'text/plain', 'Content-Length': '45'})
    interval = setInterval(() => {
      if (++iterations === 10) {
        clearInterval(interval)
        res.end()
        return
      }

      res.write('chunk')
    }, 50)
  }, 500)
}

const createServer = (proto = 'http', opts = {}) => {
  const isHttp = proto === 'http'
  const protoOpts = isHttp ? {} : httpsServerOptions
  const protoPort = isHttp ? httpPort : httpsPort
  const options = Object.assign({}, protoOpts, opts)
  const server = isHttp
    ? http.createServer(getResponseHandler(proto))
    : https.createServer(options, getResponseHandler(proto))

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(protoPort, () => resolve(server))
  })
}

createServer.responseHandlerFactory = getResponseHandler

const hookState: any = {}

if (isNode) {
  beforeAll(async () => {
    await Promise.all([
      createServer('http').then((httpServer) => Object.assign(hookState, {httpServer})),
      createServer('https').then((httpsServer) => Object.assign(hookState, {httpsServer})),
    ])
  })
} else {
  beforeAll(() => {
    if (!window.EventSource) {
      // IE only
      localStorage.debug = 'get-it*'
    }
  })
}

afterAll(async () => {
  await Promise.all([closeServer(hookState.httpServer), closeServer(hookState.httpsServer)])
})

function closeServer(server) {
  return new Promise<any>((resolve) => (server ? server.close(resolve) : resolve(undefined)))
}
