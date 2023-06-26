import type {MiddlewareHooks, RequestOptions} from '../types'

const isReactNative = typeof navigator === 'undefined' ? false : navigator.product === 'ReactNative'

const defaultOptions = {timeout: isReactNative ? 60000 : 120000} satisfies Partial<RequestOptions>

/** @public */
export const processOptions = function processOptions(opts) {
  const options = {
    ...defaultOptions,
    ...(typeof opts === 'string' ? {url: opts} : opts),
  } satisfies RequestOptions

  // Allow parsing relativ URLs by setting the origin
  const url = new URL(options.url, 'http://localhost')

  // Normalize timeouts
  options.timeout = normalizeTimeout(options.timeout)

  // Shallow-merge (override) existing query params
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v as string)
          }
        } else {
          url.searchParams.append(key, value as string)
        }
      }
    }
  }

  // Implicit POST if we have not specified a method but have a body
  options.method =
    options.body && !options.method ? 'POST' : (options.method || 'GET').toUpperCase()

  // Stringify URL
  options.url =
    url.origin === 'http://localhost' ? `${url.pathname}?${url.searchParams}` : url.toString()

  return options
} satisfies MiddlewareHooks['processOptions']

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
