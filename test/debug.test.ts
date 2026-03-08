import {createRequester} from 'get-it'
import {debug} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

describe('debug middleware', () => {
  it('logs request method and URL', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('GET'))).toBe(true)
    expect(logs.some((l) => l.includes('/plain-text'))).toBe(true)
  })

  it('logs response status', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('200'))).toBe(true)
  })

  it('redacts specified headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequester({
      base: baseUrl,
      headers: {Authorization: 'Bearer secret-token'},
      middleware: [debug({log, redactHeaders: ['authorization'], verbose: true})],
    })
    await request('/plain-text')
    const allLogs = logs.join('\n')
    expect(allLogs).not.toContain('secret-token')
    expect(allLogs).toContain('REDACTED')
  })

  it('no-op when log function is not provided', async () => {
    const request = createRequester({
      base: baseUrl,
      middleware: [debug()],
    })
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })

  it('verbose mode logs request headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequester({
      base: baseUrl,
      headers: {'X-Test': 'hello'},
      middleware: [debug({log, verbose: true})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('headers') && l.includes('hello'))).toBe(true)
  })

  it('non-verbose mode does not log headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequester({
      base: baseUrl,
      headers: {'X-Test': 'hello'},
      middleware: [debug({log})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('headers'))).toBe(false)
  })

  it('redacts cookie and authorization headers by default', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequester({
      base: baseUrl,
      headers: {Authorization: 'Bearer secret', Cookie: 'session=abc123'},
      middleware: [debug({log, verbose: true})],
    })
    await request('/plain-text')
    const allLogs = logs.join('\n')
    expect(allLogs).not.toContain('secret')
    expect(allLogs).not.toContain('abc123')
    expect(allLogs).toContain('REDACTED')
  })

  it('includes request ID in log output', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => {
      logs.push(msg.replace(/%s/g, () => String(args.shift())))
    }
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await request('/plain-text')
    // Request log should start with [<number>]
    expect(logs.some((l) => /^\[\d+\]/.test(l))).toBe(true)
  })

  it('verbose mode logs request body', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log, verbose: true})],
    })
    await request({url: '/plain-text', method: 'POST', body: {hello: 'world'}})
    expect(logs.some((l) => l.includes('request body') && l.includes('hello'))).toBe(true)
  })

  it('verbose mode logs response body', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log, verbose: true})],
    })
    await request('/plain-text')
    expect(
      logs.some((l) => l.includes('response') && l.includes('body') && l.includes('plain text')),
    ).toBe(true)
  })

  it('non-verbose mode does not log bodies', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await request({url: '/plain-text', method: 'POST', body: {hello: 'world'}})
    expect(logs.some((l) => l.includes('body'))).toBe(false)
  })

  it('logs errors and re-throws them', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequester({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await expect(request({url: '/status?code=500'})).rejects.toThrow()
    expect(logs.some((l) => l.includes('error'))).toBe(true)
  })
})
