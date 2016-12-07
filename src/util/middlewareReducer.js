module.exports = middleware => {
  const applyMiddleware = (hook, defaultValue, ...args) => {
    return middleware[hook].reduce((value, handler) => {
      return handler(value, ...args)
    }, defaultValue)
  }

  return applyMiddleware
}
