import type {BufferedResponse, RequestOptions, WrappingMiddleware} from '../types'
import {HttpError} from '../types'

interface RetryOptions {
  maxRetries?: number
  retryDelay?: (attemptNumber: number) => number
  shouldRetry?: (error: unknown, attemptNumber: number, options: RequestOptions) => boolean
}

function defaultRetryDelay(attemptNumber: number): number {
  return 100 * Math.pow(2, attemptNumber) + Math.random() * 100
}

function defaultShouldRetry(
  error: unknown,
  _attemptNumber: number,
  options: RequestOptions,
): boolean {
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return false
  }
  if (error instanceof HttpError) {
    return false
  }
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function retry(opts?: RetryOptions): WrappingMiddleware {
  const maxRetries = opts?.maxRetries ?? 5
  const retryDelay = opts?.retryDelay ?? defaultRetryDelay
  const shouldRetry = opts?.shouldRetry ?? defaultShouldRetry

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
        await sleep(retryDelay(attempt))
      }
    }
    throw lastError
  }
}
