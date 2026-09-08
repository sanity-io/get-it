/**
 * Returns a signal that aborts as soon as any of `signals` aborts, with that
 * signal's reason. Delegates to `AbortSignal.any` where it exists (Node.js,
 * Safari 17.4+) and falls back to abort listeners on Safari 17.0–17.3, which
 * has no `AbortSignal.any`.
 *
 * The fallback keeps its listeners on the source signals until one of them
 * aborts. Runtimes with a native `AbortSignal.any` never take that path.
 *
 * @public
 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)

  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
  }

  const onAbort = () => {
    controller.abort(signals.find((signal) => signal.aborted)?.reason)
    for (const signal of signals) signal.removeEventListener('abort', onAbort)
  }
  for (const signal of signals) signal.addEventListener('abort', onAbort)
  return controller.signal
}
