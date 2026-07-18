// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A directive controlling timing or termination inside a {@link streamBody}
 * script. Create via {@link streamDelay}, {@link streamStall}, or
 * {@link streamError}.
 * @public
 */
export type StreamDirective =
  | {kind: 'delay'; ms: number}
  | {kind: 'stall'}
  | {kind: 'error'; error: Error}

/**
 * One part of a {@link streamBody} script: a body chunk (string is UTF-8
 * encoded, `Uint8Array` passes through as bytes) or a {@link StreamDirective}.
 * @public
 */
export type StreamPart = string | Uint8Array | StreamDirective

/**
 * Marker object recognized in `MockResponseDef.body`, produced by
 * {@link streamBody}. Also serves as the observability handle: a fresh
 * stream is built from the script for every consumption, and consumer
 * cancellations are aggregated on this object.
 * @public
 */
export class StreamBody {
  /** Number of times a consumer cancelled a stream produced from this script. */
  cancelCount = 0
  /** The reason passed to the most recent cancel, if any. */
  lastCancelReason: unknown = undefined
  /** The validated script. @internal */
  readonly script: ReadonlyArray<StreamPart>

  /** Use {@link streamBody} instead of constructing directly. @internal */
  constructor(parts: ReadonlyArray<StreamPart>) {
    parts.forEach(assertValidPart)
    this.script = parts
  }
}

function assertValidPart(part: StreamPart, index: number, parts: ReadonlyArray<StreamPart>): void {
  if (typeof part === 'string' || part instanceof Uint8Array) return
  if (part.kind === 'delay') {
    if (!(part.ms >= 0)) {
      throw new TypeError(`streamBody(): invalid delay at index ${index}: ${part.ms}`)
    }
    return
  }
  if (index !== parts.length - 1) {
    throw new TypeError(`streamBody(): ${part.kind}() must be the last part (found at index ${index})`)
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Declare a streaming mock response body: chunks delivered in order,
 * interleaved with timing/termination directives. Pass the result as
 * `MockResponseDef.body`. Validates the script eagerly.
 *
 * @example
 * ```ts
 * const body = streamBody('partial', streamDelay(1000), 'done')
 * mock.on('GET', '/backup').respond({status: 200, body})
 * ```
 *
 * @public
 */
export function streamBody(...parts: StreamPart[]): StreamBody {
  return new StreamBody(parts)
}

/** Pause `ms` milliseconds before delivering the next part. @public */
export function streamDelay(ms: number): StreamDirective {
  return {kind: 'delay', ms}
}

/**
 * Terminal directive: after the preceding chunks, the body never closes.
 * The stream ends only when the consumer cancels it or the request's
 * abort signal fires.
 * @public
 */
export function streamStall(): StreamDirective {
  return {kind: 'stall'}
}

/**
 * Terminal directive: after the preceding chunks, the body stream errors
 * with `error`, simulating a connection cut mid-download.
 * @public
 */
export function streamError(error: Error): StreamDirective {
  return {kind: 'error', error}
}

// ---------------------------------------------------------------------------
// Timing primitive (shared with createMockFetch's response-level delay)
// ---------------------------------------------------------------------------

/**
 * Wait `ms` milliseconds, rejecting with the signal's reason if it aborts
 * first. Clears the timer on abort so it cannot resolve a request that should
 * already have rejected.
 * @internal
 */
export function delayWithAbort(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, {once: true})
  })
}
