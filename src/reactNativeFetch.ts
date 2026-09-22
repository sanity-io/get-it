import type {FetchFunction, FetchResponse} from './types'

/**
 * Normalize fetch rejections from React Native implementations such as Expo,
 * which wrap network failures and abort reasons in a plain Error subclass.
 * Enforce cancellation even when the transport leaves body reads pending.
 * @internal
 */
export function wrapReactNativeFetch(fetch: FetchFunction): FetchFunction {
  return async (input, init) => {
    const signal = init?.signal
    let fetching: Promise<FetchResponse> | undefined
    let response: FetchResponse
    try {
      fetching = fetch(input, init)
      response = await raceAbort(fetching, signal)
    } catch (error) {
      // An uncooperative transport can deliver a response after cancellation.
      // Release its body and handle any late rejection.
      fetching?.then((lateResponse) => lateResponse.body?.cancel()).catch(() => {})
      // Use the actual fetch signal: it includes get-it's internal deadlines
      // as well as caller cancellation. Older RN signals have no reason.
      if (signal?.aborted) throw abortReason(signal)

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

    if (!signal) return response

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.url,
      redirected: response.redirected,
      // Reading Expo's body getter can start streaming. Leave it untouched
      // until requested, and preserve the original stream on hand-off.
      get body() {
        return response.body
      },
      // Body errors retain their original shape; only fetch rejections above
      // are normalized for retry(). Bind reads to the original response.
      text: () => raceAbort(response.text(), signal),
      arrayBuffer: () => raceAbort(response.arrayBuffer(), signal),
    }
  }
}

async function raceAbort<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return work

  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortReason(signal))
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, {once: true})
  })
  try {
    // Prefer an already-aborted signal over an already-settled transport.
    // Promise.race also handles any late rejection from the losing work.
    return await Promise.race([aborted, work])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason !== undefined
    ? signal.reason
    : new DOMException('The operation was aborted.', 'AbortError')
}

function hasErrorCode(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
}
