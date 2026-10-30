import type {WrappingMiddleware} from '../types'
import {formatRequestTarget} from './requestTarget'

/**
 * Adds request context and underlying cause messages to errors from the wrapped request.
 *
 * Uses `urlTemplate` when provided. Otherwise, displays a bounded host and path,
 * removes URL credentials and fragments, and replaces query contents with `?…`.
 * Preserves the original error instance, cause, stack, and retry metadata.
 * Caller abort reasons and platform timeout errors pass through unchanged.
 *
 * Place after middleware that changes request options. JSON parsing runs outside
 * the wrapping middleware chain; supply `urlTemplate` directly for those errors.
 *
 * @example
 * ```ts
 * createRequester({middleware: [retry(), errorContext()]})
 * ```
 * @public
 */
export function errorContext(): WrappingMiddleware {
  const messages = new WeakMap<Error, string>()

  return async function errorContextMiddleware(options, next) {
    const query = options.query
    const hasQuery =
      query instanceof URLSearchParams
        ? query.toString() !== ''
        : query !== undefined && Object.values(query).some((value) => value !== undefined)
    const target = formatRequestTarget(options.url, options.urlTemplate, hasQuery)
    try {
      return await next({...options, urlTemplate: target})
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        options.signal?.aborted ||
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.name === 'HttpError'
      ) {
        throw error
      }

      const message = messages.get(error) ?? error.message
      const cause = error.cause
      const detail = (cause instanceof Error && (messages.get(cause) ?? cause.message)) || message
      const method = (options.method || (options.body == null ? 'GET' : 'POST')).toUpperCase()
      try {
        error.message = `HTTP ${method} ${target} failed: ${detail}`
        messages.set(error, message)
      } catch {
        // A read-only message must not replace the original request failure.
      }
      throw error
    }
  }
}
