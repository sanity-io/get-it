import assert from 'node:assert/strict'
import {once} from 'node:events'
import {readFileSync} from 'node:fs'
import {createServer, type RequestListener, type Server} from 'node:http'
import {createSecureServer, type ServerHttp2Session} from 'node:http2'
import {connect, type Socket} from 'node:net'
import {gzipSync} from 'node:zlib'

import {createRequester, type FetchHeaders} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {createRequester as createNodeRequester} from '../src/_exports/index.node'

const virtualHost = 'api.example.com'
// Bun replaces undici with native fetch and does not implement dispatchers.
const hasDispatchers = !('Bun' in globalThis)
const largeBody = 'response body 🌍'.repeat(32 * 1024)
const servers: Server[] = []
let origin: string
let otherOrigin: string
let proxyUrl: string
let proxyConnections = 0

async function listen(server: Server): Promise<string> {
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}

const handler: RequestListener = (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  res.setHeader('x-received-host', req.headers.host ?? '')

  if (url.pathname === '/redirect') {
    res.writeHead(302, {location: url.searchParams.get('to') ?? '/host'})
    res.end()
  } else if (url.pathname === '/large') {
    res.end(largeBody)
  } else if (url.pathname === '/compressed') {
    res.setHeader('content-encoding', 'gzip')
    res.end(gzipSync(largeBody))
  } else if (url.pathname === '/stall') {
    res.write('partial body')
  } else {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({host: req.headers.host, custom: req.headers['x-custom']}))
  }
}

beforeAll(async () => {
  origin = await listen(createServer(handler))
  otherOrigin = await listen(createServer(handler))
  const proxy = createServer()
  proxy.on('connect', (req, client, head) => {
    proxyConnections++
    const target = new URL(`http://${req.url}`)
    const upstream = connect(Number(target.port), target.hostname, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      client.pipe(upstream).pipe(client)
    })
    upstream.on('error', () => client.destroy())
    client.on('error', () => upstream.destroy())
    client.on('close', () => upstream.destroy())
  })
  proxyUrl = await listen(proxy)
})

afterAll(async () => {
  await Promise.all(
    servers.map(async (server) => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }),
  )
})

describe.each([
  {name: 'default Node transport', createRequest: () => createNodeRequester()},
  {
    name: 'explicit Node fetch',
    createRequest: () => createRequester({fetch: createNodeFetch({proxy: false})}),
  },
  {
    name: 'proxied Node fetch',
    createRequest: () => createRequester({fetch: createNodeFetch({proxy: proxyUrl})}),
  },
])('$name Host overrides', ({createRequest}) => {
  it('routes using an explicit Host without losing other headers', async () => {
    const response = await createRequest()({
      url: `${origin}/host`,
      headers: {'Host': virtualHost, 'X-Custom': 'kept'},
    })
    expect(response.json()).toEqual({host: virtualHost, custom: 'kept'})
  })

  it('keeps Host overrides separate between concurrent requests', async () => {
    const request = createRequest()
    const responses = await Promise.all([
      request({url: `${origin}/host`, headers: {host: 'first.example.com'}}),
      request({url: `${origin}/host`, headers: {host: 'second.example.com'}}),
      request(`${origin}/host`),
    ])
    expect(responses.map((response) => response.json())).toEqual([
      {host: 'first.example.com'},
      {host: 'second.example.com'},
      {host: new URL(origin).host},
    ])
  })

  it('preserves the Host override on same-origin redirects', async () => {
    const response = await createRequest()({
      url: `${origin}/redirect`,
      headers: {host: virtualHost},
    })
    expect(response.json()).toEqual({host: virtualHost})
    expect(response.url).toBe(`${origin}/host`)
    expect(response.redirected).toBe(true)
  })

  it.runIf(hasDispatchers)('drops the Host override on cross-origin redirects', async () => {
    const response = await createRequest()({
      url: `${origin}/redirect?to=${encodeURIComponent(`${otherOrigin}/host`)}`,
      headers: {host: virtualHost},
    })
    expect(response.json()).toEqual({host: new URL(otherOrigin).host})
  })

  it.runIf(hasDispatchers)(
    'does not restore the Host override after a redirect returns to the original origin',
    async () => {
      const returnUrl = `${otherOrigin}/redirect?to=${encodeURIComponent(`${origin}/host`)}`
      const response = await createRequest()({
        url: `${origin}/redirect?to=${encodeURIComponent(returnUrl)}`,
        headers: {host: virtualHost},
      })
      expect(response.json()).toEqual({host: new URL(origin).host})
    },
  )
})

