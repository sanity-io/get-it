import type {Context, MiddlewareHooks, RequestChannels} from '../types'
import global from '../util/global'

/** @public */
export function observable(opts: any = {}) {
  const Observable = opts.implementation || global.Observable
  if (!Observable) {
    throw new Error(
      '`Observable` is not available in global scope, and no implementation was passed'
    )
  }

  return {
    onReturn: (channels: RequestChannels, context: Context) =>
      new Observable((observer) => {
        channels.error.subscribe((err) => observer.error(err))
        channels.progress.subscribe((event) =>
          observer.next(Object.assign({type: 'progress'}, event))
        )
        channels.response.subscribe((response) => {
          observer.next(Object.assign({type: 'response'}, response))
          observer.complete()
        })

        channels.request.publish(context)
        return () => channels.abort.publish()
      }),
  } satisfies MiddlewareHooks
}
