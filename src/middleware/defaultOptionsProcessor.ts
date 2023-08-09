import type {MiddlewareHooks, RequestOptions} from '../types'

const isReactNative = typeof navigator === 'undefined' ? false : navigator.product === 'ReactNative'

const defaultOptions = {timeout: isReactNative ? 60000 : 120000} satisfies Partial<RequestOptions>

/** @public */
export const processOptions = function processOptions(opts) {
  const options = {
    ...defaultOptions,
    ...(typeof opts === 'string' ? {url: opts} : opts),
  } satisfies RequestOptions

  // Allow parsing relative URLs by setting the origin to `http://localhost`
  const {searchParams} = new URL(options.url, 'http://localhost')

  // Normalize timeouts
  options.timeout = normalizeTimeout(options.timeout)

  // Shallow-merge (override) existing query params
  if (options.query) {
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
    }
  }
  // Merge back params into url
  const [url] = options.url.split('?')
  const search = searchParams.toString()
  if (search) {
    options.url = `${url}?${search}`
  }

  // Implicit POST if we have not specified a method but have a body
  options.method =
    options.body && !options.method ? 'POST' : (options.method || 'GET').toUpperCase()

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
