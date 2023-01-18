import type {ProcessedRequestOptions} from '../types'

const validUrl = /^https?:\/\//i

/** @public */
export function validateOptions(options: ProcessedRequestOptions): void {
  if (!validUrl.test(options.url)) {
    throw new Error(`"${options.url}" is not a valid URL`)
  }
}
