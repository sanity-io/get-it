import type {TimeoutError} from './errors'

/**
 * The public HTTP error fields shared by all get-it v9 releases.
 *
 * Response URL metadata was added after v9.4, so it is optional on this
 * cross-version shape.
 *
 * @public
 */
export interface HttpErrorLike {
  name: 'HttpError'
  message: string
  url: string
  method: string
  status: number
  statusText: string
  headers: Headers
  body: unknown
  response: {
    status: number
    statusText: string
    headers: Headers
    body: unknown
    url?: string
    redirected?: boolean
  }
}

/**
 * A timeout raised by get-it or the platform, described structurally so the
 * type works across runtimes, realms, and installed get-it copies.
 *
 * @public
 */
export type TimeoutErrorLike =
  | TimeoutError
  | {
      name: 'TimeoutError'
      message: string
      code?: number
    }

/**
 * Checks whether a value has the public shape of a get-it {@link HttpError}.
 *
 * Unlike `instanceof HttpError`, this recognizes errors created by another
 * installed copy of get-it.
 *
 * @param error - The value to check.
 * @returns `true` when the value is a get-it HTTP error.
 *
 * @public
 */
export function isHttpError(error: unknown): error is HttpErrorLike {
  if (
    !isRecord(error) ||
    error.name !== 'HttpError' ||
    typeof error.message !== 'string' ||
    typeof error.url !== 'string' ||
    typeof error.method !== 'string' ||
    typeof error.status !== 'number' ||
    typeof error.statusText !== 'string' ||
    !isHeaders(error.headers) ||
    !('body' in error) ||
    !isRecord(error.response)
  ) {
    return false
  }

  const response = error.response
  return (
    response.status === error.status &&
    typeof response.statusText === 'string' &&
    isHeaders(response.headers) &&
    'body' in response &&
    (response.url === undefined || typeof response.url === 'string') &&
    (response.redirected === undefined || typeof response.redirected === 'boolean')
  )
}

/**
 * Checks whether a value is a get-it headers timeout or a platform
 * total-deadline timeout.
 *
 * This structural check recognizes errors created by another installed copy
 * of get-it and platform `DOMException`s from another realm.
 *
 * @param error - The value to check.
 * @returns `true` when the value is a timeout error.
 *
 * @public
 */
export function isTimeoutError(error: unknown): error is TimeoutErrorLike {
  if (!isRecord(error) || error.name !== 'TimeoutError' || typeof error.message !== 'string') {
    return false
  }

  if (error.code === undefined || typeof error.code === 'number') return true

  return (
    error.code === 'ETIMEDOUT' &&
    typeof error.url === 'string' &&
    typeof error.method === 'string' &&
    typeof error.timeoutMs === 'number' &&
    error.phase === 'headers'
  )
}

interface ErrorRecord {
  name?: unknown
  message?: unknown
  url?: unknown
  method?: unknown
  status?: unknown
  statusText?: unknown
  headers?: unknown
  body?: unknown
  response?: unknown
  redirected?: unknown
  timeoutMs?: unknown
  phase?: unknown
  code?: unknown
  get?: unknown
}

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === 'object' && value !== null
}

function isHeaders(value: unknown): value is Headers {
  return isRecord(value) && typeof value.get === 'function'
}
