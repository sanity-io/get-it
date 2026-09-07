import {createRequester, type FetchInit, isTimeoutError, TimeoutError} from 'get-it'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {combineSignals} from '../src/combineSignals'
import {streamBody, streamFromScript, streamStall} from '../src/mock/streamBody'

// Safari 17.0–17.3 (and iOS 17.0–17.3) ship no `AbortSignal.any` — it arrived
// in Safari 17.4 — while get-it's browserslist still includes them. The suite
// undefines the static on the platform `AbortSignal` to simulate that runtime
// (no module or function of get-it is replaced), then exercises the real
// signal-combining paths, and restores the original afterwards. The static is
// shadowed with an own `undefined` property rather than deleted because some
// DOM implementations (happy-dom) expose a per-window subclass as the global,
// so the native `any` lives on the parent constructor, not as an own property.
const nativeAnyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any')

function simulateSafari17(): void {
  Object.defineProperty(AbortSignal, 'any', {value: undefined, configurable: true, writable: true})
  if (typeof AbortSignal.any !== 'undefined') {
    throw new Error(
      'AbortSignal.any is not configurable in this runtime; cannot simulate Safari 17',
    )
  }
}

function restoreNativeAny(): void {
  if (nativeAnyDescriptor) {
    Object.defineProperty(AbortSignal, 'any', nativeAnyDescriptor)
  } else {
    Reflect.deleteProperty(AbortSignal, 'any')
  }
}

/**
 * Signal-honoring stand-in for fetch: captures the init get-it hands over and
 * settles only when that init's signal aborts, so the tests observe exactly
 * what the combined signal does, independent of any network stack.
 */
function createSignalObservingFetch() {
  let capturedInit: FetchInit | undefined
  const fetch = (_url: string | URL, init?: FetchInit) => {
    capturedInit = init
    const signal = init?.signal
    return new Promise<Response>((resolve, reject) => {
      if (!signal) {
        resolve(new Response('no signal attached'))
        return
      }
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason), {once: true})
    })
  }
  return {
    fetch,
    get signal() {
      return capturedInit?.signal
    },
  }
}

function settle(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (reason: unknown) => reason,
  )
}

/**
 * The `AbortSignal.any` contract the call sites rely on, asserted directly on
 * the helper. Runs both with and without the native static.
 */
function describeCombineSignalsContract() {
  it('returns the lone signal itself when there is nothing to combine', () => {
    const controller = new AbortController()
    expect(combineSignals(controller.signal)).toBe(controller.signal)
    expect(combineSignals(controller.signal, undefined)).toBe(controller.signal)
  })

  it('aborts with the reason of whichever signal aborts first', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineSignals(a.signal, b.signal)
    expect(combined).toBeInstanceOf(AbortSignal)
    expect(combined.aborted).toBe(false)

    let events = 0
    combined.addEventListener('abort', () => events++)
    const reason = new Error('b aborted')
    b.abort(reason)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
    expect(events).toBe(1)

    a.abort(new Error('too late'))
    expect(combined.reason).toBe(reason)
    expect(events).toBe(1)
  })

  it('is aborted from the start when an input is already aborted', () => {
    const live = new AbortController()
    const dead = new AbortController()
    const reason = new Error('already aborted')
    dead.abort(reason)
    const combined = combineSignals(live.signal, dead.signal)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })

  it('aborting one input leaves the other inputs untouched', () => {
    const a = new AbortController()
    const b = new AbortController()
    combineSignals(a.signal, b.signal)
    a.abort()
    expect(b.signal.aborted).toBe(false)
  })

  it('skips undefined entries but still combines the defined ones', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineSignals(a.signal, undefined, b.signal)
    expect(combined).not.toBe(a.signal)
    b.abort()
    expect(combined.aborted).toBe(true)
  })

  it('lets a mock stream be interrupted by the request signal', async () => {
    const body = streamBody('head', streamStall())
    const controller = new AbortController()
    const reader = streamFromScript(body, controller.signal).getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('head')
    const stalled = reader.read().then(
      () => null,
      (reason: unknown) => reason,
    )
    const reason = new Error('request aborted')
    controller.abort(reason)
    expect(await stalled).toBe(reason)
    expect(body.abortCount).toBe(1)
    expect(body.lastAbortReason).toBe(reason)
  })
}

