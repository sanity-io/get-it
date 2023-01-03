export default (err: any, attempt: any, options: any) => {
  if (options.method !== 'GET' && options.method !== 'HEAD') {
    return false
  }

  return err.isNetworkError || false
}
