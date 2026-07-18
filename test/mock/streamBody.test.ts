import {describe, expect, it} from 'vitest'

import {
  StreamBody,
  streamBody,
  streamDelay,
  streamError,
  streamStall,
  delayWithAbort,
  drainScript,
  streamFromScript,
} from '../../src/mock/streamBody'

describe('streamBody()', () => {
  it('builds a StreamBody with the script and zeroed counters', () => {
    const body = streamBody('hello', streamDelay(10), new Uint8Array([1, 2]), streamStall())
    expect(body).toBeInstanceOf(StreamBody)
    expect(body.cancelCount).toBe(0)
    expect(body.lastCancelReason).toBeUndefined()
    expect(body.script).toHaveLength(4)
  })

  it('allows an empty script', () => {
    expect(streamBody().script).toHaveLength(0)
  })

  it('throws when a terminal directive is not last', () => {
    expect(() => streamBody(streamStall(), 'late')).toThrow(
      new TypeError('streamBody(): stall() must be the last part (found at index 0)'),
    )
    expect(() => streamBody('a', streamError(new Error('cut')), 'b')).toThrow(
      new TypeError('streamBody(): error() must be the last part (found at index 1)'),
    )
  })

  it('throws on negative or NaN delays', () => {
    expect(() => streamBody(streamDelay(-1))).toThrow(
      new TypeError('streamBody(): invalid delay at index 0: -1'),
    )
    expect(() => streamBody('a', streamDelay(NaN))).toThrow(
      new TypeError('streamBody(): invalid delay at index 1: NaN'),
    )
  })

  it('allows a zero delay and a terminal directive as the only part', () => {
    expect(() => streamBody(streamDelay(0))).not.toThrow()
    expect(() => streamBody(streamStall())).not.toThrow()
    expect(() => streamBody(streamError(new Error('x')))).not.toThrow()
  })
})

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const {done, value} = await reader.read()
    if (done) break
    chunks.push(value)
  }
  let total = 0
  for (const c of chunks) total += c.byteLength
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(out)
}

describe('streamFromScript', () => {
  it('delivers string and binary chunks in order, then closes', async () => {
    const body = streamBody('hello ', new Uint8Array([119, 111, 114, 108, 100]))
    expect(await readAll(streamFromScript(body, undefined))).toBe('hello world')
  })

  it('closes immediately for an empty script', async () => {
    expect(await readAll(streamFromScript(streamBody(), undefined))).toBe('')
  })

  it('delivers each chunk as its own read', async () => {
    const reader = streamFromScript(streamBody('a', 'b'), undefined).getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toBe('a')
    const second = await reader.read()
    expect(new TextDecoder().decode(second.value)).toBe('b')
    expect((await reader.read()).done).toBe(true)
  })

  it('copies Uint8Array chunks so later mutation does not leak in', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const body = streamBody(bytes)
    const reader = streamFromScript(body, undefined).getReader()
    bytes[0] = 9
    const {value} = await reader.read()
    if (value === undefined) throw new Error('expected a chunk')
    expect(Array.from(value)).toEqual([1, 2, 3])
  })

  it('waits for streamDelay between chunks', async () => {
    const body = streamBody('a', streamDelay(60), 'b')
    const start = Date.now()
    const text = await readAll(streamFromScript(body, undefined))
    expect(text).toBe('ab')
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })

  it('errors the stream with the given error on streamError', async () => {
    const cut = new Error('connection cut')
    const body = streamBody('partial', streamError(cut))
    await expect(readAll(streamFromScript(body, undefined))).rejects.toBe(cut)
  })

  it('stalls until cancelled, recording count and reason', async () => {
    const body = streamBody('partial', streamStall())
    const reader = streamFromScript(body, undefined).getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toBe('partial')

    const pendingRead = reader.read()
    const raceMarker = Symbol('still-pending')
    await expect(
      Promise.race([pendingRead, delayWithAbort(40, undefined).then(() => raceMarker)]),
    ).resolves.toBe(raceMarker)

    const reason = new Error('read timeout')
    await reader.cancel(reason)
    expect(body.cancelCount).toBe(1)
    expect(body.lastCancelReason).toBe(reason)
  })

  it('errors with the signal reason when aborted mid-delay', async () => {
    const controller = new AbortController()
    const abortError = new Error('aborted by test')
    const body = streamBody('a', streamDelay(5_000), 'b')
    const stream = streamFromScript(body, controller.signal)
    const readPromise = readAll(stream)
    controller.abort(abortError)
    await expect(readPromise).rejects.toBe(abortError)
    expect(body.cancelCount).toBe(0)
  })

  it('errors with the signal reason when aborted during a stall', async () => {
    const controller = new AbortController()
    const abortError = new Error('stall abort')
    const body = streamBody(streamStall())
    const readPromise = readAll(streamFromScript(body, controller.signal))
    controller.abort(abortError)
    await expect(readPromise).rejects.toBe(abortError)
  })

  it('errors immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    const abortError = new Error('pre-aborted')
    controller.abort(abortError)
    const readPromise = readAll(streamFromScript(streamBody('never'), controller.signal))
    await expect(readPromise).rejects.toBe(abortError)
  })

  it('produces independent streams per call, aggregating cancels on the handle', async () => {
    const body = streamBody('x', streamStall())
    const readerA = streamFromScript(body, undefined).getReader()
    const readerB = streamFromScript(body, undefined).getReader()
    await readerA.read()
    await readerB.read()
    await readerA.cancel('a done')
    await readerB.cancel('b done')
    expect(body.cancelCount).toBe(2)
    expect(body.lastCancelReason).toBe('b done')
  })
})

describe('drainScript', () => {
  it('collects all chunks honoring delays', async () => {
    const body = streamBody('slow', streamDelay(60), ' body')
    const start = Date.now()
    const bytes = await drainScript(body, undefined)
    expect(new TextDecoder().decode(bytes)).toBe('slow body')
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })

  it('rejects on streamError', async () => {
    const cut = new Error('cut')
    await expect(drainScript(streamBody('x', streamError(cut)), undefined)).rejects.toBe(cut)
  })

  it('walks independently of other consumptions', async () => {
    const body = streamBody('same')
    expect(new TextDecoder().decode(await drainScript(body, undefined))).toBe('same')
    expect(new TextDecoder().decode(await drainScript(body, undefined))).toBe('same')
  })
})
