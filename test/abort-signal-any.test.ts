import {createRequester, type FetchInit, isTimeoutError, TimeoutError} from 'get-it'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {streamBody, streamFromScript, streamStall} from '../src/mock/streamBody'

// The static is shadowed with an own `undefined` property rather than deleted
// because happy-dom's global `AbortSignal` is a per-window subclass, so the
// native `any` lives on the parent constructor.
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

function createSignalObservingFetch() {
  let capturedInit: FetchInit | undefined
  const fetch = (_url: string | URL, init?: FetchInit) => {
    capturedInit = init
    const signal = init?.signal
    if (!signal) throw new Error('expected get-it to attach a signal')
    return new Promise<Response>((_, reject) => {
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

function itCombinesSignals() {
  it('a caller signal cancels a request that also has a total timeout', async () => {
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

  it('a caller signal cancels a request that also has a headers timeout', async () => {
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

  it('the total deadline aborts the fetch when a caller signal is attached', async () => {
    const observed = createSignalObservingFetch()
    const request = createRequester({timeout: {total: 50}, fetch: observed.fetch})
    const controller = new AbortController()
    const err = await settle(request({url: 'http://localhost/slow', signal: controller.signal}))
    expect(isTimeoutError(err)).toBe(true)
    expect(observed.signal?.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  it('the headers deadline aborts the fetch when a caller signal is attached', async () => {
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

  it('a mock stream is interrupted by the request signal', async () => {
    const body = streamBody('head', streamStall())
    const controller = new AbortController()
    const reader = streamFromScript(body, controller.signal).getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('head')
    const stalled = settle(reader.read())
    const reason = new Error('request aborted')
    controller.abort(reason)
    expect(await stalled).toBe(reason)
    expect(body.abortCount).toBe(1)
    expect(body.lastAbortReason).toBe(reason)
  })
}

describe('without native AbortSignal.any (Safari 17.0–17.3)', () => {
  beforeEach(simulateSafari17)
  afterEach(restoreNativeAny)

  it('the simulation removed the native static', () => {
    expect(typeof AbortSignal.any).toBe('undefined')
  })

  itCombinesSignals()
})

describe.skipIf(typeof AbortSignal.any !== 'function')(
  'with native AbortSignal.any (Safari 17.4+, Node.js)',
  itCombinesSignals,
)
