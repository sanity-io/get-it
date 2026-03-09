import {createNodeFetch} from '../createNodeFetch'
import {createRequester as coreCreateRequester} from '../createRequester'
import type {RequesterOptions, RequestFunction} from '../types'

let defaultFetch: ReturnType<typeof createNodeFetch> | undefined

function nodeCreateRequester(options?: RequesterOptions): RequestFunction {
  if (!options?.fetch) {
    defaultFetch ??= createNodeFetch()
  }
  return coreCreateRequester({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

/**
 * Creates a configured request function for Node.js.
 *
 * Identical to the core `createRequester` but automatically provides an
 * undici-backed fetch if no custom `fetch` is given. The default fetch
 * instance is created lazily and shared across calls.
 *
 * @param options - Instance-level configuration (base URL, headers, timeout, middleware, etc.).
 * @returns A request function that can be called with a URL string or request options.
 *
 * @public
 */
export function createRequester(options: RequesterOptions & {as: 'json'}): RequestFunction<'json'>
/** Creates a requester that returns {@link TextResponse} by default. @public */
export function createRequester(options: RequesterOptions & {as: 'text'}): RequestFunction<'text'>
/** Creates a requester that returns {@link StreamResponse} by default. @public */
export function createRequester(
  options: RequesterOptions & {as: 'stream'},
): RequestFunction<'stream'>
/** Creates a requester that returns {@link BufferedResponse} by default. @public */
export function createRequester(options?: RequesterOptions): RequestFunction
export function createRequester(
  options?: RequesterOptions,
): RequestFunction<'json' | 'text' | 'stream' | undefined> {
  return nodeCreateRequester(options)
}

// Re-export everything from core
export {HttpError} from '../errors'
export type {
  BufferedResponse,
  DefaultResponse,
  FetchBody,
  FetchFunction,
  FetchHeaders,
  FetchInit,
  JsonResponse,
  RequesterOptions,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from '../types'
