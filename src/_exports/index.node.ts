import {createRequest as coreCreateRequest} from '../createRequest'
import {nodeFetch} from '../nodeFetch'
import {createBufferedResponse} from '../response'
import type {CreateRequestOptions} from '../types'
import {HttpError} from '../types'

const defaultFetch = nodeFetch()

/** @public */
export function createRequest(options?: CreateRequestOptions) {
  return coreCreateRequest({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

// Re-export everything from core
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
export {createBufferedResponse, HttpError}
