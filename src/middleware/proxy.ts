/** @public */
export function proxy(_proxy: any) {
  if (_proxy !== false && (!_proxy || !_proxy.host)) {
    throw new Error('Proxy middleware takes an object of host, port and auth properties')
  }

  return {
    processOptions: (options: any) => Object.assign({proxy: _proxy}, options),
  }
}
