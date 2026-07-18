import {TimeoutError} from 'get-it'
import {describe, expect, it} from 'vitest'

describe('TimeoutError', () => {
  it('carries url, method, timeoutMs, phase, and a retryable string code', () => {
    const err = new TimeoutError({
      url: 'http://localhost:9980/req-test/delay',
      method: 'GET',
      timeoutMs: 15000,
      phase: 'headers',
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(TimeoutError)
    expect(err.name).toBe('TimeoutError')
    expect(err.code).toBe('ETIMEDOUT')
    expect(err.phase).toBe('headers')
    expect(err.url).toBe('http://localhost:9980/req-test/delay')
    expect(err.method).toBe('GET')
    expect(err.timeoutMs).toBe(15000)
    expect(err.message).toBe(
      'Request timed out after 15000ms waiting for response headers: GET http://localhost:9980/req-test/delay',
    )
  })

  it('truncates very long URLs in the message but keeps the full url property', () => {
    const longUrl = `http://localhost/?q=${'x'.repeat(500)}`
    const err = new TimeoutError({url: longUrl, method: 'GET', timeoutMs: 100, phase: 'headers'})
    expect(err.url).toBe(longUrl)
    expect(err.message.length).toBeLessThan(500)
    expect(err.message).toContain('…')
  })
})
