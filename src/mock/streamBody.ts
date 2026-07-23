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
    // Copy Uint8Array parts to protect against external mutations. `new
    // Uint8Array(part)` (rather than `part.slice()`) also protects against
    // `Buffer` inputs: `Buffer` (a `Uint8Array` subclass) overrides `slice()`
    // to return a view sharing the same backing memory, which would leave
    // the snapshot unprotected against later mutation of the source buffer.
    const copiedParts = parts.map((part) =>
      part instanceof Uint8Array ? new Uint8Array(part) : part,
    )
    this.script = copiedParts
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
    throw new TypeError(
      `streamBody(): ${part.kind}() must be the last part (found at index ${index})`,
    )
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

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

/**
 * Returns a promise that rejects with the signal's reason when it aborts,
 * and never settles otherwise — the waiting state of a stalled body.
 * @internal
 */
function stallUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (!signal) return
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', () => reject(signal.reason), {once: true})
  })
}

/**
 * Build a fresh `ReadableStream` that plays back a {@link StreamBody} script.
 * Each call produces an independent stream (persist-safe). Aborting `signal`
 * errors the stream with the signal's reason, mirroring real fetch behavior;
 * consumer cancellation is recorded on the handle.
 * @internal
 */
export function streamFromScript(
  body: StreamBody,
  signal: AbortSignal | undefined,
): ReadableStream<Uint8Array> {
  const parts = body.script
  let index = 0
  let onAbort: (() => void) | undefined

  // Internal controller so a consumer cancel() can interrupt an in-flight
  // delayWithAbort/stallUntilAborted wait immediately, instead of leaving its
  // timer/listener alive until the script would otherwise have continued.
  const done = new AbortController()
  const waitSignal = signal ? AbortSignal.any([signal, done.signal]) : done.signal

  const removeAbortListener = () => {
    if (onAbort) {
      signal?.removeEventListener('abort', onAbort)
      onAbort = undefined
    }
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!signal) return
      if (signal.aborted) {
        controller.error(signal.reason)
        return
      }
      // Listens on the external signal directly (not `waitSignal`) so the
      // stream always errors with the original abort reason, regardless of
      // the internal controller used for cancel()-interruption.
      // Erroring an already-errored/closed stream is a spec-level no-op, so
      // this listener is safe even when pull() also rejects on the same abort.
      onAbort = () => {
        removeAbortListener()
        controller.error(signal.reason)
      }
      signal.addEventListener('abort', onAbort, {once: true})
    },
    async pull(controller) {
      while (index < parts.length) {
        const part = parts[index++]
        if (typeof part === 'string') {
          controller.enqueue(encoder.encode(part))
          return
        }
        if (part instanceof Uint8Array) {
          controller.enqueue(new Uint8Array(part))
          return
        }
        if (part.kind === 'delay') {
          await delayWithAbort(part.ms, waitSignal)
          continue
        }
        if (part.kind === 'stall') {
          await stallUntilAborted(waitSignal)
          return
        }
        removeAbortListener()
        controller.error(part.error)
        return
      }
      removeAbortListener()
      controller.close()
    },
    cancel(reason) {
      removeAbortListener()
      body.cancelCount++
      body.lastCancelReason = reason
      // Interrupts any pending delayWithAbort/stallUntilAborted wait so its
      // timer/listener does not linger for the rest of the script's delay.
      done.abort()
    },
  })
}

/**
 * Independently walk a {@link StreamBody} script to completion, honoring
 * delays, and return the concatenated bytes. Used by the mock response's
 * `text()`/`arrayBuffer()` accessors so buffered reads stay faithful to the
 * script's timing.
 * @internal
 */
export async function drainScript(
  body: StreamBody,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const reader = streamFromScript(body, signal).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const {done, value} = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
