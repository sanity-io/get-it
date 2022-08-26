import Cancel from './cancel/Cancel'
import CancelToken from './cancel/CancelToken'
import isCancel from './cancel/isCancel'

const globalPromise = typeof Promise === 'function' && Promise

const promise = (options = {}) => {
  const Promise = options.implementation || globalPromise
  if (!Promise) {
    throw new Error('`Promise` is not available in global scope, and no implementation was passed')
  }

  return {
    onReturn: (channels, context) =>
      new Promise((resolve, reject) => {
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
        setTimeout(() => {
          try {
            channels.request.publish(context)
          } catch (err) {
            reject(err)
          }
        }, 0)
      })
  }
}

promise.Cancel = Cancel
promise.CancelToken = CancelToken
promise.isCancel = isCancel

export default promise
