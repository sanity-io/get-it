export default (middleware: any) => {
  const applyMiddleware = (hook: any, defaultValue: any, ...args: any[]) => {
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
