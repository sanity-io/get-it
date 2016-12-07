const global = require('global')
const Cancel = require('./cancel/Cancel')
const CancelToken = require('./cancel/CancelToken')
const isCancel = require('./cancel/isCancel')

export const promise = (opts = {}) => {
  const Promise = opts.implementation || global.Promise
  if (!Promise) {
    throw new Error('`Promise` is not available in global scope, and no implementation was given')
  }

  return {
    onReturn: (channels, context) => new Promise((resolve, reject) => {
      channels.error.subscribe(reject)
      channels.response.subscribe(resolve)
      channels.request.publish(context)

      const cancel = context.options.cancelToken
      if (cancel) {
        cancel.promise.then(reason => {
          channels.abort.publish(reason)
          reject(reason)
        })
      }
    })
  }
}

promise.Cancel = Cancel
promise.CancelToken = CancelToken
promise.isCancel = isCancel
