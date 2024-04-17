import type {RequestOptions} from 'get-it'

export function isBrowserOptions(options: unknown): options is RequestOptions {
  return typeof options === 'object' && options !== null && !('protocol' in options)
}
