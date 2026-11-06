import type {WrappingMiddleware} from '../types'
import {formatRequestTarget} from './requestTarget'

/**
 * Adds request context and underlying cause messages to errors from the wrapped request.
 * Falls back to a cause's string `code` when its message is empty.
 *
 * Uses `urlTemplate` when provided. Otherwise, the request target displays a bounded
 * host and path, omits URL credentials and fragments, and replaces query contents
 * with `?…`. Platform error details may still include full URLs or other sensitive data.
 * Preserves the original error instance, cause, stack frames, and retry metadata.
 * Updates a stack's message header when it matches the original name and message.
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
      const code =
        cause instanceof Error && 'code' in cause && typeof cause.code === 'string'
          ? cause.code
          : undefined
      const detail =
        (cause instanceof Error && (messages.get(cause) ?? cause.message)) || code || message
      const method = (options.method || (options.body == null ? 'GET' : 'POST')).toUpperCase()
      const previousHeader = `${error.name}: ${error.message}`
      try {
        error.message = `HTTP ${method} ${target} failed: ${detail}`
        messages.set(error, message)
      } catch {
        // A read-only message must not replace the original request failure.
      }
      try {
        const stack = error.stack
        if (
          typeof stack === 'string' &&
          (stack === previousHeader || stack.startsWith(`${previousHeader}\n`))
        ) {
          error.stack = `${error.name}: ${error.message}${stack.slice(previousHeader.length)}`
        }
      } catch {
        // Some errors have read-only stacks. Keep the enriched message and original frames.
      }
      throw error
    }
  }
}
