// Code borrowed from https://github.com/bjoerge/nano-pubsub

export interface Subscriber<Event> {
  (event: Event): void
}
export interface PubSub<Message> {
  publish: (message: Message) => void
  subscribe: (subscriber: Subscriber<Message>) => () => void
}

export function createPubSub<Message = void>(): PubSub<Message> {
  const subscribers: {[id: string]: Subscriber<Message>} = Object.create(null)
  let nextId = 0
  function subscribe(subscriber: Subscriber<Message>) {
    const id = nextId++
    subscribers[id] = subscriber
    return function unsubscribe() {
      delete subscribers[id]
    }
  }

  function publish(event: Message) {
    for (const id in subscribers) {
      subscribers[id](event)
    }
  }

  return {
    publish,
    subscribe,
  }
}
