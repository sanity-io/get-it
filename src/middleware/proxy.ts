import type {MiddlewareHooks, RequestOptions} from '../types'

/** @public */
export const proxy = (_proxy: RequestOptions['proxy']) => {
  if (_proxy !== false && (!_proxy || !_proxy.host)) {
    throw new Error('Proxy middleware takes an object of host, port and auth properties')
  }

  return {
    processOptions: (options) => ({proxy: _proxy, ...options}),
  } satisfies MiddlewareHooks
}
