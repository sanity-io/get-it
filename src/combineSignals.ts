import {anySignal} from 'any-signal'

/**
 * Combines abort signals into one that aborts as soon as any of them aborts,
 * carrying the aborting signal's reason — the `AbortSignal.any` contract.
 *
 * Goes through `any-signal` rather than the native static because Safari
 * 17.0–17.3 (and iOS 17.0–17.3) ship without `AbortSignal.any`, which only
 * arrived in Safari 17.4, and those versions are inside get-it's browser
 * support range. `undefined` entries are skipped, and when nothing is left to
 * combine the lone signal is returned as-is so no wrapper signal is created.
 * @internal
 */
export function combineSignals(
  signal: AbortSignal,
  ...more: (AbortSignal | undefined)[]
): AbortSignal {
  const extra = more.filter((candidate) => candidate !== undefined)
  return extra.length === 0 ? signal : anySignal([signal, ...extra])
}
