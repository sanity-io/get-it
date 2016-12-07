import Observable from '@sanity/observable/minimal'

export const observable = {
  onReturn: (channels, context) => new Observable(observer => {
    channels.error.subscribe(err => observer.error(err))
    channels.response.subscribe(response => {
      observer.next({type: 'response', response})
      observer.complete()
    })

    channels.request.publish(context)
    return () => channels.abort.publish()
  })
}
