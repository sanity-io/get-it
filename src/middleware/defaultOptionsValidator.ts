import type {MiddlewareHooks} from '../types'

const validUrl = /^https?:\/\//i

/** @public */
export const validateOptions = function validateOptions(options) {
  if (!validUrl.test(options.url)) {
    throw new Error(`"${options.url}" is not a valid URL`)
  }
} satisfies MiddlewareHooks['validateOptions']
