/** @public */
export function mtls(config: any = {}) {
  if (!config.ca) {
    throw new Error('Required mtls option "ca" is missing')
  }
  if (!config.cert) {
    throw new Error('Required mtls option "cert" is missing')
  }
  if (!config.key) {
    throw new Error('Required mtls option "key" is missing')
  }

  return {
    finalizeOptions: (options: any) => {
      const mtlsOpts = {
        cert: config.cert,
        key: config.key,
        ca: config.ca,
      }
      return Object.assign({}, options, mtlsOpts)
    },
  }
}
