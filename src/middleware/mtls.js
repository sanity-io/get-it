const objectAssign = require('object-assign')

module.exports = (config = {}) => {
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
    finalizeOptions: options => {
      const mtlsOpts = {
        cert: config.cert,
        key: config.key,
        ca: config.ca
      }
      return objectAssign({}, options, mtlsOpts)
    }
  }
}
