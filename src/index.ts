import type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  FetchInit,
  RequestOptions,
} from './types'
import {createBufferedResponse} from './response'

export {createBufferedResponse} from './response'
export {HttpError} from './types'
export type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
} from './types'

// TODO: When implementing the `as` option (Task 5), the return type should
// become the full RequestFunction with overloaded signatures for json/text/stream.
// For now, createRequest returns a simple function that always yields BufferedResponse.

export function createRequest(
  options?: CreateRequestOptions,
): {
  (url: string): Promise<BufferedResponse>
  (options: RequestOptions): Promise<BufferedResponse>
} {
  const instanceFetch = options?.fetch

  async function request(input: string | RequestOptions): Promise<BufferedResponse> {
    // 1. Normalize input: string -> { url: string }
    const opts: RequestOptions = typeof input === 'string' ? {url: input} : input

    // 2. Resolve which fetch to use
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch

    // 3. Build fetch init
    const init: FetchInit = {}
    if (opts.method) init.method = opts.method
    if (opts.headers) init.headers = opts.headers
    if (opts.body !== undefined) {
      // For now, only handle string bodies. JSON auto-serialization comes in Task 4.
      if (typeof opts.body === 'string') {
        init.body = opts.body
      }
    }

    // 4. Call fetch
    const response = await fetchFn(opts.url, init)

    // 5. Buffer the response body
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // 6. Return BufferedResponse
    return createBufferedResponse(response.status, response.statusText, response.headers, bytes)
  }

  return request
}
