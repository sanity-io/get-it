import Observable from '@sanity/observable/minimal'

export const observable = {
  onReturn: channels => new Observable(observer => {
    channels.error.subscribe(err => observer.error(err))
    channels.response.subscribe(response => {
      observer.next({type: 'response', response})
      observer.complete()
    })

    // Trigger the request
    channels.request.publish()

    return () => {
      // @todo UNSUBSCRIBE; ABORT
    }
  })
}
