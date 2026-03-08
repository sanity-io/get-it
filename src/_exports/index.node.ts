import {createNodeFetch} from '../createNodeFetch'
import {createRequester as coreCreateRequester} from '../createRequest'
import type {CreateRequestOptions} from '../types'

let defaultFetch: ReturnType<typeof createNodeFetch> | undefined

/**
 * Creates a configured request function for Node.js.
 *
 * Identical to the core {@link createRequester} but automatically provides an
 * undici-backed fetch if no custom `fetch` is given. The default fetch
 * instance is created lazily and shared across calls.
 *
 * @param options - Instance-level configuration (base URL, headers, timeout, middleware, etc.).
 * @returns A request function that can be called with a URL string or request options.
 *
 * @public
 */
export function createRequester(options?: CreateRequestOptions) {
  if (!options?.fetch) {
    defaultFetch ??= createNodeFetch()
  }
  return coreCreateRequester({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

// Re-export everything from core
export {HttpError} from '../errors'
export type {
  BufferedResponse,
  CreateRequestOptions,
  FetchBody,
  FetchFunction,
  FetchHeaders,
  FetchInit,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from '../types'