describe('Node fetch Host overrides', () => {
  const headerInputs: FetchHeaders[] = [
    {hOsT: virtualHost},
    [['Host', virtualHost]],
    new Headers({host: virtualHost}),
  ]

  it.each(headerInputs)('accepts each fetch header input shape (%#)', async (headers) => {
    const response = await createNodeFetch({proxy: false})(`${origin}/host`, {headers})
    expect(JSON.parse(await response.text())).toEqual({host: virtualHost})
  })

  it.runIf(hasDispatchers)('uses the configured proxy for Host overrides', async () => {
    const before = proxyConnections
    const response = await createNodeFetch({proxy: proxyUrl})(`${origin}/host`, {
      headers: {host: virtualHost},
    })
    await response.text()
    expect(proxyConnections).toBeGreaterThan(before)
    expect(response.headers.get('x-received-host')).toBe(virtualHost)
  })

  it.each(['text', 'arrayBuffer', 'stream'])('reads large responses with %s', async (reader) => {
    const response = await createNodeFetch({proxy: false})(`${origin}/large`, {
      headers: {host: virtualHost},
      signal: AbortSignal.timeout(2000),
    })
    const body =
      reader === 'stream'
        ? await new Response(response.body).text()
        : reader === 'arrayBuffer'
          ? new TextDecoder().decode(await response.arrayBuffer())
          : await response.text()
    expect(body).toBe(largeBody)
    expect(response.headers.get('x-received-host')).toBe(virtualHost)
  })

  it('decompresses responses when a Host override is present', async () => {
    const response = await createNodeFetch({proxy: false})(`${origin}/compressed`, {
      headers: {host: virtualHost},
    })
    expect(await response.text()).toBe(largeBody)
    expect(response.headers.get('x-received-host')).toBe(virtualHost)
  })

  it('aborts a response body after headers with a Host override', async () => {
    const controller = new AbortController()
    const response = await createNodeFetch({proxy: false})(`${origin}/stall`, {
      headers: {host: virtualHost},
      signal: controller.signal,
    })
    const body = response.arrayBuffer()
    controller.abort()
    await expect(body).rejects.toMatchObject({name: 'AbortError'})
    expect(response.headers.get('x-received-host')).toBe(virtualHost)
  })

  it.runIf(hasDispatchers).each([
    {allowH2: false, proxy: false, httpVersion: '1.1'},
    {allowH2: true, proxy: false, httpVersion: '2.0'},
    {allowH2: false, proxy: true, httpVersion: '1.1'},
  ])('preserves virtual hosts over TLS (%j)', async ({allowH2, proxy, httpVersion}) => {
    const cert = readFileSync(new URL('./certs/mtls/server.pem', import.meta.url))
    const key = readFileSync(new URL('./certs/mtls/server.key', import.meta.url))
    const ca = readFileSync(new URL('./certs/mtls/ca.pem', import.meta.url))
    const sessions = new Set<ServerHttp2Session>()
    const sockets = new Set<Socket>()
    const server = createSecureServer({cert, key, allowHTTP1: true}, (req, res) => {
      res.end(
        JSON.stringify({
          host: req.headers[':authority'] ?? req.headers.host,
          httpVersion: req.httpVersion,
        }),
      )
    })
    server.on('session', (session) => {
      sessions.add(session)
      session.on('close', () => sessions.delete(session))
    })
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert(address && typeof address !== 'string')
    try {
      const fetch = createNodeFetch({
        proxy: proxy ? proxyUrl : false,
        tls: {ca},
        allowH2,
      })
      const hostname = proxy ? 'localhost' : '127.0.0.1'
      const response = await fetch(`https://${hostname}:${address.port}/`, {
        headers: {host: 'localhost:8443'},
      })
      expect(JSON.parse(await response.text())).toEqual({host: 'localhost:8443', httpVersion})
    } finally {
      for (const session of sessions) session.destroy()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
