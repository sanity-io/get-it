import {createNodeFetch} from '../createNodeFetch'
import {createRequest as coreCreateRequest} from '../createRequest'
import type {CreateRequestOptions} from '../types'

const defaultFetch = createNodeFetch()

/** @public */
export function createRequest(options?: CreateRequestOptions) {
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
