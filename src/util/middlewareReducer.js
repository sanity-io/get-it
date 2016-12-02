module.exports = middleware => {
  const applyMiddleware = (hook, defaultValue, ...args) => {
    return middleware[hook].reduce((value, handler) => {
      return handler(value, ...args)
    }, defaultValue)
  }

  applyMiddleware.untilError = (hook, defaultValue, ...args) => {
    // We want to be able to opt-out of the middleware chain as fast as a
    // middleware returns an error, so we're using a cheap version of reduce here
    const handlers = middleware[hook]
    let value = defaultValue
    for (let i = 0; i < handlers.length; i++) {
      value = handlers[i](value, ...args)

      if (value instanceof Error) {
        break
      }
    }

    return value
  }

  return applyMiddleware
}
