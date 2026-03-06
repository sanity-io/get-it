import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import zlib from 'node:zlib'

import debugRequest from './debugRequest'

/**
 * Simple stream concatenation helper (inlined from simple-concat).
 * MIT License. Feross Aboukhadijeh <https://feross.org/opensource>
 */
function concat(stream: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = []
  let callback: ((err: Error | null, body: Buffer) => void) | null = cb
  stream.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })
  stream.once('end', () => {
    if (callback) callback(null, Buffer.concat(chunks))
    callback = null
  })
  stream.once('error', (err: Error) => {
    if (callback) callback(err, Buffer.alloc(0))
    callback = null
  })
}

const httpsServerOptions: https.ServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server', 'cert.pem')),
}

const createError = (code: string, msg?: string) => {
  const err: Error & {code?: string} = new Error(msg || code)
  err.code = code
  return err
}

const httpPort = 9980
const httpsPort = 9443
const state: {failures: Record<string, number>} = {failures: {}}

function getResponseHandler(proto = 'http') {
  const isSecure = proto === 'https'
  return (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void) => {
    const parts = new URL(req.url || '/', `${proto}://localhost`)
    const num = Number(parts.searchParams.get('n') || '0')
    const atMax = num >= 10
    const uuid = parts.searchParams.get('uuid') || ''
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

      res.destroy(createError(parts.searchParams.get('error') || 'ECONNREFUSED'))
      return
    }

    // For all other requests, set no-cache
    noCache()

    switch (parts.pathname) {
      case '/req-test/query-string': {
        res.setHeader('Content-Type', 'application/json')
        const query: Record<string, string | string[]> = {}
        for (const key of parts.searchParams.keys()) {
          const values = parts.searchParams.getAll(key)
          query[key] = values.length > 1 ? values : values[0]
        }
        res.end(JSON.stringify(query))
        break
      }
      case '/req-test/plain-text':
        res.setHeader('Content-Type', 'text/plain')
        res.end(
          isSecure
            ? 'Just some secure, plain text for you to consume'
            : 'Just some plain text for you to consume',
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
        concat(req, (_unused, body) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(Object.fromEntries(new URLSearchParams(body.toString()))))
        })
        break
      case '/req-test/echo':
        req.pipe(res)
        break
      case '/req-test/debug':
        res.setHeader('Content-Type', 'application/json')
        concat(req, (_unused, body) => {
          res.end(JSON.stringify(debugRequest(req, body)))
        })
        break
      case '/req-test/maybeCompress':
        res.setHeader('Content-Type', 'application/json')
        if (acceptedEncodings.includes('br')) {
          res.setHeader('Content-Encoding', 'br')
          zlib.brotliCompress(
            JSON.stringify(['smaller', 'better', 'faster', 'stronger']),
            (_err, result) => res.end(result),
          )
        } else {
          res.end(JSON.stringify(['larger', 'worse', 'slower', 'weaker']))
        }
        break
      case '/req-test/gzip':
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Encoding', 'gzip')
        zlib.gzip(JSON.stringify(['harder', 'better', 'faster', 'stronger']), (_unused, result) =>
          res.end(result),
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
          atMax ? 'text/plain' : `/req-test/redirect?n=${num + 1}`,
        )
        res.end(atMax ? 'Done redirecting' : '')
        break
      case '/req-test/status':
        res.statusCode = Number(parts.searchParams.get('code') || 200)
        res.end('---')
        break
      case '/req-test/stall-after-initial':
        // Need a bit of data before browsers will usually accept it as "open"
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write(new Array(2048).join('.'))
        setTimeout(() => res.end(new Array(1024).join('.')), 1000)
        break
      case '/req-test/stall-after-initial-gzip':
        res.setHeader('Content-Encoding', 'gzip')
        res.writeHead(200, {'Content-Type': 'text/plain'})
        zlib.gzip(JSON.stringify(['harder', 'better', 'faster', 'stronger']), (_unused, result) => {
          res.write(result)
          setTimeout(() => res.end(), 1000)
        })
        break
      case '/req-test/delay':
        setTimeout(() => res.end('Hello future'), Number(parts.searchParams.get('delay') || 1000))
        break
      case '/req-test/empty':
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end()
        break
      case '/req-test/no-content':
        res.writeHead(204)
        res.end()
        break
      case '/req-test/gzip-empty':
        res.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'gzip'})
        res.end()
        break
      case '/req-test/binary': {
        // Return 256 bytes: 0x00..0xFF
        const buf = Buffer.alloc(256)
        for (let i = 0; i < 256; i++) buf[i] = i
        res.writeHead(200, {'Content-Type': 'application/octet-stream'})
        res.end(buf)
        break
      }
      case '/req-test/binary-gzip': {
        // Gzip-compressed binary payload
        const binBuf = Buffer.alloc(256)
        for (let i = 0; i < 256; i++) binBuf[i] = i
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Encoding', 'gzip')
        zlib.gzip(binBuf, (_err, result) => res.end(result))
        break
      }
      case '/req-test/unicode-chunked': {
        // Send multi-byte UTF-8 text in small chunks to force mid-character splits.
        // Each emoji is 4 bytes; writing 3 bytes at a time guarantees splits.
        const text =
          '\u{1F389}\u{1F680}\u{1F30D}\u{1F3B8}\u{1F4A1}\u{1F525}\u2728\u{1F3AF}\u{1F427}\u{1F308}'
        const encoded = Buffer.from(text, 'utf8')
        res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'})
        let offset = 0
        const chunkSize = 3
        const writeNext = () => {
          if (offset >= encoded.length) {
            res.end()
            return
          }
          const end = Math.min(offset + chunkSize, encoded.length)
          res.write(encoded.subarray(offset, end))
          offset = end
          setImmediate(writeNext)
        }
        writeNext()
        break
      }
      case '/req-test/unicode-gzip': {
        // Gzip-compressed multi-byte UTF-8 text
        const uText =
          '\u{1F389}\u{1F680}\u{1F30D}\u{1F3B8}\u{1F4A1}\u{1F525}\u2728\u{1F3AF}\u{1F427}\u{1F308}'
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Content-Encoding', 'gzip')
        zlib.gzip(Buffer.from(uText, 'utf8'), (_err, result) => res.end(result))
        break
      }
      case '/req-test/drip':
        drip(res)
        break
      case '/req-test/remote-port':
        res.setHeader('Content-Type', 'text/plain')
        res.end(`${req.socket.remotePort}`)
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

function drip(res: http.ServerResponse) {
  let iterations = 0
  let interval: ReturnType<typeof setInterval> | null = null

  setTimeout(() => {
    res.writeHead(200, {'Content-Type': 'text/plain', 'Content-Length': '45'})
    interval = setInterval(() => {
      if (++iterations === 10) {
        if (interval) clearInterval(interval)
        res.end()
        return
      }

      res.write('chunk')
    }, 50)
  }, 500)
}

export function createServer(proto?: 'http'): Promise<http.Server>
export function createServer(proto: 'https'): Promise<https.Server>
export function createServer(proto: 'http' | 'https' = 'http') {
  const isHttp = proto === 'http'
  const protoPort = isHttp ? httpPort : httpsPort
  const server = isHttp
    ? http.createServer(getResponseHandler(proto))
    : https.createServer(httpsServerOptions, getResponseHandler(proto))

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(protoPort, () => resolve(server))
  })
}
