import type {AgentOptions} from 'http'
import type {Middleware} from 'get-it'

import {NodeRequestError} from '../request/node-request'

type KeepAliveOptions = {
  ms?: number
  maxFree?: number

  /**
    How many times to retry in case of ECONNRESET error. Default: 3
  */
  maxRetries?: number
}

export function buildKeepAlive(agent: (opts: AgentOptions) => Pick<Middleware, 'finalizeOptions'>) {
  return function keepAlive(config: KeepAliveOptions = {}): any {
    const ms = config.ms || 1000
    const maxFree = config.maxFree || 256

    const {finalizeOptions} = agent({
      keepAlive: true,
      keepAliveMsecs: ms,
      maxFreeSockets: maxFree,
    })

    return {
      finalizeOptions,
      onError: (err, context) => {
        // When sending request through a keep-alive enabled agent, the underlying socket might be reused. But if server closes connection at unfortunate time, client may run into a 'ECONNRESET' error.
        // We retry three times in case of ECONNRESET error.
        // https://nodejs.org/docs/latest-v20.x/api/http.html#requestreusedsocket
        if (
          (context.options.method === 'GET' || context.options.method === 'POST') &&
          err instanceof NodeRequestError &&
          err.code === 'ECONNRESET' &&
          err.request.reusedSocket
        ) {
          const attemptNumber = context.options.attemptNumber || 0
          const maxRetries = config.maxRetries || 3
          if (attemptNumber < maxRetries) {
            // Create a new context with an increased attempt number, so we can exit if we reach a limit
            const newContext = Object.assign({}, context, {
              options: Object.assign({}, context.options, {attemptNumber: attemptNumber + 1}),
            })
            // If this is a reused socket we retry immediately
            setImmediate(() => context.channels.request.publish(newContext))

            return null
          }
        }

        throw err
      },
    } satisfies Middleware
  }
}
