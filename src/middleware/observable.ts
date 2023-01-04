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
    onReturn: (channels: any, context: any) =>
      new Observable((observer: any) => {
        channels.error.subscribe((err: any) => observer.error(err))
        channels.progress.subscribe((event: any) =>
          observer.next(Object.assign({type: 'progress'}, event))
        )
        channels.response.subscribe((response: any) => {
          observer.next(Object.assign({type: 'response'}, response))
          observer.complete()
        })

        channels.request.publish(context)
        return () => channels.abort.publish()
      }),
  }
}
