import type {BufferedResponse, RequestOptions, WrappingMiddleware} from '../types'

interface RetryOptions {
  maxRetries?: number
  retryDelay?: (attemptNumber: number) => number
  shouldRetry?: (error: unknown, attemptNumber: number, options: RequestOptions) => boolean
}

/**
 * Creates a `WrappingMiddleware` that retries failed requests.
 *
 * By default, retries up to 5 times on transient network errors for
 * idempotent methods (`GET`, `HEAD`) using exponential backoff with jitter.
 * HTTP errors (4xx/5xx) are never retried.
 *
 * @param opts - Retry options: `maxRetries` (default `5`) sets the max attempts,
 *   `retryDelay` returns the delay in ms for a given attempt (default: exponential
 *   backoff `100 * 2^attempt + random(0–100)`), and `shouldRetry` is a predicate
 *   that decides if an error is retryable (default: transient network errors on
 *   GET/HEAD only).
 * @returns A wrapping middleware that adds retry logic.
 *
 * @example
 * ```ts
 * const request = createRequester({
 *   middleware: [retry({maxRetries: 3})],
 * })
 * ```
 *
 * @public
 */
export function retry(opts?: RetryOptions): WrappingMiddleware {
  const maxRetries = opts?.maxRetries ?? 5
  const retryDelay = opts?.retryDelay ?? getRetryDelay
  const shouldRetry = opts?.shouldRetry ?? isRetryableRequest

  return async function retryMiddleware(
    options: RequestOptions,
    next: (reqOpts: RequestOptions) => Promise<BufferedResponse>,
  ): Promise<BufferedResponse> {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next(options)
      } catch (error: unknown) {
        lastError = error
        if (attempt >= maxRetries || !shouldRetry(error, attempt, options)) {
          throw error
        }
        await sleep(retryDelay(attempt), options.signal)
      }
    }
    throw lastError
  }
}

/**
 * Default retry delay using exponential backoff with jitter:
 * `100ms * 2^attempt + random(0–100ms)`.
 *
 * @param attemptNumber - Zero-based attempt index.
 * @returns Delay in milliseconds before the next retry.
 *
 * @public
 */
export function getRetryDelay(attemptNumber: number): number {
  return 100 * Math.pow(2, attemptNumber) + Math.random() * 100
}

/**
 * Default predicate for deciding whether a failed request should be retried.
 *
 * Returns `true` only for transient network errors on idempotent methods
 * (`GET`, `HEAD`). HTTP errors (`HttpError`) are never retried.
 *
 * @param error - The error thrown by the request.
 * @param _attemptNumber - Zero-based attempt index (unused by default).
 * @param options - The request options (used to check the HTTP method).
 * @returns `true` if the request should be retried.
 *
 * @public
 */
export function isRetryableRequest(
  error: unknown,
  _attemptNumber: number,
  options: RequestOptions,
): boolean {
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return false
  }
  if (error instanceof Error && 'name' in error && error.name === 'HttpError') {
    return false
  }
  return isRetryableError(error)
}

/**
 * Network error codes that are safe to retry — transient failures where
 * the server likely never received (or fully processed) the request.
 */
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'ENETDOWN',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
])

/**
 * Determine if an error is retryable. In Node.js (undici), fetch throws
 * `TypeError: fetch failed` with a `.cause` containing the original error
 * and its `.code`. In browsers, fetch throws a `TypeError` with no `.cause`
 * — those are always network errors and are retryable.
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  // Walk the cause chain to find an error code
  const code = getErrorCode(error) ?? getErrorCode(error.cause)
  if (code) return RETRYABLE_CODES.has(code)

  // No error code — browser fetch network errors are plain TypeError
  // with no cause or code, and are always retryable.
  return error instanceof TypeError
}

function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  return 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      {once: true},
    )
  })
}
