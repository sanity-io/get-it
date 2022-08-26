export default (err, attempt, options) => {
  if (options.method !== 'GET' && options.method !== 'HEAD') {
    return false
  }

  return err.isNetworkError || false
}
