export default proxy => {
  if (proxy !== false && (!proxy || !proxy.host)) {
    throw new Error('Proxy middleware takes an object of host, port and auth properties')
  }

  return {
    processOptions: options => Object.assign({proxy}, options)
  }
}
