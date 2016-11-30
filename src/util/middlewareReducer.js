module.exports = (middleware, channels) => (hook, defaultValue, ...args) => {
  return middleware[hook].reduce(
    (value, handler) => handler(value, ...args),
    defaultValue
  )
}
