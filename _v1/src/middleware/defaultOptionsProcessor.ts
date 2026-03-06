import type {MiddlewareHooks, RequestOptions} from 'get-it'

const isReactNative = typeof navigator === 'undefined' ? false : navigator.product === 'ReactNative'

const defaultOptions = {timeout: isReactNative ? 60000 : 120000} satisfies Partial<RequestOptions>

/** @public */
export const processOptions = function processOptions(opts) {
  const options = {
    ...defaultOptions,
    ...(typeof opts === 'string' ? {url: opts} : opts),
  } satisfies RequestOptions

  // Normalize timeouts
  options.timeout = normalizeTimeout(options.timeout)

  // Shallow-merge (override) existing query params
  if (options.query) {
    const {url, searchParams} = splitUrl(options.url)

    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) {
            searchParams.append(key, v as string)
          }
        } else {
          searchParams.append(key, value as string)
        }
      }

      // Merge back params into url
      const search = searchParams.toString()
      if (search) {
        options.url = `${url}?${search}`
      }
    }
  }

  // Implicit POST if we have not specified a method but have a body
  options.method =
    options.body && !options.method ? 'POST' : (options.method || 'GET').toUpperCase()

  return options
} satisfies MiddlewareHooks['processOptions']

/**
 * Given a string URL, extracts the query string and URL from each other, and returns them.
 * Note that we cannot use the `URL` constructor because of old React Native versions which are
 * majorly broken and returns incorrect results:
 *
 * (`new URL('http://foo/?a=b').toString()` == 'http://foo/?a=b/')
 */
function splitUrl(url: string): {url: string; searchParams: URLSearchParams} {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) {
    return {url, searchParams: new URLSearchParams()}
  }

  const base = url.slice(0, qIndex)
  const qs = url.slice(qIndex + 1)

  // React Native's URL and URLSearchParams are broken, so passing a string to URLSearchParams
  // does not work, leading to an empty query string. For other environments, this should be enough
  if (!isReactNative) {
    return {url: base, searchParams: new URLSearchParams(qs)}
  }

  // Sanity-check; we do not know of any environment where this is the case,
  // but if it is, we should not proceed without giving a descriptive error
  if (typeof decodeURIComponent !== 'function') {
    throw new Error(
      'Broken `URLSearchParams` implementation, and `decodeURIComponent` is not defined',
    )
  }

  const params = new URLSearchParams()
  for (const pair of qs.split('&')) {
    const [key, value] = pair.split('=')
    if (key) {
      params.append(decodeQueryParam(key), decodeQueryParam(value || ''))
    }
  }

  return {url: base, searchParams: params}
}

function decodeQueryParam(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '))
}

function normalizeTimeout(time: RequestOptions['timeout']) {
  if (time === false || time === 0) {
    return false
  }

  if (time.connect || time.socket) {
    return time
  }

  const delay = Number(time)
  if (isNaN(delay)) {
    return normalizeTimeout(defaultOptions.timeout)
  }

  return {connect: delay, socket: delay}
}
