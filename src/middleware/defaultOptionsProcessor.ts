import urlParse from 'url-parse'

const isReactNative = typeof navigator === 'undefined' ? false : navigator.product === 'ReactNative'

const has = Object.prototype.hasOwnProperty
const defaultOptions = {timeout: isReactNative ? 60000 : 120000}

/** @public */
export function processOptions(opts: any): any {
  const options =
    typeof opts === 'string'
      ? Object.assign({url: opts}, defaultOptions)
      : Object.assign({}, defaultOptions, opts)

  // Parse URL into parts
  const url = urlParse(
    options.url,
    {}, // Don't use current browser location
    true // Parse query strings
  )

  // Normalize timeouts
  options.timeout = normalizeTimeout(options.timeout)

  // Shallow-merge (override) existing query params
  if (options.query) {
    Object.assign(url.query, removeUndefined(options.query))
  }

  // Implicit POST if we have not specified a method but have a body
  options.method =
    options.body && !options.method ? 'POST' : (options.method || 'GET').toUpperCase()

  // Stringify URL
  options.url = url.toString(stringifyQueryString)

  return options
}

function stringifyQueryString(obj: any) {
  const pairs: any[] = []
  for (const key in obj) {
    if (has.call(obj, key)) {
      push(key, obj[key])
    }
  }

  return pairs.length ? pairs.join('&') : ''

  function push(key: any, val: any) {
    if (Array.isArray(val)) {
      val.forEach((item) => push(key, item))
    } else {
      pairs.push([key, val].map(encodeURIComponent).join('='))
    }
  }
}

function normalizeTimeout(time: any): any {
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

function removeUndefined(obj: any) {
  const target: any = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      target[key] = obj[key]
    }
  }
  return target
}