describe('signal combining without native AbortSignal.any (Safari 17.0–17.3)', () => {
  beforeEach(simulateSafari17)
  afterEach(restoreNativeAny)

  it('the simulation removed the native static', () => {
    expect(typeof AbortSignal.any).toBe('undefined')
  })

  describeCombineSignalsContract()

  it('a caller signal still cancels a request that also has a total timeout', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({timeout: {total: 30_000}, fetch: observed.fetch})
    const controller = new AbortController()
    const pending = settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(observed.signal).toBeInstanceOf(AbortSignal)
    expect(observed.signal?.aborted).toBe(false)

    const reason = new Error('caller aborted')
    controller.abort(reason)
    expect(observed.signal?.aborted).toBe(true)
    expect(await pending).toBe(reason)
  })

  it('a caller signal still cancels a request that also has a headers timeout', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({
      timeout: {headers: 30_000, total: false},
      fetch: observed.fetch,
    })
    const controller = new AbortController()
    const pending = settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(observed.signal?.aborted).toBe(false)

    const reason = new Error('caller aborted')
    controller.abort(reason)
    expect(observed.signal?.aborted).toBe(true)
    expect(await pending).toBe(reason)
  })

  it('the total deadline still aborts the fetch when a caller signal is attached', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({timeout: {total: 50}, fetch: observed.fetch})
    const controller = new AbortController()
    const err = await settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(isTimeoutError(err)).toBe(true)
    expect(observed.signal?.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  it('the headers deadline still aborts the fetch when a caller signal is attached', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({
      timeout: {headers: 50, total: false},
      fetch: observed.fetch,
    })
    const controller = new AbortController()
    const err = await settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(err).toBeInstanceOf(TimeoutError)
    expect(observed.signal?.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  it('an already-aborted caller signal rejects the request immediately', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({timeout: {total: 30_000}, fetch: observed.fetch})
    const reason = new Error('aborted before the request')
    const controller = new AbortController()
    controller.abort(reason)
    const err = await settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(err).toBe(reason)
  })
})

describe('signal combining with native AbortSignal.any (Safari 17.4+, modern Node.js)', () => {
  const hasNativeAny = typeof AbortSignal.any === 'function'

  it.skipIf(!hasNativeAny)('the native static is present', () => {
    expect(typeof AbortSignal.any).toBe('function')
  })

  describeCombineSignalsContract()

  it.skipIf(!hasNativeAny)(
    'a caller signal cancels a request that also has a total timeout',
    async () => {
      const observed = createSignalObservingFetch()
      const request = createRequester({timeout: {total: 30_000}, fetch: observed.fetch})
      const controller = new AbortController()
      const pending = settle(request({url: 'http://localhost/slow', signal: controller.signal}))
      expect(observed.signal?.aborted).toBe(false)

      const reason = new Error('caller aborted')
      controller.abort(reason)
      expect(observed.signal?.aborted).toBe(true)
      expect(await pending).toBe(reason)
    },
  )

  it.skipIf(!hasNativeAny)(
    'the total deadline aborts the fetch when a caller signal is attached',
    async () => {
      const observed = createSignalObservingFetch()
      const request = createRequester({timeout: {total: 50}, fetch: observed.fetch})
      const controller = new AbortController()
      const err = await settle(request({url: 'http://localhost/slow', signal: controller.signal}))
      expect(isTimeoutError(err)).toBe(true)
      expect(observed.signal?.aborted).toBe(true)
    },
  )
})
