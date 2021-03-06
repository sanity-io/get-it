module.exports = middleware => {
  const applyMiddleware = (hook, defaultValue, ...args) => {
    const bailEarly = hook === 'onError'

    let value = defaultValue
    for (let i = 0; i < middleware[hook].length; i++) {
      const handler = middleware[hook][i]
      value = handler(value, ...args)

      if (bailEarly && !value) {
        break
      }
    }

    return value
  }

  return applyMiddleware
}
