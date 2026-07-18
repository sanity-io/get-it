import {describe, expect, it} from 'vitest'

import {
  blobToBytes,
  contentTypeFor,
  normalizeExpectedBody,
  normalizeFormData,
  normalizeUrlSearchParams,
} from '../../src/mock/body'

describe('body normalization', () => {
  describe('blobToBytes', () => {
    it('reads a Blob into a Uint8Array', async () => {
      expect(await blobToBytes(new Blob([new Uint8Array([1, 2, 3])]))).toEqual(
        new Uint8Array([1, 2, 3]),
      )
    })
  })

  describe('normalizeUrlSearchParams', () => {
    it('single values are strings, duplicates become arrays', () => {
      expect(normalizeUrlSearchParams(new URLSearchParams('a=1&b=2&b=3'))).toEqual({
        a: '1',
        b: ['2', '3'],
      })
    })
  })

  describe('normalizeFormData', () => {
    it('normalizes string and file fields, grouping duplicates', async () => {
      const form = new FormData()
      form.append('title', 'Hi')
      form.append('file', new File([new Uint8Array([1, 2])], 'a.png', {type: 'image/png'}))
      form.append('tag', 'x')
      form.append('tag', 'y')

      expect(await normalizeFormData(form)).toEqual({
        title: 'Hi',
        file: {name: 'a.png', type: 'image/png', size: 2, bytes: new Uint8Array([1, 2])},
        tag: ['x', 'y'],
      })
    })
  })

  describe('contentTypeFor', () => {
    it('returns platform defaults for form/url bodies and blob type', () => {
      expect(contentTypeFor(new URLSearchParams('a=1'))).toBe(
        'application/x-www-form-urlencoded;charset=UTF-8',
      )
      expect(contentTypeFor(new Blob(['x'], {type: 'image/png'}))).toBe('image/png')
      expect(contentTypeFor(new Blob(['x']))).toBe(null)
      expect(contentTypeFor('plain')).toBe(null)
      const ct = contentTypeFor(new FormData())
      expect(ct).toMatch(/^multipart\/form-data; boundary=/)
    })
  })

  describe('normalizeExpectedBody', () => {
    it('normalizes native body types and passes others through', async () => {
      expect(await normalizeExpectedBody(new URLSearchParams('a=1'))).toEqual({a: '1'})
      expect(await normalizeExpectedBody(new Blob([new Uint8Array([9])]))).toEqual(
        new Uint8Array([9]),
      )
      const passthrough = {title: 'Hi'}
      expect(await normalizeExpectedBody(passthrough)).toBe(passthrough)
    })
  })
})
