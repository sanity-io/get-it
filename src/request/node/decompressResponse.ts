import type http from 'http'
import {PassThrough, Transform} from 'stream'
import zlib from 'zlib'

// Properties from http.IncomingMessage that should be accessible on the decompressed stream
const knownProperties = [
  'aborted',
  'complete',
  'headers',
  'httpVersion',
  'httpVersionMinor',
  'httpVersionMajor',
  'method',
  'rawHeaders',
  'rawTrailers',
  'setTimeout',
  'socket',
  'statusCode',
  'statusMessage',
  'trailers',
  'url',
] as const

function mimicResponse(from: http.IncomingMessage, to: PassThrough): void {
  const fromProperties = new Set([...Object.keys(from), ...knownProperties])

  const descriptors: PropertyDescriptorMap = {}
  for (const property of fromProperties) {
    if (property in to) continue

    descriptors[property] = {
      get() {
        const value = (from as any)[property]
        return typeof value === 'function' ? value.bind(from) : value
      },
      set(value) {
        ;(from as any)[property] = value
      },
      enumerable: true,
      configurable: false,
    }
  }

  Object.defineProperties(to, descriptors)

  from.once('close', () => {
    if (from.complete) {
      if (to.readable) {
        to.once('end', () => to.emit('close'))
      } else {
        to.emit('close')
      }
    } else {
      to.emit('close')
    }
  })
}

export function decompressResponse(response: http.IncomingMessage): http.IncomingMessage {
  const contentEncoding = ((response.headers['content-encoding'] as string) || '').toLowerCase()

  if (!['gzip', 'deflate', 'br'].includes(contentEncoding)) {
    return response
  }

  // Clone headers to avoid mutating the original response, then remove
  // encoding/length since they no longer apply after decompression
  const headers = {...response.headers}
  delete headers['content-encoding']
  delete headers['content-length']

  let isEmpty = true

  const finalStream = new PassThrough({
    autoDestroy: false,
  })

  finalStream.once('error', () => {
    response.destroy()
  })

  function createDecompressor(data: Buffer): zlib.Unzip | zlib.BrotliDecompress | zlib.InflateRaw {
    if (contentEncoding === 'br') {
      return zlib.createBrotliDecompress()
    }

    // For deflate, inspect the first byte to detect raw deflate (no zlib wrapper).
    // Some servers incorrectly send raw deflate despite the "deflate" encoding spec
    // requiring a zlib wrapper. The check `(byte & 0x0F) !== 0x08` detects this.
    if (contentEncoding === 'deflate' && data.length > 0 && (data[0] & 0x08) === 0) {
      return zlib.createInflateRaw()
    }

    return zlib.createUnzip()
  }

  const checker = new Transform({
    transform(data, _encoding, callback) {
      if (isEmpty) {
        isEmpty = false

        const decompressStream = createDecompressor(data)
        decompressStream.once('error', (error) => {
          if (isEmpty && !response.readable) {
            finalStream.end()
            return
          }

          finalStream.destroy(error)
        })

        checker.pipe(decompressStream).pipe(finalStream)
      }

      callback(null, data)
    },

    flush(callback) {
      if (isEmpty) {
        finalStream.end()
      }

      callback()
    },
  })

  finalStream.headers = headers
  mimicResponse(response, finalStream)

  response.pipe(checker)

  return finalStream as unknown as http.IncomingMessage
}
