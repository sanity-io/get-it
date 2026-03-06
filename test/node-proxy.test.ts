import {afterEach, describe, expect, it} from 'vitest'
import {createRequest} from '../src/index'
import {nodeFetch} from '../src/node/nodeFetch'

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
  if (typeof data === 'object' && data !== null && 'count' in data && typeof data.count === 'number') {
    return data.count
  }
  throw new Error('Unexpected proxy counter response')
}

describe('nodeFetch', () => {
  afterEach(async () => {
    // Ensure HTTP_PROXY is cleaned up
    delete process.env['HTTP_PROXY']
    delete process.env['HTTPS_PROXY']
  })

  it('routes through explicit proxy', async () => {
    await resetProxyCounter()
    const request = createRequest({
      fetch: nodeFetch({proxy: proxyUrl}),
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
    const customFetch = nodeFetch({proxy: true})
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
      fetch: nodeFetch({proxy: false}),
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
      fetch: nodeFetch(), // defaults to proxy: true (from env)
    })
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
    const count = await getProxyConnectCount()
    expect(count).toBe(0)
  })
})

describe('node entry point', () => {
  it('re-exports core types and utilities', async () => {
    const nodeModule = await import('../src/index.node')
    expect(typeof nodeModule.createRequest).toBe('function')
    expect(typeof nodeModule.createBufferedResponse).toBe('function')
    expect(typeof nodeModule.HttpError).toBe('function')
  })

  it('createRequest from node entry works without custom fetch', async () => {
    const {createRequest: nodeCreateRequest} = await import('../src/index.node')
    const request = nodeCreateRequest()
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
  })
})
