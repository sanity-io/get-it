import {describe, expect, it} from 'vitest'

import {bytesEqual, isBinaryBody, toBytes} from '../../src/mock/bytes'

describe('bytes helpers', () => {
  describe('isBinaryBody', () => {
    it('is true for Uint8Array and ArrayBuffer', () => {
      expect(isBinaryBody(new Uint8Array([1, 2]))).toBe(true)
      expect(isBinaryBody(new ArrayBuffer(2))).toBe(true)
    })

    // `Buffer` is Node-only; skip in browser/edge/worker environments where it
    // is undefined. It is a `Uint8Array` subclass, so it takes the same path.
    it.skipIf(typeof Buffer === 'undefined')('is true for a Node Buffer', () => {
      expect(isBinaryBody(Buffer.from([1, 2]))).toBe(true)
    })

    it('is false for other values', () => {
      expect(isBinaryBody('abc')).toBe(false)
      expect(isBinaryBody({})).toBe(false)
      expect(isBinaryBody([1, 2])).toBe(false)
      expect(isBinaryBody(null)).toBe(false)
      expect(isBinaryBody(undefined)).toBe(false)
    })
  })

  describe('toBytes', () => {
    it('passes a Uint8Array through', () => {
      const input = new Uint8Array([1, 2, 3])
      expect(toBytes(input)).toBe(input)
    })

    it('wraps an ArrayBuffer', () => {
      const buffer = new Uint8Array([4, 5, 6]).buffer
      expect(toBytes(buffer)).toEqual(new Uint8Array([4, 5, 6]))
    })
  })

  describe('bytesEqual', () => {
    it('is true for equal bytes', () => {
      expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    })

    it('is false for differing length', () => {
      expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
    })

    it('is false for differing byte', () => {
      expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toBe(false)
    })
  })
})
