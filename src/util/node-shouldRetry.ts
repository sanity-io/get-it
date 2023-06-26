import allowed from 'is-retry-allowed'

export default (err: any, num: number, options: any) => {
  if (options.method !== 'GET' && options.method !== 'HEAD') {
    return false
  }

  // Don't allow retries if we get any http status code by default
  if (err.response && err.response.statusCode) {
    return false
  }

  return allowed(err)
}
