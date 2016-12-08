import Observable from 'any-observable'
import objectAssign from 'object-assign'

module.exports = {
  onReturn: (channels, context) => new Observable(observer => {
    channels.error.subscribe(err => observer.error(err))
    channels.progress.subscribe(event => observer.next(objectAssign({type: 'progress'}, event)))
    channels.response.subscribe(response => {
      observer.next({type: 'response', response})
      observer.complete()
    })

    channels.request.publish(context)
    return () => channels.abort.publish()
  })
}
