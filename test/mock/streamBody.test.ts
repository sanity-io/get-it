import {describe, expect, it} from 'vitest'

import {
  StreamBody,
  streamBody,
  streamDelay,
  streamError,
  streamStall,
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
