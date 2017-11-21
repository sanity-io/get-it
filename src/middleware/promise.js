const global = require('../util/global')
const Cancel = require('./cancel/Cancel')
const CancelToken = require('./cancel/CancelToken')
const isCancel = require('./cancel/isCancel')

const promise = (options = {}) => {
  const Promise = options.implementation || global.Promise
  if (!Promise) {
    throw new Error('`Promise` is not available in global scope, and no implementation was passed')
  }

  return {
    onReturn: (channels, context) => new Promise((resolve, reject) => {
      const cancel = context.options.cancelToken
      if (cancel) {
        cancel.promise.then(reason => {
          channels.abort.publish(reason)
          reject(reason)
        })
      }

      channels.error.subscribe(reject)
      channels.response.subscribe(response => {
        resolve(options.onlyBody ? response.body : response)
      })

      // Wait until next tick in case cancel has been performed
      setTimeout(() => channels.request.publish(context), 0)
    })
  }
}

promise.Cancel = Cancel
promise.CancelToken = CancelToken
promise.isCancel = isCancel

module.exports = promise
