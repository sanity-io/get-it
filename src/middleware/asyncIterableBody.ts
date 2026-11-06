import type {TransformMiddleware} from '../types'

/**
 * Creates a `TransformMiddleware` that sends async iterable request bodies,
 * such as Node.js `Readable` streams and async generators, as a
 * `ReadableStream`. Without it, they throw `Unsupported body type: object`.
 *
 * Byte chunks are sent as-is and string chunks are UTF-8 encoded. Any other
 * chunk rejects the request. The source is closed when the request body is
 * cancelled or rejected: destroyed if it has a `destroy()` method (like
 * Node.js streams), otherwise through its iterator's `return()`.
 *
 * The body is converted once per request, so a retry reuses a stream that
 * has already been read, and fetch rejects it instead of sending an empty
 * body.
 *
 * @returns A transform middleware that converts async iterable bodies.
 *
 * @example
 * ```ts
 * import {createReadStream} from 'node:fs'
 *
 * const request = createRequester({middleware: [asyncIterableBody()]})
 * await request({url: '/upload', method: 'PUT', body: createReadStream('photo.jpg')})
 * ```
 *
 * @public
 */
export function asyncIterableBody(): TransformMiddleware {
  return {
    beforeRequest(options) {
      const {body} = options
      // `ReadableStream` is itself async iterable in some runtimes
      if (body instanceof ReadableStream || !isAsyncIterable(body)) return options
      return {...options, body: asyncIterableToStream(body)}
    },
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

/**
 * Don't swap this for `ReadableStream.from()`, even where it exists. Bun
 * doesn't have it, and in Deno it hands strings and non-`Uint8Array` views
 * straight to fetch, which hangs on them instead of failing. Its `cancel()`
 * also only calls `return()`, which leaves Node.js streams open (see below).
 */
function asyncIterableToStream(iterable: AsyncIterable<unknown>): ReadableStream<Uint8Array> {
  const iterator = iterable[Symbol.asyncIterator]()
  const close = async (reason?: unknown) => {
    // A Node.js stream's iterator queues `return()` behind the pending
    // `next()`, so it never runs and the source stays open. Destroy the
    // stream instead, like `Readable.toWeb()` does.
    if ('destroy' in iterable && typeof iterable.destroy === 'function') iterable.destroy()
    else await iterator.return?.(reason)
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const {value, done} = await iterator.next()
      if (done) controller.close()
      else if (ArrayBuffer.isView(value)) {
        controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      } else if (typeof value === 'string') controller.enqueue(new TextEncoder().encode(value))
      else {
        controller.error(new TypeError(`Unsupported body chunk: ${typeof value}`))
        // `error()` doesn't call `cancel()`, so close the source here as well
        await close()
      }
    },
    cancel: close,
  })
}
