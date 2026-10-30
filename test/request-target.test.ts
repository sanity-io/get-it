import {
  createRequester,
  HttpError,
  TimeoutError,
  type RequesterOptions,
  type RequestOptions,
} from 'get-it'
import {errorContext} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

function createContextRequester(options: RequesterOptions) {
  return createRequester({...options, middleware: [...(options.middleware ?? []), errorContext()]})
}

describe('request targets in error messages', () => {
  it.each([
    {
      url: 'https://alice:secret@example.com:8443/users?token=private#fragment',
      target: 'example.com:8443/users?…',
    },
    {url: 'https://example.com/users?token=private', target: 'example.com/users?…'},
    {url: 'https://example.com/users#private', target: 'example.com/users'},
    {url: '/users?token=private#fragment', target: '/users?…'},
    {url: '//alice:secret@example.com/users?token=private', target: 'example.com/users?…'},
    {url: 'https://[::1]:8443/users', target: '[::1]:8443/users'},
    {url: 'https://alice:secret@[invalid/?token=private', target: '[invalid URL]'},
    {url: 'data:text/plain,private', target: '[invalid URL]'},
  ])('formats $url without credentials, query values, or fragments', async ({url, target}) => {
    let requestedUrl: string | undefined
    const request = createContextRequester({
      fetch: async (input) => {
        requestedUrl = input
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(request(url)).rejects.toThrow(`HTTP GET ${target} failed: Failed to fetch`)
    expect(requestedUrl).toBe(url)
  })

  it('limits the displayed host and path to 120 characters', async () => {
    const request = createContextRequester({
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(request(`https://example.com/${'x'.repeat(200)}`)).rejects.toThrow(
      `HTTP GET example.com/${'x'.repeat(107)}… failed: Failed to fetch`,
    )
  })

  it.each<RequestOptions>([
    {url: 'https://example.com/projects/first', urlTemplate: 'my-service/projects/:projectId'},
    {
      url: 'https://example.com/projects/second?token=private',
      urlTemplate: 'my-service/projects/:projectId',
      as: 'stream',
      timeout: {headers: 1000},
    },
  ])('uses urlTemplate for fetch failure %j', async (options) => {
    const error = new TypeError('fetch failed', {cause: new Error('other side closed')})
    const request = createContextRequester({
      fetch: async () => {
        throw error
      },
    })

    await expect(request(options)).rejects.toBe(error)
    expect(error.message).toBe('HTTP GET my-service/projects/:projectId failed: other side closed')
  })

  it('uses templates supplied by wrapping middleware without sending them to fetch', async () => {
    let initKeys: string[] = []
    const request = createContextRequester({
      fetch: async (_input, init) => {
        initKeys = Object.keys(init ?? {})
        throw new TypeError('Failed to fetch')
      },
      middleware: [(opts, next) => next({...opts, urlTemplate: '/projects/{projectId}'})],
    })

    await expect(request('https://example.com/projects/private')).rejects.toThrow(
      'HTTP GET /projects/{projectId} failed: Failed to fetch',
    )
    expect(initKeys).not.toContain('urlTemplate')
  })

  it('updates the template when fetch reuses an error within a requester', async () => {
    const error = new TypeError('Failed to fetch')
    const request = createContextRequester({
      fetch: async () => {
        throw error
      },
    })
    await expect(
      request({url: 'https://example.com/first', urlTemplate: '/first/{id}'}),
    ).rejects.toThrow('HTTP GET /first/{id} failed: Failed to fetch')
    await expect(
      request({url: 'https://example.com/second', urlTemplate: '/second/{id}'}),
    ).rejects.toThrow('HTTP GET /second/{id} failed: Failed to fetch')
  })

  it.each(['', '   '])('uses the sanitized URL for an empty template %j', async (urlTemplate) => {
    const request = createContextRequester({
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(
      request({url: 'https://alice:secret@example.com/test?token=private', urlTemplate}),
    ).rejects.toThrow('HTTP GET example.com/test?… failed: Failed to fetch')
  })

  it.each<RequestOptions>([
    {url: 'https://example.com/private?token=secret', as: 'json', urlTemplate: '/projects/{id}'},
    {url: 'https://example.com/private?token=secret', as: 'text', urlTemplate: '/projects/{id}'},
    {url: 'https://example.com/private?token=secret', as: 'stream', urlTemplate: '/projects/{id}'},
  ])('uses urlTemplate for HTTP response error %j', async (options) => {
    const request = createContextRequester({
      fetch: async () => new Response('unavailable', {status: 503, statusText: 'Unavailable'}),
    })

    await expect(request(options)).rejects.toMatchObject({
      name: 'HttpError',
      url: options.url,
      message: 'GET-request to /projects/{id} resulted in HTTP 503 Unavailable',
    })
  })

  it('uses urlTemplate for a headers timeout', async () => {
    const request = createContextRequester({fetch: () => new Promise(() => {})})
    await expect(
      request({
        url: 'https://example.com/private?token=secret',
        urlTemplate: '/projects/{id}',
        timeout: {headers: 10, total: false},
      }),
    ).rejects.toMatchObject({
      name: 'TimeoutError',
      code: 'ETIMEDOUT',
      url: 'https://example.com/private?token=secret',
      message: 'Request timed out after 10ms waiting for response headers: GET /projects/{id}',
    })
  })

  it('uses urlTemplate for a JSON parse error', async () => {
    const request = createContextRequester({fetch: async () => new Response('not json')})
    await expect(
      request({
        url: 'https://example.com/private?token=secret',
        urlTemplate: '/projects/{id}',
        as: 'json',
      }),
    ).rejects.toThrow('Failed to parse JSON response from /projects/{id}:')
  })

  it('uses a beforeRequest template for a JSON parse error', async () => {
    const request = createContextRequester({
      fetch: async () => new Response('not json'),
      middleware: [{beforeRequest: (opts) => ({...opts, urlTemplate: '/projects/{id}'})}],
    })
    await expect(
      request({url: 'https://example.com/projects/private', as: 'json'}),
    ).rejects.toThrow('Failed to parse JSON response from /projects/{id}:')
  })

  it('keeps an explicit template when a wrapper returns a cached JSON response', async () => {
    const cached = await createRequester({fetch: async () => new Response('not json')})(
      'https://example.com/projects/private',
    )
    const request = createContextRequester({
      fetch: async () => {
        throw new Error('cache should bypass fetch')
      },
      middleware: [
        (opts, next) => next({...opts, urlTemplate: '/projects/{id}'}),
        async () => cached,
      ],
    })
    await expect(
      request({
        url: 'https://example.com/projects/private',
        urlTemplate: '/projects/{id}',
        as: 'json',
      }),
    ).rejects.toThrow('Failed to parse JSON response from /projects/{id}:')
  })

  it('sanitizes the default target for HTTP errors without changing error properties', async () => {
    const url = 'https://alice:secret@example.com/path?token=private#fragment'
    const request = createContextRequester({
      fetch: async () => new Response('unavailable', {status: 503, statusText: 'Unavailable'}),
    })
    await expect(request(url)).rejects.toMatchObject({
      name: 'HttpError',
      url,
      message: 'GET-request to example.com/path?… resulted in HTTP 503 Unavailable',
    })
  })

  it('sanitizes the default target for headers timeouts', async () => {
    const request = createContextRequester({fetch: () => new Promise(() => {})})
    await expect(
      request({
        url: 'https://alice:secret@example.com/path?token=private#fragment',
        timeout: {headers: 10, total: false},
      }),
    ).rejects.toMatchObject({
      name: 'TimeoutError',
      code: 'ETIMEDOUT',
      message: 'Request timed out after 10ms waiting for response headers: GET example.com/path?…',
    })
  })

  it('uses explicit templates in directly constructed HTTP and headers timeout messages', () => {
    const url = 'https://alice:secret@example.com/path?token=private#fragment'
    const response = {
      status: 503,
      statusText: 'Unavailable',
      headers: new Headers(),
      body: '',
      url,
      redirected: false,
    }
    const http = new HttpError({method: 'GET', ...response, response, urlTemplate: '/path'})
    const timeout = new TimeoutError({
      url,
      urlTemplate: '/path',
      method: 'GET',
      timeoutMs: 10,
      phase: 'headers',
    })
    expect(http.message).toBe('GET-request to /path resulted in HTTP 503 Unavailable')
    expect(timeout.message).toBe(
      'Request timed out after 10ms waiting for response headers: GET /path',
    )
    expect(http.url).toBe(url)
    expect(timeout.url).toBe(url)
  })
})
