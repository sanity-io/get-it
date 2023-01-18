import type {ProcessedRequestOptions, RequestOptions} from '../types'

const isReactNative = typeof navigator === 'undefined' ? false : navigator.product === 'ReactNative'

const defaultOptions = {timeout: isReactNative ? 60000 : 120000} as const

/** @public */
export function processOptions(opts: RequestOptions): ProcessedRequestOptions {
  const options =
    typeof opts === 'string' ? {url: opts, ...defaultOptions} : {...defaultOptions, ...opts}

  // Allow parsing relative URLs by setting the origin
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
  options.method = options.body && !options.method ? 'POST' : options.method?.toUpperCase() || 'GET'

  // Stringify URL
  options.url =
    url.origin === 'http://localhost' ? `${url.pathname}?${url.searchParams}` : url.toString()

  return options as ProcessedRequestOptions
}

function normalizeTimeout(time: false | 0): false
function normalizeTimeout(time: {connect: number; socket: number} | number | boolean): {
  connect: number
  socket: number
}
function normalizeTimeout(
  time: boolean | number | {connect: number; socket: number}
): false | {connect: number; socket: number} {
  if (time === false || time === 0) {
    return false
  }

  if (typeof time === 'object' && 'connect' in time && 'socket' in time) {
    return time
  }

  const delay = Number(time)
  if (isNaN(delay)) {
    return normalizeTimeout(defaultOptions.timeout)
  }

  return {connect: delay, socket: delay}
}
