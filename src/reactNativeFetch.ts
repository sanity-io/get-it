import type {FetchFunction} from './types'

/**
 * Normalize fetch rejections from React Native implementations such as Expo,
 * which wrap network failures and abort reasons in a plain Error subclass.
 * @internal
 */
export function wrapReactNativeFetch(fetch: FetchFunction): FetchFunction {
  return async (input, init) => {
    try {
      return await fetch(input, init)
    } catch (error) {
      // Use the actual fetch signal: it includes get-it's internal deadlines
      // as well as caller cancellation. Older RN signals have no reason.
      if (init?.signal?.aborted) {
        throw init.signal.reason !== undefined
          ? init.signal.reason
          : new DOMException('The operation was aborted.', 'AbortError')
      }

      // Keep errors that already carry the information used by retry().
      // In particular, wrapping would hide a code on error.cause one level
      // deeper than the retry predicate checks.
      if (
        !(error instanceof Error) ||
        error instanceof TypeError ||
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.name === 'HttpError' ||
        hasErrorCode(error) ||
        hasErrorCode(error.cause) ||
        ('retryable' in error && typeof error.retryable === 'boolean')
      ) {
        throw error
      }
      throw new TypeError(error.message, {cause: error})
    }
  }
}

function hasErrorCode(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
}
