const global = require('global')

export const promise = (opts = {}) => {
  const Promise = opts.implementation || global.Promise
  if (!Promise) {
    throw new Error('`Promise` is not available in global scope, and no implementation was given')
  }

  return {
    onReturn: channels => new Promise((resolve, reject) => {
      channels.error.subscribe(reject)
      channels.response.subscribe(resolve)
      channels.request.publish()
    })
  }
}
