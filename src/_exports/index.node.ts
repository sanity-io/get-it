import {createNodeFetch} from '../createNodeFetch'
import {createRequest as coreCreateRequest} from '../createRequest'
import type {CreateRequestOptions} from '../types'

let defaultFetch: ReturnType<typeof createNodeFetch> | undefined

/** @public */
export function createRequest(options?: CreateRequestOptions) {
  if (!options?.fetch) {
    defaultFetch ??= createNodeFetch()
  }
  return coreCreateRequest({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

// Re-export everything from core
export {HttpError} from '../errors'
export type {
  BufferedResponse,
  FetchFunction,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from '../types'
