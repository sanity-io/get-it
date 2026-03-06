import {describe, expect, it} from 'vitest'

import {createRequest} from '../src/index'
import {debug} from '../src/middleware/debug'

const baseUrl = 'http://localhost:9980/req-test'

describe('debug middleware', () => {
  it('logs request method and URL', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${args.join(' ')}`)
    const request = createRequest({
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
    const request = createRequest({
      base: baseUrl,
      middleware: [debug({log})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('200'))).toBe(true)
  })

  it('redacts specified headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequest({
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
    const request = createRequest({
      base: baseUrl,
      middleware: [debug()],
    })
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })

  it('verbose mode logs request headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequest({
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
    const request = createRequest({
      base: baseUrl,
      headers: {'X-Test': 'hello'},
      middleware: [debug({log})],
    })
    await request('/plain-text')
    expect(logs.some((l) => l.includes('headers'))).toBe(false)
  })
})
