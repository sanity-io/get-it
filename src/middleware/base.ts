import type {Middleware} from '../types'

const leadingSlash = /^\//
const trailingSlash = /\/$/

/** @public */
export function base(baseUrl: string) {
  const baseUri = baseUrl.replace(trailingSlash, '')
  return {
    processOptions: (options) => {
      if (/^https?:\/\//i.test(options.url)) {
        return options // Already prefixed
      }

      const url = [baseUri, options.url.replace(leadingSlash, '')].join('/')
      return Object.assign({}, options, {url})
    },
  } satisfies Middleware
}
