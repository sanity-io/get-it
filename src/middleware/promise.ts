import type {Context, ErrorType, MiddlewareHooks, RequestChannels} from '../types'

/** @public */
export const promise = (options: {implementation?: PromiseConstructor} = {}) => {
  const PromiseImplementation = options.implementation || Promise
  if (!PromiseImplementation) {
    throw new Error('`Promise` is not available in global scope, and no implementation was passed')
  }

  return {
    onReturn: (channels: RequestChannels, context: Context) =>
      new PromiseImplementation((resolve, reject) => {
        const cancel = context.options.cancelToken
        if (cancel) {
          cancel.promise.then((reason: ErrorType) => {
            channels.abort.publish(reason)
            reject(reason)
          })
        }

        channels.error.subscribe(reject)
        channels.response.subscribe((response) => {
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
      }),
  } satisfies MiddlewareHooks
}

/**
 * The cancel token API is based on the [cancelable promises proposal](https://github.com/tc39/proposal-cancelable-promises), which is currently at Stage 1.
 *
 * Code shamelessly stolen/borrowed from MIT-licensed [axios](https://github.com/mzabriskie/axios). Thanks to [Nick Uraltsev](https://github.com/nickuraltsev), [Matt Zabriskie](https://github.com/mzabriskie) and the other contributors of that project!
 */
/** @public */
export class Cancel {
  __CANCEL__ = true

  message: string

  constructor(message: any) {
    this.message = message
  }

  toString() {
    return `Cancel${this.message ? `: ${this.message}` : ''}`
  }
}

/** @public */
export class CancelToken {
  promise: Promise<any>
  reason?: Cancel

  constructor(executor: any) {
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.')
    }

    let resolvePromise: any = null

    this.promise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    executor((message: any) => {
      if (this.reason) {
        // Cancellation has already been requested
        return
      }

      this.reason = new Cancel(message)
      resolvePromise(this.reason)
    })
  }

  static source = () => {
    let cancel
    const token = new CancelToken((can: any) => {
      cancel = can
    })

    return {
      token: token,
      cancel: cancel,
    }
  }
}

const isCancel = (value: any) => !!(value && value.__CANCEL__)

promise.Cancel = Cancel
promise.CancelToken = CancelToken
promise.isCancel = isCancel
