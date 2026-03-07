import {createRequest} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {afterEach, describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'
const proxyUrl = 'http://localhost:4000'

/**
 * Reset the proxy CONNECT counter before each test, and read it after
 * to verify the request went through the proxy.
 */
async function resetProxyCounter(): Promise<void> {
  await fetch(`${proxyUrl}/__proxy_reset`)
}

async function getProxyConnectCount(): Promise<number> {
  const res = await fetch(`${proxyUrl}/__proxy_connect_count`)
  const data: unknown = await res.json()
  if (
    typeof data === 'object' &&
    data !== null &&
    'count' in data &&
    typeof data.count === 'number'
  ) {
    return data.count
  }
  throw new Error('Unexpected proxy counter response')
}

describe('createNodeFetch', () => {
  afterEach(async () => {
    // Ensure HTTP_PROXY is cleaned up
    delete process.env['HTTP_PROXY']
    delete process.env['HTTPS_PROXY']
  })

  it('routes through explicit proxy', async () => {
    await resetProxyCounter()
    const request = createRequest({
      fetch: createNodeFetch({proxy: proxyUrl}),
    })
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
    // Verify the proxy was actually used (CONNECT tunnel)
    const count = await getProxyConnectCount()
    expect(count).toBeGreaterThan(0)
  })

  it('routes through env proxy (HTTP_PROXY)', async () => {
    await resetProxyCounter()
    process.env['HTTP_PROXY'] = proxyUrl
    const customFetch = createNodeFetch({proxy: true})
    const request = createRequest({fetch: customFetch})
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
    const count = await getProxyConnectCount()
    expect(count).toBeGreaterThan(0)
  })

  it('bypasses proxy when proxy is false', async () => {
    await resetProxyCounter()
    const request = createRequest({
      fetch: createNodeFetch({proxy: false}),
    })
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
    const count = await getProxyConnectCount()
    expect(count).toBe(0)
  })

  it('does not use proxy when no env var is set', async () => {
    await resetProxyCounter()
    delete process.env['HTTP_PROXY']
    delete process.env['HTTPS_PROXY']
    const request = createRequest({
      fetch: createNodeFetch(), // defaults to proxy: true (from env)
    })
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
    const count = await getProxyConnectCount()
    expect(count).toBe(0)
  })
})

describe('createNodeFetch body forwarding', () => {
  it('forwards request body to fetch', async () => {
    const request = createRequest({
      fetch: createNodeFetch({proxy: false}),
      base: baseUrl,
    })
    const res = await request({url: '/json-echo', method: 'POST', body: {foo: 'bar'}})
    expect(res.json()).toEqual({foo: 'bar'})
  })
})

describe('createNodeFetch tls option with proxy modes', () => {
  it('passes requestTls to EnvHttpProxyAgent when proxy is true', () => {
    // Just verify it doesn't throw — we can't easily test the TLS config
    // reaches undici internals, but we exercise the tls branch
    const fetch = createNodeFetch({proxy: true, tls: {ca: 'fake-ca'}})
    expect(typeof fetch).toBe('function')
  })

  it('passes requestTls to ProxyAgent when proxy is a string', () => {
    const fetch = createNodeFetch({proxy: 'http://localhost:9999', tls: {ca: 'fake-ca'}})
    expect(typeof fetch).toBe('function')
  })
})

describe('node entry point', () => {
  it('re-exports core types and utilities', async () => {
    const nodeModule = await import('../src/_exports/index.node')
    expect(typeof nodeModule.createRequest).toBe('function')
    expect(typeof nodeModule.HttpError).toBe('function')
  })

  it('createRequest from node entry works without custom fetch', async () => {
    const {createRequest: nodeCreateRequest} = await import('../src/_exports/index.node')
    const request = nodeCreateRequest()
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
  })
})
