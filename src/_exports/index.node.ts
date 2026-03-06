import {createRequest as coreCreateRequest} from '../createRequest'
import {nodeFetch} from '../nodeFetch'
import type {CreateRequestOptions} from '../types'

const defaultFetch = nodeFetch()

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
